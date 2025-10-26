import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackupRequest {
  tenant_id: string;
  backup_type: 'manual' | 'automatic';
  backup_name?: string;
  notes?: string;
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

    const body: BackupRequest = await req.json();
    const { tenant_id, backup_type, backup_name, notes } = body;

    console.log(`Creating backup for tenant ${tenant_id}, user ${user.id}`);

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

    // Get tenant info
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenant_id)
      .single();

    // Fetch all tours with their complete data
    const { data: tours } = await supabase
      .from('virtual_tours')
      .select(`
        *,
        floor_plans:floor_plans(
          *,
          hotspots:hotspots(
            *,
            panorama_photos:panorama_photos(*)
          )
        )
      `)
      .eq('tenant_id', tenant_id);

    console.log(`Found ${tours?.length || 0} tours to backup`);

    // Collect all media URLs
    const mediaFiles: string[] = [];
    let mediaCount = 0;

    tours?.forEach(tour => {
      if (tour.cover_image_url) mediaFiles.push(tour.cover_image_url);
      if (tour.share_image_url) mediaFiles.push(tour.share_image_url);
      
      tour.floor_plans?.forEach((fp: any) => {
        if (fp.image_url) mediaFiles.push(fp.image_url);
        
        fp.hotspots?.forEach((h: any) => {
          if (h.media_url) mediaFiles.push(h.media_url);
          
          h.panorama_photos?.forEach((p: any) => {
            if (p.photo_url) mediaFiles.push(p.photo_url);
            if (p.photo_url_mobile) mediaFiles.push(p.photo_url_mobile);
            if (p.photo_url_thumbnail) mediaFiles.push(p.photo_url_thumbnail);
            mediaCount += 3;
          });
        });
      });
    });

    // Calculate statistics
    const statistics = {
      tours_count: tours?.length || 0,
      floor_plans_count: tours?.reduce((acc, t) => acc + (t.floor_plans?.length || 0), 0) || 0,
      hotspots_count: tours?.reduce((acc, t) => 
        acc + (t.floor_plans?.reduce((facc: number, fp: any) => 
          facc + (fp.hotspots?.length || 0), 0) || 0), 0) || 0,
      panorama_photos_count: tours?.reduce((acc, t) => 
        acc + (t.floor_plans?.reduce((facc: number, fp: any) => 
          facc + (fp.hotspots?.reduce((hacc: number, h: any) => 
            hacc + (h.panorama_photos?.length || 0), 0) || 0), 0) || 0), 0) || 0,
      total_media_files: mediaFiles.length,
      estimated_size_mb: 0,
    };

    // Create backup data structure
    const backupData: any = {
      backup_version: '1.0',
      created_at: new Date().toISOString(),
      tenant: {
        id: tenant?.id,
        name: tenant?.name,
        owner_id: tenant?.owner_id,
        settings: tenant?.settings,
      },
      tours: tours || [],
      media_files: [...new Set(mediaFiles)],
      statistics,
    };

    const estimatedSize = JSON.stringify(backupData).length;
    backupData.statistics.estimated_size_mb = Math.round((estimatedSize / 1024 / 1024) * 100) / 100;

    // Create backup record
    const { data: backup, error: backupError } = await supabase
      .from('tour_backups')
      .insert({
        user_id: user.id,
        tenant_id,
        backup_name: backup_name || `Backup ${new Date().toLocaleDateString()}`,
        backup_type,
        backup_status: 'completed',
        backup_data: backupData,
        included_files: mediaFiles,
        total_size_bytes: estimatedSize,
        tours_count: tours?.length || 0,
        media_files_count: mediaFiles.length,
        completed_at: new Date().toISOString(),
        notes,
      })
      .select()
      .single();

    if (backupError) throw backupError;

    // Log the backup creation
    await supabase.from('backup_logs').insert({
      backup_id: backup.id,
      user_id: user.id,
      action: 'created',
      details: {
        tours_count: tours?.length,
        size_bytes: estimatedSize,
      },
    });

    console.log(`Backup created successfully: ${backup.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        backup_id: backup.id,
        statistics: backupData.statistics,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Backup creation error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});