import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RestoreRequest {
  backup_id: string;
  restore_mode: 'full' | 'additive';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const body: RestoreRequest = await req.json();
    const { backup_id, restore_mode } = body;

    console.log(`Restoring backup ${backup_id} in ${restore_mode} mode for user ${user.id}`);

    // Get backup
    const { data: backup, error: backupError } = await supabase
      .from('tour_backups')
      .select('*')
      .eq('id', backup_id)
      .eq('user_id', user.id)
      .single();

    if (backupError || !backup) {
      throw new Error('Backup not found or access denied');
    }

    if (!backup.can_restore) {
      throw new Error('This backup cannot be restored');
    }

    if (backup.restore_expiry && new Date(backup.restore_expiry) < new Date()) {
      throw new Error('Backup has expired');
    }

    const backupData = backup.backup_data as any;
    const tours = backupData.tours || [];

    console.log(`Restoring ${tours.length} tours`);

    // Full mode: delete existing tours
    if (restore_mode === 'full') {
      const { error: deleteError } = await supabase
        .from('virtual_tours')
        .delete()
        .eq('tenant_id', backup.tenant_id);

      if (deleteError) {
        console.error('Error deleting existing tours:', deleteError);
      }
    }

    // Restore tours
    let restoredCount = 0;
    for (const tour of tours) {
      // Remove IDs to create new records
      const { id: tourId, created_at, updated_at, floor_plans, ...tourData } = tour;

      const { data: newTour, error: tourError } = await supabase
        .from('virtual_tours')
        .insert({
          ...tourData,
          tenant_id: backup.tenant_id,
        })
        .select()
        .single();

      if (tourError) {
        console.error(`Error restoring tour: ${tourError.message}`);
        continue;
      }

      // Restore floor plans
      if (floor_plans && Array.isArray(floor_plans)) {
        for (const floorPlan of floor_plans) {
          const { id: fpId, created_at: fpCreated, hotspots, ...fpData } = floorPlan;

          const { data: newFloorPlan, error: fpError } = await supabase
            .from('floor_plans')
            .insert({
              ...fpData,
              tour_id: newTour.id,
              tenant_id: backup.tenant_id,
            })
            .select()
            .single();

          if (fpError) {
            console.error(`Error restoring floor plan: ${fpError.message}`);
            continue;
          }

          // Restore hotspots
          if (hotspots && Array.isArray(hotspots)) {
            for (const hotspot of hotspots) {
              const { id: hId, created_at: hCreated, panorama_photos, ...hData } = hotspot;

              const { data: newHotspot, error: hError } = await supabase
                .from('hotspots')
                .insert({
                  ...hData,
                  floor_plan_id: newFloorPlan.id,
                })
                .select()
                .single();

              if (hError) {
                console.error(`Error restoring hotspot: ${hError.message}`);
                continue;
              }

              // Restore panorama photos
              if (panorama_photos && Array.isArray(panorama_photos)) {
                const photosToInsert = panorama_photos.map((photo: any) => {
                  const { id: pId, created_at: pCreated, ...pData } = photo;
                  return {
                    ...pData,
                    hotspot_id: newHotspot.id,
                  };
                });

                const { error: pError } = await supabase
                  .from('panorama_photos')
                  .insert(photosToInsert);

                if (pError) {
                  console.error(`Error restoring panorama photos: ${pError.message}`);
                }
              }
            }
          }
        }
      }

      restoredCount++;
    }

    // Log the restoration
    await supabase.from('backup_logs').insert({
      backup_id: backup.id,
      user_id: user.id,
      action: 'restored',
      details: {
        restore_mode,
        tours_restored: restoredCount,
        total_tours: tours.length,
      },
    });

    // Create notification
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'backup_restored',
      title: 'Backup restaurado',
      message: `Se han restaurado ${restoredCount} tours exitosamente`,
    });

    console.log(`Restoration completed: ${restoredCount}/${tours.length} tours restored`);

    return new Response(
      JSON.stringify({
        success: true,
        tours_restored: restoredCount,
        total_tours: tours.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Restoration error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});