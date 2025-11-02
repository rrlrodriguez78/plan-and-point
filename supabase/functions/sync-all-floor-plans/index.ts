import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { tourId, tenantId } = await req.json();

    if (!tourId || !tenantId) {
      throw new Error('tourId and tenantId are required');
    }

    console.log('🔄 Starting batch floor plan sync:', { tourId, tenantId });

    // Verify active Google Drive destination
    const { data: destination, error: destError } = await supabase
      .from('backup_destinations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('cloud_provider', 'google_drive')
      .eq('is_active', true)
      .single();

    if (destError || !destination) {
      throw new Error('No active Google Drive destination found');
    }

    // Get all floor plans for this tour
    const { data: floorPlans, error: floorPlansError } = await supabase
      .from('floor_plans')
      .select('*')
      .eq('tour_id', tourId);

    if (floorPlansError) {
      throw new Error(`Failed to fetch floor plans: ${floorPlansError.message}`);
    }

    if (!floorPlans || floorPlans.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No floor plans found for this tour',
          synced: 0,
          failed: 0,
          total: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter floor plans that haven't been synced or need re-sync
    const { data: existingMappings } = await supabase
      .from('cloud_file_mappings')
      .select('floor_plan_id')
      .eq('tour_id', tourId)
      .not('floor_plan_id', 'is', null);

    const syncedFloorPlanIds = new Set(existingMappings?.map(m => m.floor_plan_id) || []);
    const floorPlansToSync = floorPlans.filter(fp => fp.image_url);

    console.log('📊 Sync status:', {
      total: floorPlans.length,
      alreadySynced: syncedFloorPlanIds.size,
      toSync: floorPlansToSync.length
    });

    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    // Sync each floor plan
    for (const floorPlan of floorPlansToSync) {
      try {
        console.log(`🔄 Syncing floor plan ${floorPlan.id} (attempt 1/3)`);

        const { data: syncData, error: syncError } = await supabase.functions.invoke(
          'photo-sync-to-drive',
          {
            body: {
              action: 'sync_floor_plan',
              floorPlanId: floorPlan.id,
              imageUrl: floorPlan.image_url,
              tourId: tourId,
              tenantId: tenantId,
              fileName: floorPlan.image_url.split('/').pop() || `floor_plan_${floorPlan.id}.webp`
            }
          }
        );

        if (syncError) {
          throw syncError;
        }

        console.log(`✅ Floor plan ${floorPlan.id} synced successfully`);
        synced++;
      } catch (error: any) {
        console.error(`❌ Failed to sync floor plan ${floorPlan.id}:`, error);
        failed++;
        errors.push(`Floor plan ${floorPlan.name || floorPlan.id}: ${error.message}`);
      }
    }

    console.log('✅ Batch floor plan sync completed:', { synced, failed, total: floorPlansToSync.length });

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        failed,
        total: floorPlansToSync.length,
        alreadySynced: syncedFloorPlanIds.size,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Batch floor plan sync failed:', error);
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
});
