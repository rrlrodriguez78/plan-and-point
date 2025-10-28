import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { JSZip } from "https://deno.land/x/jszip@0.11.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

console.log('🔧 Backup Worker started - True Background Processing');

serve(async (req) => {
  console.log('📨 Worker request:', req.method, req.url);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const adminClient = createClient(supabaseUrl!, supabaseServiceKey!);

    const { action, backupJobId, maxJobs = 3 } = await req.json();

    if (action === 'process_queue') {
      return await processBackupQueue(adminClient, maxJobs);
    } else if (action === 'process_job') {
      if (!backupJobId) {
        throw new Error('backupJobId is required');
      }
      return await processSingleBackupJob(backupJobId, adminClient);
    } else if (action === 'cleanup_stuck_jobs') {
      return await cleanupStuckJobs(adminClient);
    } else {
      throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('💥 Error in backup worker:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Worker error',
        details: errorMessage
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Procesar múltiples trabajos de la cola
async function processBackupQueue(adminClient: any, maxJobs: number = 3) {
  console.log(`🔄 Processing backup queue, max jobs: ${maxJobs}`);

  try {
    // Obtener trabajos pendientes de la cola
    const { data: queueItems, error: queueError } = await adminClient
      .from('backup_queue')
      .select(`
        id,
        backup_job_id,
        attempts,
        max_attempts,
        backup_jobs (
          id,
          tour_id,
          user_id,
          job_type,
          total_items,
          estimated_size_mb
        )
      `)
      .in('status', ['pending', 'retry'])
      .lte('scheduled_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('scheduled_at', { ascending: true })
      .limit(maxJobs);

    if (queueError) throw queueError;

    console.log(`📋 Found ${queueItems?.length || 0} jobs to process`);

    const results = {
      processed: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    };

    // Procesar cada trabajo
    for (const queueItem of queueItems || []) {
      try {
        // Verificar intentos máximos
        if (queueItem.attempts >= queueItem.max_attempts) {
          console.log(`⏭️ Skipping job ${queueItem.backup_job_id} - max attempts reached`);
          results.skipped++;
          continue;
        }

        // Marcar como procesando
        await adminClient
          .from('backup_queue')
          .update({
            status: 'processing',
            started_at: new Date().toISOString(),
            attempts: queueItem.attempts + 1
          })
          .eq('id', queueItem.id);

        // Obtener datos completos del tour manualmente
        const { data: backupJob, error: jobError } = await adminClient
          .from('backup_jobs')
          .select('*')
          .eq('id', queueItem.backup_job_id)
          .single();

        if (jobError || !backupJob) {
          throw new Error(`Backup job not found: ${jobError?.message || 'No data'}`);
        }

        // Obtener tour y sus relaciones de forma explícita
        const { data: tour, error: tourError } = await adminClient
          .from('virtual_tours')
          .select('*')
          .eq('id', backupJob.tour_id)
          .single();

        if (tourError || !tour) {
          throw new Error(`Tour not found: ${tourError?.message || 'No data'}`);
        }

        // Obtener floor plans
        const { data: floorPlans } = await adminClient
          .from('floor_plans')
          .select('*')
          .eq('tour_id', tour.id);

        // Obtener hotspots a través de los floor plans
        const floorPlanIds = floorPlans?.map((fp: any) => fp.id) || [];
        const { data: hotspots } = await adminClient
          .from('hotspots')
          .select('*')
          .in('floor_plan_id', floorPlanIds);

        // Obtener panorama photos a través de los hotspots
        const hotspotIds = hotspots?.map((h: any) => h.id) || [];
        const { data: panoramaPhotos } = await adminClient
          .from('panorama_photos')
          .select('*')
          .in('hotspot_id', hotspotIds);

        // Construir el objeto completo
        const completeBackupJob = {
          ...backupJob,
          virtual_tours: {
            ...tour,
            floor_plans: floorPlans || [],
            hotspots: hotspots || [],
            panorama_photos: panoramaPhotos || []
          }
        };

        // Procesar el backup con los datos completos
        const result = await processBackupJob(
          queueItem.backup_job_id,
          completeBackupJob,
          adminClient
        );

        if (result.success) {
          results.processed++;
          results.details.push({
            jobId: queueItem.backup_job_id,
            status: 'completed',
            partsCount: result.partsCount,
            totalSize: result.totalSize,
            totalItems: result.totalItems
          });
        } else {
          throw new Error(result.error);
        }

      } catch (error) {
        console.error(`❌ Failed to process job ${queueItem.backup_job_id}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.failed++;
        results.details.push({
          jobId: queueItem.backup_job_id,
          status: 'failed',
          error: errorMessage
        });

        // Manejar reintento o fallo permanente
        await handleFailedJob(queueItem, error, adminClient);
      }
    }

    console.log(`✅ Queue processing completed:`, results);

    return new Response(
      JSON.stringify({
        success: true,
        ...results,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Error processing queue:', error);
    throw error;
  }
}

// Procesar un solo trabajo de backup
async function processSingleBackupJob(backupJobId: string, adminClient: any) {
  console.log(`🎯 Processing single backup job: ${backupJobId}`);

  try {
    // Obtener datos completos del trabajo
    const { data: backupJob, error: jobError } = await adminClient
      .from('backup_jobs')
      .select(`
        *,
        virtual_tours (
          *,
          floor_plans (*),
          hotspots (*),
          panorama_photos (*)
        )
      `)
      .eq('id', backupJobId)
      .single();

    if (jobError || !backupJob) {
      throw new Error('Backup job not found');
    }

    const result = await processBackupJob(backupJobId, backupJob, adminClient);

    return new Response(
      JSON.stringify(result),
      { 
        status: result.success ? 200 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error(`💥 Error processing single job ${backupJobId}:`, error);
    throw error;
  }
}

// FUNCIÓN PRINCIPAL DE PROCESAMIENTO DE BACKUP CON MULTIPART
async function processBackupJob(backupJobId: string, backupJob: any, adminClient: any) {
  const tour = backupJob.virtual_tours;
  const userId = backupJob.user_id;
  const backupType = backupJob.job_type;
  let processedItems = 0;
  
  const IMAGES_PER_PART = 50; // 50 imágenes por archivo ZIP
  
  console.log(`🔄 Starting MULTIPART backup processing for: ${tour.title}`);

  try {
    const totalItems = calculateTotalItems(tour, backupType);

    // Función para actualizar progreso
    const updateProgress = async (count: number, message?: string) => {
      processedItems = count;
      const progress = Math.round((processedItems / totalItems) * 100);
      
      await adminClient
        .from('backup_jobs')
        .update({
          processed_items: processedItems,
          progress_percentage: progress
        })
        .eq('id', backupJobId);
      
      console.log(`📈 Progress: ${progress}% - ${message}`);
    };

    await updateProgress(0, 'Initializing multipart backup');

    // Recopilar todas las imágenes que necesitamos descargar
    const allImages: Array<{type: 'floor_plan' | 'panorama', data: any}> = [];
    
    // Agregar floor plans
    for (const floorPlan of (tour.floor_plans || [])) {
      if (floorPlan.image_url) {
        allImages.push({ type: 'floor_plan', data: floorPlan });
      }
    }
    
    // Agregar panoramas
    for (const photo of (tour.panorama_photos || [])) {
      if (photo.photo_url) {
        allImages.push({ type: 'panorama', data: photo });
      }
    }

    console.log(`📦 Total images to backup: ${allImages.length}`);
    console.log(`📊 Will create ${Math.ceil(allImages.length / IMAGES_PER_PART)} parts`);

    // Dividir imágenes en partes
    const parts: Array<Array<typeof allImages[0]>> = [];
    for (let i = 0; i < allImages.length; i += IMAGES_PER_PART) {
      parts.push(allImages.slice(i, i + IMAGES_PER_PART));
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTourName = sanitizeFilename(tour.title);
    
    // Procesar cada parte
    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
      const partNumber = partIndex + 1;
      const partImages = parts[partIndex];
      
      console.log(`\n📦 Processing part ${partNumber}/${parts.length} (${partImages.length} images)`);
      
      const zip = new JSZip();
      
      // Agregar README para esta parte
      const readme = `BACKUP PART ${partNumber}/${parts.length} - ${tour.title}
Created: ${new Date().toISOString()}

This is part ${partNumber} of ${parts.length} of the backup.
Contains ${partImages.length} images from the virtual tour.

Tour ID: ${tour.id}
Backup Type: ${backupType}
`;
      zip.addFile('README.txt', readme);
      
      // Descargar y agregar imágenes de esta parte
      let itemsInPart = 0;
      for (const [idx, imageItem] of partImages.entries()) {
        try {
          if (imageItem.type === 'floor_plan') {
            const floorPlan = imageItem.data;
            const imagePath = extractPathFromUrl(floorPlan.image_url);
            
            const { data: imageBlob, error: imageError } = await adminClient.storage
              .from('tour-images')
              .download(imagePath);

            if (!imageError && imageBlob) {
              const arrayBuffer = await imageBlob.arrayBuffer();
              const safeName = sanitizeFilename(floorPlan.name);
              zip.addFile(`floor_plans/${safeName}.jpg`, new Uint8Array(arrayBuffer));
              console.log(`✅ [Part ${partNumber}] Floor plan: ${floorPlan.name}`);
              itemsInPart++;
            }
          } else {
            const photo = imageItem.data;
            const imagePath = extractPathFromUrl(photo.photo_url);
            
            const { data: imageBlob, error: imageError } = await adminClient.storage
              .from('tour-images')
              .download(imagePath);

            if (!imageError && imageBlob) {
              const arrayBuffer = await imageBlob.arrayBuffer();
              const hotspotFolder = photo.hotspot_id ? `hotspot_${photo.hotspot_id}` : 'general';
              const safeFilename = sanitizeFilename(`photo_${photo.id}`);
              zip.addFile(`panoramas/${hotspotFolder}/${safeFilename}.jpg`, new Uint8Array(arrayBuffer));
              console.log(`✅ [Part ${partNumber}] Panorama: ${photo.id}`);
              itemsInPart++;
            }
          }
          
          processedItems++;
          if (idx % 10 === 0) {
            await updateProgress(processedItems, `Part ${partNumber}/${parts.length}: ${idx + 1}/${partImages.length} images`);
          }
        } catch (error) {
          console.warn(`⚠️ [Part ${partNumber}] Failed to download image:`, error);
        }
      }

      // Generar ZIP de esta parte
      await updateProgress(processedItems, `Generating ZIP for part ${partNumber}/${parts.length}`);
      const zipBlob = await zip.generateAsync({
        type: 'uint8array',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      console.log(`✅ Part ${partNumber} ZIP generated: ${(zipBlob.length / 1024 / 1024).toFixed(2)} MB`);

      // Subir esta parte
      const partStoragePath = `${userId}/${backupJobId}/${safeTourName}_part${partNumber}_${timestamp}.zip`;
      
      const { error: uploadError } = await adminClient.storage
        .from('backups')
        .upload(partStoragePath, zipBlob, {
          contentType: 'application/zip',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Failed to upload part ${partNumber}: ${uploadError.message}`);
      }

      console.log(`✅ Part ${partNumber} uploaded to: ${partStoragePath}`);

      // Generar URL firmada para esta parte
      const { data: signedUrlData } = await adminClient.storage
        .from('backups')
        .createSignedUrl(partStoragePath, 7 * 24 * 60 * 60); // 7 días

      // Registrar esta parte en backup_parts
      await adminClient
        .from('backup_parts')
        .insert({
          backup_job_id: backupJobId,
          part_number: partNumber,
          file_url: signedUrlData?.signedUrl,
          storage_path: partStoragePath,
          file_size: zipBlob.length,
          file_hash: await generateFileHash(zipBlob),
          items_count: itemsInPart,
          status: 'completed',
          completed_at: new Date().toISOString()
        });

      console.log(`✅ Part ${partNumber} registered in database`);
    }

    // Todas las partes completadas - actualizar el backup job como completado
    await updateProgress(totalItems, 'All parts completed!');

    // Contar el tamaño total de todas las partes
    const { data: allParts } = await adminClient
      .from('backup_parts')
      .select('file_size, items_count')
      .eq('backup_job_id', backupJobId);

    const totalSize = allParts?.reduce((sum: number, part: any) => sum + (part.file_size || 0), 0) || 0;
    const totalImagesInParts = allParts?.reduce((sum: number, part: any) => sum + (part.items_count || 0), 0) || 0;

    // Actualizar backup_jobs
    await adminClient
      .from('backup_jobs')
      .update({
        status: 'completed',
        processed_items: totalItems,
        progress_percentage: 100,
        file_size: totalSize,
        storage_path: `${userId}/${backupJobId}/`,
        completed_at: new Date().toISOString(),
        metadata: {
          multipart: true,
          parts_count: parts.length,
          total_images: totalImagesInParts,
          images_per_part: IMAGES_PER_PART
        }
      })
      .eq('id', backupJobId);

    await adminClient
      .from('backup_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('backup_job_id', backupJobId);

    // Registrar éxito
    await adminClient
      .from('backup_logs')
      .insert({
        backup_job_id: backupJobId,
        event_type: 'backup_completed',
        message: `Multipart backup completed successfully (${parts.length} parts)`,
        details: {
          parts_count: parts.length,
          total_size_mb: (totalSize / 1024 / 1024).toFixed(2),
          total_items: totalItems,
          total_images: totalImagesInParts,
          processing_time: 'completed'
        }
      });

    console.log(`🎉 Multipart backup completed: ${backupJobId} (${parts.length} parts)`);

    return {
      success: true,
      backupId: backupJobId,
      partsCount: parts.length,
      totalSize: totalSize,
      totalItems: totalItems
    };

  } catch (error) {
    console.error(`💥 Backup processing failed for ${backupJobId}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Detectar si fue un timeout y personalizar el mensaje
    const isTimeout = errorMessage.includes('TIMEOUT_LIMIT') || errorMessage.includes('CPU Time exceeded');
    const finalErrorMessage = isTimeout 
      ? `Backup demasiado grande: Este tour tiene ${tour.panorama_photos?.length || 0} imágenes. Backups con más de 150 imágenes no pueden procesarse en una sola ejecución. Por favor, contacta a soporte para tours grandes.`
      : errorMessage;
    
    // Registrar error
    await adminClient
      .from('backup_logs')
      .insert({
        backup_job_id: backupJobId,
        event_type: 'backup_failed',
        message: 'Backup processing failed',
        details: {
          error: finalErrorMessage,
          processed_items: processedItems
        },
        is_error: true
      });

    // Actualizar estado de fallo
    await adminClient
      .from('backup_jobs')
      .update({
        status: 'failed',
        error_message: finalErrorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', backupJobId);

    return {
      success: false,
      error: finalErrorMessage,
      backupId: backupJobId,
      processedItems: processedItems
    };
  }
}

// Limpiar trabajos stuck
async function cleanupStuckJobs(adminClient: any) {
  console.log('🧹 Cleaning up stuck jobs');

  const { data: stuckJobs, error } = await adminClient
    .from('backup_queue')
    .update({
      status: 'retry',
      error_message: 'Reset by cleanup worker',
      scheduled_at: new Date().toISOString()
    })
    .eq('status', 'processing')
    .lt('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // 30 minutos
    .select();

  return new Response(
    JSON.stringify({
      cleaned: stuckJobs?.length || 0,
      message: 'Stuck jobs cleaned up'
    }),
    { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

// Manejar trabajos fallidos
async function handleFailedJob(queueItem: any, error: any, adminClient: any) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  if (queueItem.attempts + 1 >= queueItem.max_attempts) {
    // Máximo de intentos alcanzado
    await adminClient
      .from('backup_queue')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', queueItem.id);

    await adminClient
      .from('backup_jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', queueItem.backup_job_id);
  } else {
    // Programar reintento con backoff exponencial
    const retryDelay = Math.min(5 * 60 * 1000 * Math.pow(2, queueItem.attempts), 24 * 60 * 60 * 1000); // Máximo 24 horas
    const nextScheduled = new Date(Date.now() + retryDelay);

    await adminClient
      .from('backup_queue')
      .update({
        status: 'retry',
        error_message: errorMessage,
        scheduled_at: nextScheduled.toISOString()
      })
      .eq('id', queueItem.id);
  }
}

// FUNCIONES AUXILIARES
function calculateTotalItems(tour: any, backupType: string): number {
  const baseItems = 1; // manifest.json
  const floorPlans = tour.floor_plans?.length || 0;
  const photos = tour.panorama_photos?.length || 0;

  if (backupType === 'media_only') {
    return baseItems + floorPlans + photos;
  }
  
  return baseItems + floorPlans + photos + (tour.hotspots?.length || 0);
}

// Extrae el path completo de una URL de storage
function extractPathFromUrl(url: string): string {
  try {
    // Si la URL contiene 'public/', extraer todo después de 'public/'
    if (url.includes('/public/')) {
      const parts = url.split('/public/');
      if (parts.length > 1) {
        // Remover el nombre del bucket del path
        const pathAfterPublic = parts[1];
        const pathParts = pathAfterPublic.split('/');
        // Saltar el nombre del bucket (primer elemento) y tomar el resto
        return pathParts.slice(1).join('/');
      }
    }
    
    // Fallback: extraer después de 'object/'
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const objectIndex = pathParts.indexOf('object');
    if (objectIndex !== -1 && objectIndex + 2 < pathParts.length) {
      const pathAfterObject = pathParts.slice(objectIndex + 2).join('/');
      // Si empieza con el nombre del bucket, removerlo
      const bucketRemoved = pathAfterObject.split('/').slice(1).join('/');
      return bucketRemoved || pathAfterObject;
    }
    
    return pathParts[pathParts.length - 1];
  } catch (error) {
    console.error('Error extracting path from URL:', url, error);
    return url.split('/').pop() || '';
  }
}

// Alias para backward compatibility
function extractFilenameFromUrl(url: string): string {
  return extractPathFromUrl(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 100);
}

async function generateFileHash(data: Uint8Array): Promise<string> {
  // Use a simple hex conversion without crypto.subtle to avoid type issues
  let hash = 0;
  for (let i = 0; i < Math.min(data.length, 1024); i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
