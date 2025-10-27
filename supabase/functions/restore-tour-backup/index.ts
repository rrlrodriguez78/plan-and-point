import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Zod validation schemas
const RestoreFromDBSchema = z.object({
  backup_id: z.string().uuid({ message: 'Invalid backup_id format' }),
  restore_mode: z.enum(['full', 'additive'], { errorMap: () => ({ message: 'Invalid restore mode' }) }),
  is_file_upload: z.literal(false).optional()
});

const RestoreFromFileSchema = z.object({
  backup_data: z.any(),
  restore_mode: z.enum(['full', 'additive'], { errorMap: () => ({ message: 'Invalid restore mode' }) }),
  tenant_id: z.string().uuid({ message: 'Invalid tenant_id format' }),
  is_file_upload: z.literal(true)
});

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

    const body = await req.json();
    
    // Determine if it's a file upload or database restore
    const isFileUpload = body.is_file_upload === true;
    
    let validation;
    if (isFileUpload) {
      validation = RestoreFromFileSchema.safeParse(body);
    } else {
      validation = RestoreFromDBSchema.safeParse(body);
    }
    
    if (!validation.success) {
      console.error('Validation error:', validation.error.flatten());
      return new Response(
        JSON.stringify({ 
          error: 'Validation failed', 
          details: validation.error.flatten().fieldErrors 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let backupData: any;
    let tenantId: string;
    let restore_mode: 'full' | 'additive';

    if (isFileUpload) {
      const { backup_data, tenant_id, restore_mode: mode } = validation.data as z.infer<typeof RestoreFromFileSchema>;
      
      // Verify user belongs to tenant
      const { data: tenantCheck } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('tenant_id', tenant_id)
        .eq('user_id', user.id)
        .single();

      if (!tenantCheck) {
        throw new Error('User does not belong to this tenant');
      }

      backupData = backup_data;
      tenantId = tenant_id;
      restore_mode = mode;
      
      console.log(`Restoring from uploaded file in ${restore_mode} mode for user ${user.id}`);
    } else {
      const { backup_id, restore_mode: mode } = validation.data as z.infer<typeof RestoreFromDBSchema>;
      restore_mode = mode;

      console.log(`Restoring backup ${backup_id} in ${restore_mode} mode for user ${user.id}`);

      // Get backup from database
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

      backupData = backup.backup_data;
      tenantId = backup.tenant_id;

      // Log the restoration for DB backup
      await supabase.from('backup_logs').insert({
        backup_id: backup.id,
        user_id: user.id,
        action: 'restored',
        details: {
          restore_mode,
          source: 'database'
        },
      });
    }
    const tours = backupData.tours || [];

    console.log(`Restoring ${tours.length} tours`);

    // Full mode: delete existing tours
    if (restore_mode === 'full') {
      const { error: deleteError } = await supabase
        .from('virtual_tours')
        .delete()
        .eq('tenant_id', tenantId);

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
          tenant_id: tenantId,
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
              tenant_id: tenantId,
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

    // Log the restoration for file uploads
    if (isFileUpload) {
      await supabase.from('backup_logs').insert({
        user_id: user.id,
        action: 'restored',
        details: {
          restore_mode,
          tours_restored: restoredCount,
          total_tours: tours.length,
          source: 'file_upload'
        },
      });
    }

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
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});