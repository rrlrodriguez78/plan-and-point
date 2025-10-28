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

        // Obtener datos completos del tour
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
          .eq('id', queueItem.backup_job_id)
          .single();

        if (jobError || !backupJob) {
          throw new Error('Backup job not found');
        }

        // Procesar el backup
        const result = await processBackupJob(
          queueItem.backup_job_id,
          backupJob,
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

    // 1. METADATOS ESTRUCTURADOS
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

    // 2. DESCARGAR Y AGREGAR MEDIA (para backup completo)
    if (backupType === 'full_backup') {
      // Descargar planos
      await updateProgress(2, 'Downloading floor plans');
      for (const [index, floorPlan] of (tour.floor_plans || []).entries()) {
        if (floorPlan.image_url) {
          try {
            const imagePath = extractFilenameFromUrl(floorPlan.image_url);
            const { data: imageBlob, error: imageError } = await adminClient.storage
              .from('tour-images')
              .download(imagePath);

            if (!imageError && imageBlob) {
              const arrayBuffer = await imageBlob.arrayBuffer();
              const safeName = sanitizeFilename(floorPlan.name);
              zip.addFile(`media/floor_plans/${safeName}.jpg`, new Uint8Array(arrayBuffer));
              console.log(`✅ Downloaded floor plan: ${floorPlan.name}`);
            }
          } catch (error) {
            console.warn(`⚠️ Could not download floor plan: ${floorPlan.name}`, error);
          }
        }
        processedItems++;
        await updateProgress(processedItems, `Processing floor plans (${index + 1}/${tour.floor_plans?.length || 0})`);
      }

      // Descargar fotos panorámicas
      await updateProgress(processedItems, 'Downloading panorama photos');
      for (const [index, photo] of (tour.panorama_photos || []).entries()) {
        try {
          const imagePath = extractFilenameFromUrl(photo.photo_url);
          const { data: imageBlob, error: imageError } = await adminClient.storage
            .from('tour-images')
            .download(imagePath);

          if (!imageError && imageBlob) {
            const arrayBuffer = await imageBlob.arrayBuffer();
            const hotspotFolder = photo.hotspot_id ? `hotspot_${photo.hotspot_id}` : 'general';
            const safeFilename = sanitizeFilename(`photo_${photo.id}`);
            zip.addFile(`media/panoramas/${hotspotFolder}/${safeFilename}.jpg`, new Uint8Array(arrayBuffer));
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

function extractFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    // Remove empty strings and get the last part
    const cleanParts = pathParts.filter(p => p);
    return cleanParts.slice(4).join('/'); // Skip /storage/v1/object/public/bucket-name
  } catch {
    return url.split('/').slice(-1)[0] || '';
  }
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
