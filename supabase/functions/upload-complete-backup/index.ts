import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageData {
  path: string;
  data: string; // base64
  contentType: string;
}

interface CompleteBackup {
  version: string;
  backup_id: string;
  backup_name: string;
  created_at: string;
  backup_data: any;
  images: ImageData[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { complete_backup_json, restore_mode = 'additive', tenant_id } = await req.json();
    
    if (!complete_backup_json || !tenant_id) {
      throw new Error('complete_backup_json and tenant_id are required');
    }

    // Parse JSON if it's a string
    const complete_backup = typeof complete_backup_json === 'string' 
      ? JSON.parse(complete_backup_json) 
      : complete_backup_json;

    const backupData: CompleteBackup = complete_backup;
    console.log('Restoring complete backup:', backupData.backup_name);
    console.log(`Processing ${backupData.images?.length || 0} images`);

    // Verify user belongs to tenant
    const { data: membership, error: membershipError } = await supabase
      .from('tenant_users')
      .select('role')
      .eq('tenant_id', tenant_id)
      .eq('user_id', user.id)
      .single();

    if (membershipError || !membership) {
      throw new Error('User does not belong to this tenant');
    }

    // Step 1: Upload all images to storage
    const urlMapping: Record<string, string> = {};
    let uploadedCount = 0;

    for (const image of backupData.images || []) {
      try {
        const imageData = decodeBase64(image.data);
        
        // Generate new unique path
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const extension = image.path.split('.').pop();
        const newPath = `${tenant_id}/${timestamp}-${random}.${extension}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('tour-images')
          .upload(newPath, imageData, {
            contentType: image.contentType,
            upsert: false
          });

        if (uploadError) {
          console.error(`Failed to upload ${image.path}:`, uploadError);
          continue;
        }

        // Get new public URL
        const { data: { publicUrl } } = supabase.storage
          .from('tour-images')
          .getPublicUrl(newPath);

        // Map old path to new URL
        const oldUrl = `tour-images/${image.path}`;
        urlMapping[oldUrl] = publicUrl;
        urlMapping[image.path] = publicUrl;
        
        // Also map any full URLs
        const fullUrlPattern = new RegExp(`/tour-images/${image.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
        urlMapping[fullUrlPattern.toString()] = publicUrl;

        uploadedCount++;
        console.log(`Uploaded: ${image.path} -> ${newPath}`);
      } catch (err) {
        console.error(`Error uploading ${image.path}:`, err);
      }
    }

    console.log(`Successfully uploaded ${uploadedCount}/${backupData.images?.length || 0} images`);

    // Step 2: Update URLs in backup data
    const updateUrls = (obj: any): any => {
      if (typeof obj === 'string') {
        // Check if string is a URL that needs updating
        for (const [oldUrl, newUrl] of Object.entries(urlMapping)) {
          if (obj.includes(oldUrl)) {
            return obj.replace(oldUrl, newUrl);
          }
        }
        return obj;
      }
      
      if (Array.isArray(obj)) {
        return obj.map(updateUrls);
      }
      
      if (obj && typeof obj === 'object') {
        const updated: any = {};
        for (const [key, value] of Object.entries(obj)) {
          updated[key] = updateUrls(value);
        }
        return updated;
      }
      
      return obj;
    };

    const updatedBackupData = updateUrls(backupData.backup_data);

    // Step 3: Delete existing tours if full restore
    if (restore_mode === 'full') {
      console.log('Performing full restore - deleting existing tours');
      const { error: deleteError } = await supabase
        .from('virtual_tours')
        .delete()
        .eq('tenant_id', tenant_id);

      if (deleteError) {
        console.error('Error deleting existing tours:', deleteError);
      }
    }

    // Step 4: Restore tour data
    let restoredTours = 0;
    let restoredFloors = 0;
    let restoredHotspots = 0;

    for (const tour of updatedBackupData.tours) {
      const { floor_plans, ...tourData } = tour;
      
      // Insert tour
      const { data: newTour, error: tourError } = await supabase
        .from('virtual_tours')
        .insert({
          ...tourData,
          tenant_id: tenant_id,
          id: undefined // Let DB generate new ID
        })
        .select()
        .single();

      if (tourError) {
        console.error('Error inserting tour:', tourError);
        continue;
      }

      restoredTours++;

      // Insert floor plans
      for (const floor of floor_plans || []) {
        const { hotspots, ...floorData } = floor;
        
        const { data: newFloor, error: floorError } = await supabase
          .from('floor_plans')
          .insert({
            ...floorData,
            tour_id: newTour.id,
            id: undefined
          })
          .select()
          .single();

        if (floorError) {
          console.error('Error inserting floor plan:', floorError);
          continue;
        }

        restoredFloors++;

        // Insert hotspots
        for (const hotspot of hotspots || []) {
          const { panorama_photos, ...hotspotData } = hotspot;
          
          const { data: newHotspot, error: hotspotError } = await supabase
            .from('hotspots')
            .insert({
              ...hotspotData,
              floor_plan_id: newFloor.id,
              id: undefined
            })
            .select()
            .single();

          if (hotspotError) {
            console.error('Error inserting hotspot:', hotspotError);
            continue;
          }

          restoredHotspots++;

          // Insert panorama photos
          for (const photo of panorama_photos || []) {
            await supabase
              .from('panorama_photos')
              .insert({
                ...photo,
                hotspot_id: newHotspot.id,
                id: undefined
              });
          }
        }
      }
    }

    // Log the restoration
    await supabase.from('backup_logs').insert({
      backup_id: backupData.backup_id,
      action: 'complete_restore',
      status: 'success',
      details: `Restored ${restoredTours} tours, ${restoredFloors} floors, ${restoredHotspots} hotspots, ${uploadedCount} images`,
      performed_by: user.id
    });

    // Create notification
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'backup_restored',
      title: 'Backup completo restaurado',
      message: `Se restauraron ${restoredTours} tours con ${uploadedCount} imágenes desde "${backupData.backup_name}"`,
      metadata: {
        backup_id: backupData.backup_id,
        tours_restored: restoredTours,
        images_restored: uploadedCount
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        restored: {
          tours: restoredTours,
          floors: restoredFloors,
          hotspots: restoredHotspots,
          images: uploadedCount
        },
        url_mapping: urlMapping
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in upload-complete-backup:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});