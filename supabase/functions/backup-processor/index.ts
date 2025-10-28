import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

console.log('🚀 Backup processor with REAL file generation started');

serve(async (req) => {
  console.log('📨 Request received:', req.method, req.url);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody = await req.text();
    console.log('📦 Request body:', requestBody);
    
    const { action, tourId, backupType = 'full_backup', backupId } = JSON.parse(requestBody);
    console.log('🔍 Parsed request:', { action, tourId, backupType, backupId });

    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    console.log('🔑 Environment check:', {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasServiceKey: !!supabaseServiceKey
    });
    
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('🔐 Authorization header:', authHeader?.substring(0, 20) + '...');
    
    if (!authHeader) {
      console.error('❌ Missing Authorization header');
      return new Response(
        JSON.stringify({ 
          error: 'Not authenticated',
          details: 'Authorization header is required'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for service operations
    const adminClient = createClient(supabaseUrl!, supabaseServiceKey!);
    
    // Create user client to verify authentication
    const userClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      global: { 
        headers: { 
          Authorization: authHeader
        } 
      }
    });

    console.log('👤 Attempting to authenticate user...');
    
    // Try to get user from JWT
    const { data: userData, error: userError } = await userClient.auth.getUser();
    
    console.log('Auth result:', { 
      hasUser: !!userData?.user, 
      userId: userData?.user?.id,
      error: userError?.message 
    });
    
    if (userError) {
      console.error('❌ User authentication error:', userError);
      return new Response(
        JSON.stringify({ 
          error: 'Not authenticated',
          details: userError.message,
          code: 'AUTH_ERROR'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const user = userData?.user;
    
    if (!user) {
      console.error('❌ No user found in token');
      return new Response(
        JSON.stringify({ 
          error: 'Not authenticated',
          details: 'Invalid or expired token',
          code: 'NO_USER'
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User authenticated:', user.id);

    if (action === 'start') {
      return await startBackup(tourId, backupType, user.id, userClient, adminClient);
    } else if (action === 'status') {
      return await getBackupStatus(backupId, user.id, adminClient);
    } else if (action === 'cancel') {
      return await cancelBackup(backupId, user.id, adminClient);
    } else if (action === 'process_queue') {
      // Acción llamada por pg_cron - no requiere autenticación de usuario específico
      const { queueId, backupJobId } = JSON.parse(requestBody);
      return await processQueueItem(queueId, backupJobId, adminClient);
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('💥 Error in backup processor:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function startBackup(tourId: string, backupType: string, userId: string, userClient: any, adminClient: any) {
  console.log('🎬 Starting REAL backup for tour:', tourId, 'type:', backupType, 'user:', userId);

  try {
    const { data: tour, error: tourError } = await userClient
      .from('virtual_tours')
      .select('id, title, tenant_id')
      .eq('id', tourId)
      .single();

    if (tourError || !tour) {
      throw new Error('Tour not found or access denied');
    }

    console.log('✅ Tour found:', tour.title);

    const { data: fullTour, error: fullTourError } = await adminClient
      .from('virtual_tours')
      .select(`
        *,
        floor_plans (
          *,
          hotspots (
            *,
            panorama_photos (*)
          )
        )
      `)
      .eq('id', tourId)
      .single();

    if (fullTourError || !fullTour) {
      throw new Error('Failed to load tour data');
    }

    const estimatedSize = calculateEstimatedSize(fullTour, backupType);
    console.log('📊 Estimated backup size:', estimatedSize, 'MB');

    const { data: backupJob, error: jobError } = await adminClient
      .from('backup_jobs')
      .insert({
        tour_id: tourId,
        user_id: userId,
        tenant_id: tour.tenant_id,
        job_type: backupType,
        status: 'pending',
        total_items: calculateTotalItems(fullTour, backupType),
        estimated_size_mb: estimatedSize
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Error creating backup job: ${jobError.message}`);
    }

    console.log('✅ Backup job created:', backupJob.id);

    const { error: queueError } = await adminClient
      .from('backup_queue')
      .insert({
        backup_job_id: backupJob.id,
        status: 'pending',
        priority: estimatedSize > 500 ? 2 : 1
      });

    if (queueError) {
      console.error('❌ Error adding to queue:', queueError);
      processBackupInBackground(fullTour, backupJob.id, backupType, userId, adminClient);
    } else {
      console.log('✅ Backup added to processing queue');
      processBackupInBackground(fullTour, backupJob.id, backupType, userId, adminClient);
    }

    return new Response(
      JSON.stringify({
        success: true,
        backupId: backupJob.id,
        backupType,
        status: 'queued',
        totalItems: backupJob.total_items,
        estimatedSize: backupJob.estimated_size_mb,
        tourName: tour.title,
        message: 'Backup added to processing queue'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('💥 Error in startBackup:', error);
    throw error;
  }
}

async function getBackupStatus(backupId: string, userId: string, adminClient: any) {
  console.log('📊 Getting backup status for:', backupId);

  try {
    const { data: backupJob, error } = await adminClient
      .from('backup_jobs')
      .select(`
        *,
        virtual_tours (
          id,
          title
        )
      `)
      .eq('id', backupId)
      .eq('user_id', userId)
      .single();

    if (error || !backupJob) {
      throw new Error('Backup not found or access denied');
    }

    const { data: queueData } = await adminClient
      .from('backup_queue')
      .select('status, attempts, error_message')
      .eq('backup_job_id', backupId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const progress = backupJob.total_items > 0 
      ? Math.round((backupJob.processed_items / backupJob.total_items) * 100)
      : 0;

    let downloadUrl = null;
    if (backupJob.status === 'completed' && backupJob.storage_path) {
      const { data: signedUrl } = await adminClient.storage
        .from('backups')
        .createSignedUrl(backupJob.storage_path, 3600);
      
      downloadUrl = signedUrl?.signedUrl;
    }

    const response = {
      backupId: backupJob.id,
      tourId: backupJob.tour_id,
      tourName: backupJob.virtual_tours?.title || 'Unknown Tour',
      jobType: backupJob.job_type,
      status: backupJob.status,
      queueStatus: queueData?.status,
      downloadUrl,
      fileSize: backupJob.file_size,
      fileHash: backupJob.file_hash,
      progress,
      processedItems: backupJob.processed_items,
      totalItems: backupJob.total_items,
      estimatedSize: backupJob.estimated_size_mb,
      createdAt: backupJob.created_at,
      completedAt: backupJob.completed_at,
      error: backupJob.error_message || queueData?.error_message,
      attempts: queueData?.attempts
    };

    console.log('✅ Backup status:', response);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('💥 Error in getBackupStatus:', error);
    throw error;
  }
}

async function cancelBackup(backupId: string, userId: string, adminClient: any) {
  console.log('🛑 Canceling backup:', backupId);

  try {
    const { data: backupJob, error: checkError } = await adminClient
      .from('backup_jobs')
      .select('id, status')
      .eq('id', backupId)
      .eq('user_id', userId)
      .single();

    if (checkError || !backupJob) {
      throw new Error('Backup not found or access denied');
    }

    if (backupJob.status === 'completed') {
      throw new Error('Cannot cancel completed backup');
    }

    const { error: jobError } = await adminClient
      .from('backup_jobs')
      .update({ 
        status: 'cancelled',
        completed_at: new Date().toISOString()
      })
      .eq('id', backupId);

    const { error: queueError } = await adminClient
      .from('backup_queue')
      .update({ 
        status: 'failed',
        error_message: 'Cancelled by user',
        completed_at: new Date().toISOString()
      })
      .eq('backup_job_id', backupId)
      .in('status', ['pending', 'processing', 'retry']);

    if (jobError && queueError) {
      throw new Error('Failed to cancel backup');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Backup cancelled successfully'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('💥 Error in cancelBackup:', error);
    throw error;
  }
}

async function processBackupInBackground(tour: any, backupJobId: string, backupType: string, userId: string, adminClient: any) {
  console.log(`🔄 Processing REAL backup via queue: ${tour.title}, job: ${backupJobId}`);

  try {
    // Actualizar estado a procesando
    await adminClient
      .from('backup_jobs')
      .update({
        status: 'processing',
        processed_items: 0,
        progress_percentage: 0
      })
      .eq('id', backupJobId);

    // Registrar inicio en logs
    await adminClient
      .from('backup_logs')
      .insert({
        backup_job_id: backupJobId,
        event_type: 'processing_started',
        message: 'Backup processing started',
        details: {
          tour_name: tour.title,
          backup_type: backupType,
          total_items: calculateTotalItems(tour, backupType)
        }
      });

    const zip = new JSZip();
    let processedItems = 0;
    const totalItems = calculateTotalItems(tour, backupType);

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
      
      console.log(`📈 Progress: ${progress}% (${processedItems}/${totalItems}) - ${message || ''}`);
    };

    await updateProgress(0, 'Preparing metadata');

    const tourMetadata = {
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
      })),
      hotspots: tour.floor_plans?.flatMap((plan: any) => 
        plan.hotspots?.map((hotspot: any) => ({
          id: hotspot.id,
          title: hotspot.title,
          floor_plan_id: hotspot.floor_plan_id,
          x_position: hotspot.x_position,
          y_position: hotspot.y_position
        })) || []
      ),
      export_info: {
        type: backupType,
        created_at: new Date().toISOString(),
        version: '1.0',
        total_items: totalItems
      }
    };

    zip.file('tour_metadata.json', JSON.stringify(tourMetadata, null, 2));
    await updateProgress(1, 'Metadata added');

    // Registrar progreso en logs
    await adminClient
      .from('backup_logs')
      .insert({
        backup_job_id: backupJobId,
        event_type: 'metadata_created',
        message: 'Tour metadata JSON generated',
        details: { items_count: totalItems }
      });

    if (backupType === 'full_backup') {
      for (const floorPlan of tour.floor_plans || []) {
        if (floorPlan.image_url) {
          try {
            const imagePath = extractPathFromUrl(floorPlan.image_url);
            const { data: imageBlob, error: imageError } = await adminClient.storage
              .from('tour-images')
              .download(imagePath);

            if (!imageError && imageBlob) {
              const arrayBuffer = await imageBlob.arrayBuffer();
              zip.file(`floor_plans/${floorPlan.name || floorPlan.id}.jpg`, new Uint8Array(arrayBuffer));
              console.log(`✅ Downloaded floor plan: ${floorPlan.name}`);
            }
          } catch (error) {
            console.warn(`⚠️ Could not download floor plan: ${floorPlan.name}`, error);
          }
        }
        processedItems++;
        await updateProgress(processedItems, 'Processing floor plans');
      }

      for (const floorPlan of tour.floor_plans || []) {
        for (const hotspot of floorPlan.hotspots || []) {
          for (const photo of hotspot.panorama_photos || []) {
            try {
              const imagePath = extractPathFromUrl(photo.photo_url);
              const { data: imageBlob, error: imageError } = await adminClient.storage
                .from('tour-images')
                .download(imagePath);

              if (!imageError && imageBlob) {
                const arrayBuffer = await imageBlob.arrayBuffer();
                const hotspotFolder = `hotspot_${hotspot.id}`;
                const fileName = photo.original_filename || `photo_${photo.id}.jpg`;
                zip.file(`panorama_photos/${hotspotFolder}/${fileName}`, new Uint8Array(arrayBuffer));
              }
            } catch (error) {
              console.warn(`⚠️ Could not download photo: ${photo.id}`, error);
            }
            processedItems++;
            if (processedItems % 5 === 0) {
              await updateProgress(processedItems, 'Downloading photos');
            }
          }
        }
      }
    }

    await updateProgress(totalItems - 1, 'Generating ZIP');

    const zipBlob = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    console.log(`✅ ZIP generated: ${zipBlob.length} bytes`);

    // Registrar generación de ZIP
    await adminClient
      .from('backup_logs')
      .insert({
        backup_job_id: backupJobId,
        event_type: 'zip_generated',
        message: 'ZIP archive generated successfully',
        details: { 
          file_size_bytes: zipBlob.length,
          file_size_mb: (zipBlob.length / (1024 * 1024)).toFixed(2)
        }
      });

    const timestamp = new Date().toISOString().split('T')[0];
    const storagePath = `${userId}/${backupJobId}/tour_backup_${tour.title.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.zip`;
    
    const { error: uploadError } = await adminClient.storage
      .from('backups')
      .upload(storagePath, zipBlob, {
        contentType: 'application/zip',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    console.log(`✅ Backup uploaded: ${storagePath}`);

    await adminClient
      .from('backup_jobs')
      .update({
        status: 'completed',
        processed_items: totalItems,
        progress_percentage: 100,
        file_size: zipBlob.length,
        storage_path: storagePath,
        completed_at: new Date().toISOString()
      })
      .eq('id', backupJobId);

    // Actualizar la cola
    await adminClient
      .from('backup_queue')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('backup_job_id', backupJobId);

    // Registrar finalización exitosa
    await adminClient
      .from('backup_logs')
      .insert({
        backup_job_id: backupJobId,
        event_type: 'processing_completed',
        message: 'Backup completed successfully',
        details: {
          storage_path: storagePath,
          file_size_bytes: zipBlob.length,
          processing_time_seconds: Math.round((Date.now() - new Date(tour.created_at).getTime()) / 1000)
        }
      });

    console.log(`✅ Backup completed via queue: ${backupJobId}`);

  } catch (error: any) {
    console.error(`💥 Error in queue backup ${backupJobId}:`, error);
    
    // Registrar error en logs
    await adminClient
      .from('backup_logs')
      .insert({
        backup_job_id: backupJobId,
        event_type: 'processing_error',
        message: 'Backup processing failed',
        details: {
          error_message: error.message,
          error_stack: error.stack,
          tour_name: tour.title
        },
        is_error: true
      });

    // Determinar si debe reintentar
    const { data: queueItem } = await adminClient
      .from('backup_queue')
      .select('attempts, max_attempts')
      .eq('backup_job_id', backupJobId)
      .maybeSingle();

    if (queueItem && queueItem.attempts >= queueItem.max_attempts) {
      // Máximo de reintentos alcanzado
      await adminClient
        .from('backup_jobs')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', backupJobId);

      await adminClient
        .from('backup_queue')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('backup_job_id', backupJobId);
    } else {
      // Programar reintento con backoff exponencial
      const delayMinutes = 5 * (queueItem?.attempts || 1);
      await adminClient
        .from('backup_jobs')
        .update({
          status: 'pending',
          error_message: error.message
        })
        .eq('id', backupJobId);

      await adminClient
        .from('backup_queue')
        .update({
          status: 'retry',
          error_message: error.message,
          scheduled_at: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString()
        })
        .eq('backup_job_id', backupJobId);
    }
  }
}

function calculateTotalItems(tour: any, backupType: string): number {
  const floorPlansCount = tour.floor_plans?.length || 0;
  let hotspotsCount = 0;
  let photosCount = 0;

  tour.floor_plans?.forEach((plan: any) => {
    hotspotsCount += plan.hotspots?.length || 0;
    plan.hotspots?.forEach((hotspot: any) => {
      photosCount += hotspot.panorama_photos?.length || 0;
    });
  });

  if (backupType === 'media_only') {
    return 1 + photosCount + floorPlansCount;
  }
  
  return 1 + photosCount + floorPlansCount + hotspotsCount;
}

function calculateEstimatedSize(tour: any, backupType: string): number {
  const baseSize = 1;
  let photosCount = 0;
  const floorPlansCount = tour.floor_plans?.length || 0;
  
  tour.floor_plans?.forEach((plan: any) => {
    plan.hotspots?.forEach((hotspot: any) => {
      photosCount += hotspot.panorama_photos?.length || 0;
    });
  });
  
  const mediaSize = (photosCount * 2) + (floorPlansCount * 1);
  
  return Math.ceil(baseSize + mediaSize);
}

async function processQueueItem(queueId: string, backupJobId: string, adminClient: any) {
  console.log('🔄 Processing queue item:', queueId, 'for backup job:', backupJobId);

  try {
    // Obtener información del backup job
    const { data: backupJob, error: jobError } = await adminClient
      .from('backup_jobs')
      .select('tour_id, user_id, job_type')
      .eq('id', backupJobId)
      .single();

    if (jobError || !backupJob) {
      throw new Error('Backup job not found');
    }

    // Obtener datos del tour
    const { data: fullTour, error: tourError } = await adminClient
      .from('virtual_tours')
      .select(`
        *,
        floor_plans (
          *,
          hotspots (
            *,
            panorama_photos (*)
          )
        )
      `)
      .eq('id', backupJob.tour_id)
      .single();

    if (tourError || !fullTour) {
      throw new Error('Tour not found');
    }

    // Iniciar procesamiento en background
    processBackupInBackground(fullTour, backupJobId, backupJob.job_type, backupJob.user_id, adminClient);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Backup processing started',
        queueId,
        backupJobId
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('💥 Error processing queue item:', error);
    
    // Marcar queue item como fallido
    await adminClient
      .from('backup_queue')
      .update({
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      })
      .eq('id', queueId);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

function extractPathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const objectIndex = pathParts.indexOf('object');
    if (objectIndex !== -1 && objectIndex + 2 < pathParts.length) {
      return pathParts.slice(objectIndex + 2).join('/');
    }
    return pathParts[pathParts.length - 1];
  } catch {
    return url.split('/').pop() || '';
  }
}
