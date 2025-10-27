import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BackupData {
  tenant: any;
  tours: any[];
  media_files: string[];
  statistics: any;
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

    const { backup_id } = await req.json();
    if (!backup_id) {
      throw new Error('backup_id is required');
    }

    console.log('Downloading complete backup:', backup_id);

    // Get backup data
    const { data: backup, error: backupError } = await supabase
      .from('tour_backups')
      .select('*')
      .eq('id', backup_id)
      .eq('user_id', user.id)
      .single();

    if (backupError || !backup) {
      throw new Error('Backup not found or access denied');
    }

    const backupData = backup.backup_data as BackupData;
    const mediaFiles = backupData.media_files || [];

    console.log(`Processing ${mediaFiles.length} media files`);

    // Download all images from storage
    const images: { path: string; data: Uint8Array; contentType: string }[] = [];
    
    for (const url of mediaFiles) {
      try {
        // Extract path from URL
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/tour-images\/(.+)/);
        if (!pathMatch) continue;
        
        const filePath = pathMatch[1];
        
        // Download from storage
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('tour-images')
          .download(filePath);

        if (downloadError) {
          console.error(`Failed to download ${filePath}:`, downloadError);
          continue;
        }

        // Convert to Uint8Array
        const arrayBuffer = await fileData.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Detect content type
        const contentType = fileData.type || 'image/jpeg';
        
        images.push({
          path: filePath,
          data: uint8Array,
          contentType
        });

        console.log(`Downloaded: ${filePath} (${uint8Array.length} bytes)`);
      } catch (err) {
        console.error(`Error processing ${url}:`, err);
      }
    }

    console.log(`Successfully downloaded ${images.length}/${mediaFiles.length} images`);

    // Create the complete backup package
    const completeBackup = {
      version: '1.0',
      backup_id: backup.id,
      backup_name: backup.backup_name,
      created_at: backup.created_at,
      backup_data: backupData,
      images: images.map(img => ({
        path: img.path,
        data: encodeBase64(img.data),
        contentType: img.contentType
      }))
    };

    // Log the download
    await supabase.from('backup_logs').insert({
      backup_id: backup.id,
      action: 'complete_download',
      status: 'success',
      details: `Downloaded ${images.length} images`,
      performed_by: user.id
    });

    // Update backup format
    await supabase
      .from('tour_backups')
      .update({ backup_format: 'complete-zip' })
      .eq('id', backup_id);

    return new Response(
      JSON.stringify(completeBackup),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="backup-complete-${backup.backup_name}-${backup.id}.json"`
        }
      }
    );

  } catch (error) {
    console.error('Error in download-complete-backup:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});