import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Background processing function
async function processBatchSync(
  jobId: string,
  tourId: string,
  tenantId: string,
  photosToSync: any[],
  supabase: any
) {
  const results = {
    synced: 0,
    failed: 0,
    errors: [] as { photoId: string; error: string }[]
  };

  for (let i = 0; i < photosToSync.length; i++) {
    const photo = photosToSync[i];
    
    // Check if job was cancelled
    const { data: job } = await supabase
      .from('sync_jobs')
      .select('status')
      .eq('id', jobId)
      .single();
    
    if (job?.status === 'cancelled') {
      console.log(`⛔ Job ${jobId} was cancelled, stopping sync`);
      break;
    }

    console.log(`📤 Processing photo ${i + 1}/${photosToSync.length}: ${photo.id}`);

    let attempts = 0;
    let success = false;
    const maxAttempts = 3;

    while (attempts < maxAttempts && !success) {
      attempts++;
      
      try {
        console.log(`🔄 Syncing photo ${photo.id} (${i + 1}/${photosToSync.length}) - attempt ${attempts}/${maxAttempts}`);

        const { data: syncResult, error: syncError } = await supabase.functions.invoke(
          'photo-sync-to-drive',
          {
            body: {
              action: 'sync_photo',
              photoId: photo.id,
              tenantId: tenantId
            }
          }
        );

        if (syncError) {
          throw new Error(syncError.message);
        }

        if (syncResult?.success) {
          results.synced++;
          success = true;
          console.log(`✅ Photo ${photo.id} synced successfully`);
        } else {
          throw new Error(syncResult?.error || 'Unknown sync error');
        }

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`⚠️ Attempt ${attempts} failed for photo ${photo.id}:`, errorMsg);
        
        if (attempts >= maxAttempts) {
          results.failed++;
          results.errors.push({
            photoId: photo.id,
            error: errorMsg
          });
          console.error(`❌ Photo ${photo.id} failed after ${maxAttempts} attempts`);
        } else {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
    }

    // Update progress
    await supabase
      .from('sync_jobs')
      .update({
        processed_items: results.synced + results.failed,
        failed_items: results.failed,
        error_messages: results.errors
      })
      .eq('id', jobId);
  }

  // Mark job as completed or failed
  const finalStatus = results.failed === photosToSync.length ? 'failed' : 'completed';
  await supabase
    .from('sync_jobs')
    .update({
      status: finalStatus,
      processed_items: results.synced + results.failed,
      failed_items: results.failed,
      error_messages: results.errors,
      completed_at: new Date().toISOString()
    })
    .eq('id', jobId);

  console.log(`✅ Background job ${jobId} completed:`, {
    synced: results.synced,
    failed: results.failed,
    total: photosToSync.length
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action, tourId, tenantId, jobId } = body;
    console.log(`📥 Received request - Action: ${action}, JobID: ${jobId}, TourID: ${tourId}`);

    // Handle resume_job action
    if (action === 'resume_job') {
      console.log(`🔄 Resuming stalled job: ${jobId}`);
      
      if (!jobId) {
        return new Response(
          JSON.stringify({ error: 'jobId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: existingJob, error: jobError } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !existingJob) {
        console.error('Job not found:', jobError);
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get photos that still need syncing
      const { data: photos } = await supabase
        .from('panorama_photos')
        .select(`
          id,
          hotspot_id,
          hotspots!inner(
            floor_plan_id,
            floor_plans!inner(
              tour_id
            )
          )
        `)
        .eq('hotspots.floor_plans.tour_id', existingJob.tour_id);

      const { data: alreadySynced } = await supabase
        .from('cloud_file_mappings')
        .select('photo_id')
        .in('photo_id', (photos || []).map(p => p.id));

      const syncedIds = new Set((alreadySynced || []).map(m => m.photo_id));
      const photosToSync = (photos || []).filter(p => !syncedIds.has(p.id));

      console.log(`📊 Resume status: ${photosToSync.length} photos remaining`);

      // Reset job status to processing
      await supabase
        .from('sync_jobs')
        .update({ 
          status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      // Start background processing from remaining photos
      // @ts-ignore
      if (typeof EdgeRuntime !== 'undefined') {
        // @ts-ignore
        EdgeRuntime.waitUntil(
          processBatchSync(jobId, existingJob.tour_id, existingJob.tenant_id, photosToSync, supabase)
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Job resumed',
          jobId: jobId,
          remainingPhotos: photosToSync.length,
          totalItems: existingJob.total_items
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle get_progress action
    if (action === 'get_progress') {
      // Get job progress
      const { data: job, error: jobError } = await supabase
        .from('sync_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (jobError || !job) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Job not found'
          }),
          { 
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          job
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'cancel_job') {
      // Cancel job
      const { error: cancelError } = await supabase
        .from('sync_jobs')
        .update({ 
          status: 'cancelled', 
          completed_at: new Date().toISOString() 
        })
        .eq('id', jobId);

      if (cancelError) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: cancelError.message
          }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Job cancelled'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default action: start_job
    console.log('🔄 Starting batch photo sync:', { tourId, tenantId });

    // 1. Verificar que existe un destination activo
    const { data: destination, error: destError } = await supabase
      .from('backup_destinations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('cloud_provider', 'google_drive')
      .single();

    if (destError || !destination) {
      throw new Error('No active Google Drive destination found');
    }

    // 2. Obtener todas las fotos del tour que NO están sincronizadas
    console.log(`📸 Fetching photos for tour: ${tourId}`);
    const { data: photos, error: photosError } = await supabase
      .from('panorama_photos')
      .select(`
        id,
        hotspot_id,
        hotspots!inner(
          floor_plan_id,
          floor_plans!inner(
            tour_id
          )
        )
      `)
      .eq('hotspots.floor_plans.tour_id', tourId);

    if (photosError) {
      throw new Error(`Failed to fetch photos: ${photosError.message}`);
    }

    console.log(`Found ${photos?.length || 0} total photos`);

    if (!photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No photos found for this tour',
          jobId: null,
          totalPhotos: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Filtrar fotos ya sincronizadas
    const photoIds = photos.map(p => p.id);
    const { data: alreadySynced } = await supabase
      .from('cloud_file_mappings')
      .select('photo_id')
      .in('photo_id', photoIds);

    const syncedIds = new Set((alreadySynced || []).map(m => m.photo_id));
    const photosToSync = photos.filter(p => !syncedIds.has(p.id));

    console.log('📊 Sync status:', {
      total: photos.length,
      alreadySynced: syncedIds.size,
      toSync: photosToSync.length
    });

    if (photosToSync.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'All photos already synced',
          jobId: null,
          totalPhotos: photos.length,
          alreadySynced: photos.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Crear job en la base de datos
    const { data: newJob, error: jobError } = await supabase
      .from('sync_jobs')
      .insert({
        tenant_id: tenantId,
        tour_id: tourId,
        job_type: 'photo_batch_sync',
        status: 'processing',
        total_items: photosToSync.length,
        processed_items: 0,
        failed_items: 0
      })
      .select()
      .single();

    if (jobError || !newJob) {
      throw new Error('Failed to create sync job');
    }

    console.log(`✅ Created job ${newJob.id} for ${photosToSync.length} photos`);

    // 5. Iniciar procesamiento en background
    // @ts-ignore - EdgeRuntime is available in Deno Deploy
    if (typeof EdgeRuntime !== 'undefined') {
      // @ts-ignore
      EdgeRuntime.waitUntil(
        processBatchSync(newJob.id, tourId, tenantId, photosToSync, supabase)
      );
    } else {
      // Fallback for local development
      processBatchSync(newJob.id, tourId, tenantId, photosToSync, supabase).catch(err => {
        console.error('Background processing error:', err);
      });
    }

    // 6. Devolver respuesta inmediata con jobId
    return new Response(
      JSON.stringify({ 
        success: true,
        jobId: newJob.id,
        totalPhotos: photosToSync.length,
        alreadySynced: syncedIds.size,
        message: 'Sync job started in background'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Batch sync failed:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
