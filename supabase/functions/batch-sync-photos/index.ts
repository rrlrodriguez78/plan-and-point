import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { tourId, tenantId } = await req.json();

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

    if (!photos || photos.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No photos found for this tour',
          synced: 0,
          failed: 0,
          total: 0
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
          synced: 0,
          failed: 0,
          total: photos.length,
          alreadySynced: photos.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Sincronizar cada foto con retry logic
    const results = {
      synced: 0,
      failed: 0,
      errors: [] as { photoId: string; error: string }[]
    };

    for (const photo of photosToSync) {
      let attempts = 0;
      let success = false;
      const maxAttempts = 3;

      while (attempts < maxAttempts && !success) {
        attempts++;
        
        try {
          console.log(`🔄 Syncing photo ${photo.id} (attempt ${attempts}/${maxAttempts})`);

          // Llamar al edge function de sync individual
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
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
          }
        }
      }
    }

    console.log('✅ Batch sync completed:', {
      synced: results.synced,
      failed: results.failed,
      total: photosToSync.length
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        synced: results.synced,
        failed: results.failed,
        total: photosToSync.length,
        alreadySynced: syncedIds.size,
        errors: results.errors
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
