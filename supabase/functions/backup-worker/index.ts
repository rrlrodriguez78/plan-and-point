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

        // Obtener hotspots
        const { data: hotspots } = await adminClient
          .from('hotspots')
          .select('*')
          .eq('tour_id', tour.id);

        // Obtener panorama photos
        const { data: panoramaPhotos } = await adminClient
          .from('panorama_photos')
          .select('*')
          .eq('tour_id', tour.id);

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
            fileSize: result.fileSize,
            downloadUrl: result.downloadUrl
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

// FUNCIÓN PRINCIPAL DE PROCESAMIENTO DE BACKUP
async function processBackupJob(backupJobId: string, backupJob: any, adminClient: any) {
  const tour = backupJob.virtual_tours;
  const userId = backupJob.user_id;
  const backupType = backupJob.job_type;
  let processedItems = 0; // Declarar aquí para que esté en scope de catch

  console.log(`🔄 Starting REAL backup processing for: ${tour.title}`);

  try {
    const zip = new JSZip();
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

    await updateProgress(0, 'Initializing backup');

    // 1. SOLO AGREGAR METADATA COMPLEJA PARA FULL BACKUP
    if (backupType === 'full_backup') {
      const tourMetadata = {
        export_info: {
          version: '2.0',
          type: 'virtual_tour_backup',
          created_at: new Date().toISOString(),
          backup_type: backupType,
          total_items: totalItems
        },
        tour: {
          id: tour.id,
          title: tour.title,
          description: tour.description,
          created_at: tour.created_at,
          updated_at: tour.updated_at
        },
        floor_plans: tour.floor_plans?.map((plan: any) => ({
          id: plan.id,
          name: plan.name,
          image_url: plan.image_url
        })) || [],
        hotspots: tour.hotspots?.map((hotspot: any) => ({
          id: hotspot.id,
          title: hotspot.title,
          floor_plan_id: hotspot.floor_plan_id,
          x_position: hotspot.x_position,
          y_position: hotspot.y_position
        })) || [],
        panorama_photos: tour.panorama_photos?.map((photo: any) => ({
          id: photo.id,
          photo_url: photo.photo_url,
          hotspot_id: photo.hotspot_id
        })) || []
      };
      zip.addFile('backup_manifest.json', JSON.stringify(tourMetadata, null, 2));
      await updateProgress(1, 'Metadata added to archive');
    } else if (backupType === 'media_only') {
      // Para media_only, solo un README simple
      const readme = `MEDIA BACKUP - ${tour.title}
Created: ${new Date().toISOString()}

This backup contains only media files from the virtual tour:
- floor_plans/ - Floor plan images
- panoramas/ - 360° panorama photos organized by hotspot

Tour ID: ${tour.id}
`;
      zip.addFile('README.txt', readme);
      await updateProgress(1, 'README created');
    }

    // 2. DESCARGAR IMÁGENES (para ambos tipos)
    if (backupType === 'full_backup' || backupType === 'media_only') {
      // Descargar planos
      await updateProgress(2, 'Downloading floor plans');
      for (const [index, floorPlan] of (tour.floor_plans || []).entries()) {
        if (floorPlan.image_url) {
          try {
            console.log(`🔍 Processing floor plan: ${floorPlan.name}, URL: ${floorPlan.image_url}`);
            const imagePath = extractPathFromUrl(floorPlan.image_url);
            console.log(`📂 Extracted path: ${imagePath}`);
            
            const { data: imageBlob, error: imageError } = await adminClient.storage
              .from('tour-images')
              .download(imagePath);

            if (imageError) {
              console.error(`❌ Storage error for ${floorPlan.name}:`, imageError);
            } else if (!imageBlob) {
              console.error(`❌ No blob returned for ${floorPlan.name}`);
            } else {
              const arrayBuffer = await imageBlob.arrayBuffer();
              const safeName = sanitizeFilename(floorPlan.name);
              const folder = backupType === 'media_only' ? 'floor_plans' : 'media/floor_plans';
              zip.addFile(`${folder}/${safeName}.jpg`, new Uint8Array(arrayBuffer));
              console.log(`✅ Downloaded floor plan: ${floorPlan.name} (${arrayBuffer.byteLength} bytes)`);
            }
          } catch (error) {
            console.error(`⚠️ Exception downloading floor plan: ${floorPlan.name}`, error);
          }
        } else {
          console.log(`⚠️ Floor plan ${floorPlan.name} has no image_url`);
        }
        processedItems++;
        await updateProgress(processedItems, `Processing floor plans (${index + 1}/${tour.floor_plans?.length || 0})`);
      }

      // Descargar fotos panorámicas
      await updateProgress(processedItems, 'Downloading panorama photos');
      for (const [index, photo] of (tour.panorama_photos || []).entries()) {
        try {
          console.log(`🔍 Processing panorama: ${photo.id}, URL: ${photo.photo_url}`);
          const imagePath = extractPathFromUrl(photo.photo_url);
          console.log(`📂 Extracted path: ${imagePath}`);
          
          const { data: imageBlob, error: imageError } = await adminClient.storage
            .from('tour-images')
            .download(imagePath);

          if (!imageError && imageBlob) {
            const arrayBuffer = await imageBlob.arrayBuffer();
            const hotspotFolder = photo.hotspot_id ? `hotspot_${photo.hotspot_id}` : 'general';
            const safeFilename = sanitizeFilename(`photo_${photo.id}`);
            const folder = backupType === 'media_only' ? 'panoramas' : 'media/panoramas';
            zip.addFile(`${folder}/${hotspotFolder}/${safeFilename}.jpg`, new Uint8Array(arrayBuffer));
            console.log(`✅ Downloaded panorama: ${photo.id} (${arrayBuffer.byteLength} bytes)`);
          } else if (imageError) {
            console.error(`❌ Storage error for panorama ${photo.id}:`, imageError);
          }
        } catch (error) {
          console.warn(`⚠️ Could not download panorama: ${photo.id}`, error);
        }
        processedItems++;
        if (processedItems % 5 === 0) {
          await updateProgress(processedItems, `Downloading photos (${processedItems}/${tour.panorama_photos?.length || 0})`);
        }
      }
    }

    await updateProgress(totalItems - 1, 'Finalizing archive');

    // 3. GENERAR ARCHIVO ZIP
    const zipBlob = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    console.log(`✅ ZIP archive generated: ${(zipBlob.length / 1024 / 1024).toFixed(2)} MB`);

    // 4. SUBIR A ALMACENAMIENTO
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTourName = sanitizeFilename(tour.title);
    const storagePath = `${userId}/${backupJobId}/${safeTourName}_${timestamp}.zip`;
    
    const { error: uploadError } = await adminClient.storage
      .from('backups')
      .upload(storagePath, zipBlob, {
        contentType: 'application/zip',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload backup: ${uploadError.message}`);
    }

    console.log(`✅ Backup uploaded to: ${storagePath}`);

    // 5. GENERAR URL FIRMADA
    const { data: signedUrlData } = await adminClient.storage
      .from('backups')
      .createSignedUrl(storagePath, 7 * 24 * 60 * 60); // 7 días de validez

    // 6. ACTUALIZAR BASE DE DATOS
    await adminClient
      .from('backup_jobs')
      .update({
        status: 'completed',
        processed_items: totalItems,
        progress_percentage: 100,
        file_size: zipBlob.length,
        storage_path: storagePath,
        file_hash: await generateFileHash(zipBlob),
        file_url: signedUrlData?.signedUrl,
        completed_at: new Date().toISOString()
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
        message: 'Backup completed successfully',
        details: {
          file_size_mb: (zipBlob.length / 1024 / 1024).toFixed(2),
          total_items: totalItems,
          storage_path: storagePath,
          processing_time: 'completed'
        }
      });

    console.log(`🎉 Backup completed successfully: ${backupJobId}`);

    return {
      success: true,
      backupId: backupJobId,
      fileSize: zipBlob.length,
      downloadUrl: signedUrlData?.signedUrl,
      storagePath: storagePath,
      totalItems: totalItems
    };

  } catch (error) {
    console.error(`💥 Backup processing failed for ${backupJobId}:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Registrar error
    await adminClient
      .from('backup_logs')
      .insert({
        backup_job_id: backupJobId,
        event_type: 'backup_failed',
        message: 'Backup processing failed',
        details: {
          error: errorMessage,
          processed_items: processedItems
        },
        is_error: true
      });

    // Actualizar estado de fallo
    await adminClient
      .from('backup_jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', backupJobId);

    return {
      success: false,
      error: errorMessage,
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
