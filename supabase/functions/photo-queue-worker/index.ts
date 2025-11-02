import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const BATCH_SIZE = 5; // Procesar 5 fotos por invocación del worker

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  console.log('🔄 Photo queue worker started');
  
  try {
    // 1. Obtener próximas fotos a procesar
    const { data: queueItems, error: queueError } = await supabase
      .rpc('get_next_photos_to_process', { p_batch_size: BATCH_SIZE });
    
    if (queueError) {
      console.error('Error getting queue items:', queueError);
      throw queueError;
    }
    
    if (!queueItems || queueItems.length === 0) {
      console.log('✅ No pending photos in queue');
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending photos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`📦 Processing batch of ${queueItems.length} photos`);
    
    let successCount = 0;
    let failCount = 0;
    const tourJobMap = new Map<string, string>(); // tour_id -> job_id
    
    // 2. Procesar cada foto del batch
    for (const item of queueItems) {
      console.log(`🔄 Processing photo ${item.photo_id} (attempt ${item.attempts + 1})`);
      
      // FASE 2: Verificar si el job sigue activo antes de procesar
      const { data: jobStatus } = await supabase
        .from('sync_jobs')
        .select('status')
        .eq('tour_id', item.tour_id)
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (!jobStatus) {
        console.log(`⏭️ Skipping photo ${item.photo_id} - job no longer active`);
        // Marcar como failed porque el job fue cancelado
        await supabase.rpc('update_queue_item_status', {
          p_queue_id: item.id,
          p_status: 'failed',
          p_error_message: 'Job was cancelled or completed'
        });
        continue;
      }
      
      // Marcar como processing
      await supabase.rpc('update_queue_item_status', {
        p_queue_id: item.id,
        p_status: 'processing'
      });
      
      try {
        // Llamar a photo-sync-to-drive para sincronizar la foto individual
        const { data: syncResult, error: syncError } = await supabase.functions.invoke(
          'photo-sync-to-drive',
          {
            body: {
              action: 'sync_photo',
              photoId: item.photo_id,
              tenantId: item.tenant_id
            }
          }
        );
        
        if (syncError) {
          throw new Error(`Invoke error: ${syncError.message}`);
        }
        
        if (!syncResult?.success) {
          throw new Error(syncResult?.error || 'Sync failed without error message');
        }
        
        // Marcar como completado
        await supabase.rpc('update_queue_item_status', {
          p_queue_id: item.id,
          p_status: 'completed'
        });
        
        successCount++;
        console.log(`✅ Photo ${item.photo_id} synced successfully`);
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ Failed to sync photo ${item.photo_id}:`, errorMsg);
        
        // Determinar si debe reintentar o marcar como failed permanente
        const shouldRetry = item.attempts + 1 < 3; // max_attempts = 3
        
        await supabase.rpc('update_queue_item_status', {
          p_queue_id: item.id,
          p_status: shouldRetry ? 'pending' : 'failed',
          p_error_message: errorMsg
        });
        
        if (!shouldRetry) {
          failCount++;
        }
      }
      
      // 3. Actualizar progreso en sync_jobs
      // Obtener el job_id para este tour (caché para evitar múltiples queries)
      if (!tourJobMap.has(item.tour_id)) {
        const { data: jobData } = await supabase
          .from('sync_jobs')
          .select('id, processed_items, failed_items')
          .eq('tour_id', item.tour_id)
          .eq('status', 'processing')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (jobData) {
          tourJobMap.set(item.tour_id, jobData.id);
        }
      }
      
      const jobId = tourJobMap.get(item.tour_id);
      if (jobId) {
        // Incrementar processed_items y failed_items según corresponda
        const { data: currentJob } = await supabase
          .from('sync_jobs')
          .select('processed_items, failed_items')
          .eq('id', jobId)
          .single();
        
        if (currentJob) {
          await supabase
            .from('sync_jobs')
            .update({
              processed_items: currentJob.processed_items + 1,
              failed_items: failCount > 0 ? currentJob.failed_items + 1 : currentJob.failed_items
            })
            .eq('id', jobId);
        }
      }
    }
    
    console.log(`✅ Batch processed: ${successCount} success, ${failCount} failed`);
    
    // 4. Verificar si quedan fotos pendientes en la cola por cada tour
    const processedTours: Set<string> = new Set();
    queueItems.forEach((item: any) => processedTours.add(item.tour_id));
    
    for (const tourId of Array.from(processedTours)) {
      const { count: remainingCount } = await supabase
        .from('photo_sync_queue')
        .select('id', { count: 'exact', head: true })
        .eq('tour_id', tourId)
        .eq('status', 'pending');
      
      console.log(`Tour ${tourId}: ${remainingCount || 0} photos remaining in queue`);
      
      // Si no quedan fotos pendientes, marcar el job como completado
      if (remainingCount === 0) {
        const jobId = tourJobMap.get(tourId);
        if (jobId) {
          const { data: finalJob } = await supabase
            .from('sync_jobs')
            .select('total_items, processed_items, failed_items')
            .eq('id', jobId)
            .single();
          
          if (finalJob) {
            const finalStatus = finalJob.failed_items === 0 ? 'completed' : 
                               finalJob.failed_items < finalJob.total_items ? 'completed' : 'failed';
            
            await supabase
              .from('sync_jobs')
              .update({
                status: finalStatus,
                completed_at: new Date().toISOString()
              })
              .eq('id', jobId);
            
            console.log(`🎉 Sync job ${jobId} marked as ${finalStatus}`);
          }
        }
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true,
        processed: successCount + failCount,
        successful: successCount,
        failed: failCount,
        message: `Processed ${successCount + failCount} photos`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('❌ Worker error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
