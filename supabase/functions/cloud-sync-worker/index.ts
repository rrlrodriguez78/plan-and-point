import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, backupJobId } = await req.json();

    if (action === 'sync_backup') {
      console.log('🔄 Starting cloud sync for backup:', backupJobId);

      // Get backup job
      const { data: backupJob } = await supabase
        .from('backup_jobs')
        .select('*, backup_destinations(*)')
        .eq('id', backupJobId)
        .single();

      if (!backupJob) throw new Error('Backup job not found');
      if (!backupJob.backup_destinations) throw new Error('No destination configured');

      const destination = backupJob.backup_destinations;
      
      // Create sync history record
      const { data: syncHistory } = await supabase
        .from('backup_sync_history')
        .insert({
          destination_id: destination.id,
          backup_job_id: backupJobId,
          sync_type: 'full',
          status: 'in_progress'
        })
        .select()
        .single();

      try {
        // Get backup file from storage
        const storagePath = backupJob.storage_path;
        const { data: fileData } = await supabase.storage
          .from('backups')
          .download(storagePath);

        if (!fileData) throw new Error('Backup file not found');

        // Upload to cloud provider
        let cloudFileId = '';
        let cloudFilePath = '';

        if (destination.cloud_provider === 'google_drive') {
          // Upload to Google Drive
          const fileName = `${backupJob.tour_id}_${new Date().toISOString()}.zip`;
          
          // Create metadata
          const metadata = {
            name: fileName,
            parents: [destination.cloud_folder_id]
          };

          // Upload file
          const form = new FormData();
          form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
          form.append('file', fileData);

          const uploadResponse = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${destination.cloud_access_token}`
              },
              body: form
            }
          );

          const uploadResult = await uploadResponse.json();
          cloudFileId = uploadResult.id;
          cloudFilePath = `${destination.cloud_folder_path}/${fileName}`;

        } else if (destination.cloud_provider === 'dropbox') {
          // Upload to Dropbox
          const fileName = `${backupJob.tour_id}_${new Date().toISOString()}.zip`;
          const path = `${destination.cloud_folder_path}/${fileName}`;

          const uploadResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${destination.cloud_access_token}`,
              'Content-Type': 'application/octet-stream',
              'Dropbox-API-Arg': JSON.stringify({
                path,
                mode: 'add',
                autorename: true
              })
            },
            body: fileData
          });

          const uploadResult = await uploadResponse.json();
          cloudFileId = uploadResult.id;
          cloudFilePath = path;
        }

        // Update sync history
        await supabase
          .from('backup_sync_history')
          .update({
            status: 'completed',
            files_synced: 1,
            total_size_bytes: backupJob.file_size,
            completed_at: new Date().toISOString()
          })
          .eq('id', syncHistory.id);

        // Update backup job
        await supabase
          .from('backup_jobs')
          .update({ cloud_synced: true })
          .eq('id', backupJobId);

        // Create file mapping
        await supabase
          .from('cloud_file_mappings')
          .insert({
            destination_id: destination.id,
            backup_job_id: backupJobId,
            tour_id: backupJob.tour_id,
            local_file_url: backupJob.file_url,
            cloud_file_id: cloudFileId,
            cloud_file_path: cloudFilePath,
            cloud_file_name: cloudFilePath.split('/').pop(),
            file_size_bytes: backupJob.file_size
          });

        console.log('✅ Cloud sync completed successfully');

        return new Response(
          JSON.stringify({ success: true, cloudFileId, cloudFilePath }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error: any) {
        console.error('❌ Cloud sync failed:', error);

        // Update sync history with error
        await supabase
          .from('backup_sync_history')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', syncHistory.id);

        // Update backup job with error
        await supabase
          .from('backup_jobs')
          .update({ cloud_sync_error: error.message })
          .eq('id', backupJobId);

        throw error;
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
