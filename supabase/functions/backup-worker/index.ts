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
    // Obtener datos completos del trabajo manualmente (igual que en processBackupQueue)
    const { data: backupJob, error: jobError } = await adminClient
      .from('backup_jobs')
      .select('*')
      .eq('id', backupJobId)
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

    const result = await processBackupJob(backupJobId, completeBackupJob, adminClient);

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
  
  const IMAGES_PER_PART = 10; // Reducido a 10 imágenes por parte para evitar timeouts
  
  console.log(`🔄 Starting MULTIPART backup processing for: ${tour.title}`);

  try {
    // Recopilar todas las imágenes
    const allImages: Array<{type: 'floor_plan' | 'panorama', data: any}> = [];
    
    for (const floorPlan of (tour.floor_plans || [])) {
      if (floorPlan.image_url) {
        allImages.push({ type: 'floor_plan', data: floorPlan });
      }
    }
    
    for (const photo of (tour.panorama_photos || [])) {
      if (photo.photo_url) {
        allImages.push({ type: 'panorama', data: photo });
      }
    }

    const totalImages = allImages.length;
    const totalParts = Math.ceil(totalImages / IMAGES_PER_PART);
    
    // Obtener metadata actual o inicializar
    const metadata = (backupJob.metadata || {}) as any;
    const currentPart = metadata.current_part || 1;
    
    console.log(`📦 Total images: ${totalImages}, Total parts: ${totalParts}, Current part: ${currentPart}`);
    
    // Si es la primera parte, inicializar metadata
    if (currentPart === 1) {
      await adminClient
        .from('backup_jobs')
        .update({
          status: 'processing',
          progress_percentage: 0,
          metadata: {
            multipart: true,
            current_part: 1,
            total_parts: totalParts,
            images_per_part: IMAGES_PER_PART
          }
        })
        .eq('id', backupJobId);
    }

    // Calcular índices para esta parte
    const startIdx = (currentPart - 1) * IMAGES_PER_PART;
    const endIdx = Math.min(startIdx + IMAGES_PER_PART, totalImages);
    const partImages = allImages.slice(startIdx, endIdx);
    
    console.log(`\n📦 Processing part ${currentPart}/${totalParts} (images ${startIdx + 1}-${endIdx})`);
    
    // Crear ZIP para esta parte
    const zip = new JSZip();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeTourName = sanitizeFilename(tour.title);
    
    const readme = `BACKUP PART ${currentPart}/${totalParts} - ${tour.title}
Created: ${new Date().toISOString()}

This is part ${currentPart} of ${totalParts} of the backup.
Contains ${partImages.length} images from the virtual tour.

Tour ID: ${tour.id}
Backup Type: ${backupType}
`;
    zip.addFile('README.txt', readme);
    
    // Procesar imágenes de esta parte
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
            console.log(`✅ [Part ${currentPart}] Floor plan: ${floorPlan.name}`);
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
            console.log(`✅ [Part ${currentPart}] Panorama: ${photo.id}`);
            itemsInPart++;
          }
        }
      } catch (error) {
        console.warn(`⚠️ [Part ${currentPart}] Failed to download image:`, error);
      }
    }

    // Generar y subir ZIP
    console.log(`📈 Generating ZIP for part ${currentPart}...`);
    const zipBlob = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    console.log(`✅ Part ${currentPart} ZIP generated: ${(zipBlob.length / 1024 / 1024).toFixed(2)} MB`);

    const partStoragePath = `${userId}/${backupJobId}/${safeTourName}_part${currentPart}_${timestamp}.zip`;
    
    const { error: uploadError } = await adminClient.storage
      .from('backups')
      .upload(partStoragePath, zipBlob, {
        contentType: 'application/zip',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload part ${currentPart}: ${uploadError.message}`);
    }

    console.log(`✅ Part ${currentPart} uploaded`);

    // Generar URL firmada
    const { data: signedUrlData } = await adminClient.storage
      .from('backups')
      .createSignedUrl(partStoragePath, 7 * 24 * 60 * 60);

    // Registrar parte en la base de datos
    await adminClient
      .from('backup_parts')
      .insert({
        backup_job_id: backupJobId,
        part_number: currentPart,
        file_url: signedUrlData?.signedUrl,
        storage_path: partStoragePath,
        file_size: zipBlob.length,
        file_hash: await generateFileHash(zipBlob),
        items_count: itemsInPart,
        status: 'completed',
        completed_at: new Date().toISOString()
      });

    // Actualizar progreso
    const progress = Math.round((currentPart / totalParts) * 100);
    await adminClient
      .from('backup_jobs')
      .update({
        processed_items: endIdx,
        progress_percentage: progress
      })
      .eq('id', backupJobId);

    console.log(`✅ Part ${currentPart}/${totalParts} completed (${progress}%)`);

    // Si hay más partes, invocar el worker para la siguiente parte
    if (currentPart < totalParts) {
      // Actualizar metadata con la siguiente parte
      await adminClient
        .from('backup_jobs')
        .update({
          metadata: {
            multipart: true,
            current_part: currentPart + 1,
            total_parts: totalParts,
            images_per_part: IMAGES_PER_PART
          }
        })
        .eq('id', backupJobId);

      console.log(`🔄 Invoking worker for part ${currentPart + 1}/${totalParts}`);
      
      // NO ESPERAR la respuesta - dejar que se ejecute en background
      const workerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/backup-worker`;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`
        },
        body: JSON.stringify({
          action: 'process_job',
          backupJobId: backupJobId
        })
      }).catch(err => console.error('Error invoking worker:', err));

      return {
        success: true,
        backupId: backupJobId,
        partsCount: totalParts,
        currentPart: currentPart,
        totalSize: zipBlob.length,
        totalItems: totalImages,
        inProgress: true
      };
    }

    // Todas las partes completadas
    const { data: allParts } = await adminClient
      .from('backup_parts')
      .select('file_size, items_count')
      .eq('backup_job_id', backupJobId);

    const totalSize = allParts?.reduce((sum: number, part: any) => sum + (part.file_size || 0), 0) || 0;

    await adminClient
      .from('backup_jobs')
      .update({
        status: 'completed',
        processed_items: totalImages,
        progress_percentage: 100,
        file_size: totalSize,
        storage_path: `${userId}/${backupJobId}/`,
        completed_at: new Date().toISOString(),
        metadata: {
          multipart: true,
          total_parts: totalParts,
          images_per_part: IMAGES_PER_PART,
          completed: true
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

    console.log(`🎉 Multipart backup completed: ${backupJobId} (${totalParts} parts)`);

    return {
      success: true,
      backupId: backupJobId,
      partsCount: totalParts,
      totalSize: totalSize,
      totalItems: totalImages
    };

  } catch (error) {
    console.error(`💥 Backup processing failed:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    await adminClient
      .from('backup_jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', backupJobId);

    await adminClient
      .from('backup_queue')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('backup_job_id', backupJobId);

    return {
      success: false,
      error: errorMessage
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

// Obtener todas las imágenes del tour (floor plans + panorama photos)
async function getAllTourImages(tour: any, adminClient: any): Promise<any[]> {
  const images: any[] = [];
  
  // Agregar floor plans
  for (const floorPlan of (tour.floor_plans || [])) {
    if (floorPlan.image_url) {
      images.push({
        type: 'floor_plan',
        data: floorPlan,
        url: floorPlan.image_url
      });
    }
  }
  
  // Agregar panorama photos
  for (const photo of (tour.panorama_photos || [])) {
    if (photo.photo_url) {
      images.push({
        type: 'panorama', 
        data: photo,
        url: photo.photo_url
      });
    }
  }
  
  return images;
}

// Dividir imágenes en partes
function splitImagesIntoParts(images: any[], maxItemsPerPart: number): any[][] {
  const parts: any[][] = [];
  for (let i = 0; i < images.length; i += maxItemsPerPart) {
    parts.push(images.slice(i, i + maxItemsPerPart));
  }
  return parts;
}

// Crear registros de partes en la base de datos
async function createBackupParts(backupJobId: string, totalParts: number, adminClient: any): Promise<any[]> {
  const partRecords = [];
  
  for (let i = 1; i <= totalParts; i++) {
    const { data: part, error } = await adminClient
      .from('backup_parts')
      .insert({
        backup_job_id: backupJobId,
        part_number: i,
        status: 'pending',
        items_count: 0
      })
      .select()
      .single();
    
    if (!error && part) {
      partRecords.push(part);
    }
  }
  
  return partRecords;
}

// Crear ZIP para una parte específica
async function createPartZip(images: any[], backupType: string, partNumber: number, tourName: string, adminClient: any): Promise<Uint8Array> {
  const zip = new JSZip();
  const safeTourName = sanitizeFilename(tourName);
  
  // Agregar README
  const readme = `BACKUP PART ${partNumber} - ${tourName}
Created: ${new Date().toISOString()}
Backup Type: ${backupType}
Total images in this part: ${images.length}
`;
  zip.addFile('README.txt', readme);
  
  // Procesar cada imagen
  for (const image of images) {
    try {
      if (image.type === 'floor_plan') {
        const floorPlan = image.data;
        const imagePath = extractPathFromUrl(floorPlan.image_url);
        
        const { data: imageBlob, error: imageError } = await adminClient.storage
          .from('tour-images')
          .download(imagePath);

        if (!imageError && imageBlob) {
          const arrayBuffer = await imageBlob.arrayBuffer();
          const safeName = sanitizeFilename(floorPlan.name || `floorplan_${floorPlan.id}`);
          zip.addFile(`floor_plans/${safeName}.jpg`, new Uint8Array(arrayBuffer));
        }
      } else if (image.type === 'panorama') {
        const photo = image.data;
        const imagePath = extractPathFromUrl(photo.photo_url);
        
        const { data: imageBlob, error: imageError } = await adminClient.storage
          .from('tour-images')
          .download(imagePath);

        if (!imageError && imageBlob) {
          const arrayBuffer = await imageBlob.arrayBuffer();
          const hotspotFolder = photo.hotspot_id ? `hotspot_${photo.hotspot_id}` : 'general';
          const safeFilename = sanitizeFilename(`photo_${photo.id}`);
          zip.addFile(`panoramas/${hotspotFolder}/${safeFilename}.jpg`, new Uint8Array(arrayBuffer));
        }
      }
    } catch (error) {
      console.warn(`⚠️ Failed to process image for part ${partNumber}:`, error);
    }
  }
  
  // Generar ZIP
  return await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

// Subir parte a storage
async function uploadPartToStorage(zipData: Uint8Array, backupJobId: string, partNumber: number, userId: string, adminClient: any): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const storagePath = `${userId}/${backupJobId}/part_${partNumber}_${timestamp}.zip`;
  
  const { error: uploadError } = await adminClient.storage
    .from('backups')
    .upload(storagePath, zipData, {
      contentType: 'application/zip',
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Failed to upload part ${partNumber}: ${uploadError.message}`);
  }

  // Generar URL firmada
  const { data: signedUrlData } = await adminClient.storage
    .from('backups')
    .createSignedUrl(storagePath, 7 * 24 * 60 * 60); // 7 días

  return signedUrlData?.signedUrl || '';
}

// Invocar siguiente parte
async function invokeNextPart(backupJobId: string): Promise<void> {
  try {
    const workerUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/backup-worker`;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // No esperar respuesta - ejecutar en background
    fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`
      },
      body: JSON.stringify({
        action: 'process_job',
        backupJobId: backupJobId
      })
    }).catch(err => console.error('Error invoking next part:', err));
    
  } catch (error) {
    console.error('Error setting up next part invocation:', error);
  }
}

// Marcar backup como completado
async function markBackupAsCompleted(backupJobId: string, adminClient: any): Promise<void> {
  // Calcular tamaño total
  const { data: parts } = await adminClient
    .from('backup_parts')
    .select('file_size, items_count')
    .eq('backup_job_id', backupJobId);

  const totalSize = parts?.reduce((sum: number, part: any) => sum + (part.file_size || 0), 0) || 0;
  const totalItems = parts?.reduce((sum: number, part: any) => sum + (part.items_count || 0), 0) || 0;

  // Actualizar backup job
  await adminClient
    .from('backup_jobs')
    .update({
      status: 'completed',
      processed_items: totalItems,
      progress_percentage: 100,
      file_size: totalSize,
      completed_at: new Date().toISOString()
    })
    .eq('id', backupJobId);

  // Actualizar queue
  await adminClient
    .from('backup_queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('backup_job_id', backupJobId);

  console.log(`🎉 Backup completed: ${backupJobId}`);
}

// Calcular tamaño total del backup
async function calculateTotalBackupSize(backupJobId: string, adminClient: any): Promise<number> {
  const { data: parts } = await adminClient
    .from('backup_parts')
    .select('file_size')
    .eq('backup_job_id', backupJobId);

  return parts?.reduce((sum: number, part: any) => sum + (part.file_size || 0), 0) || 0;
}

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
