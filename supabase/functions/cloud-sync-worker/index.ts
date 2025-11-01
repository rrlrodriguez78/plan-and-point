import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= VAULT UTILITIES =============
// Retrieve tokens from Supabase Vault for enhanced security

async function getTokenFromVault(supabase: any, secretId: string): Promise<string> {
  const { data, error } = await supabase
    .from('vault.decrypted_secrets')
    .select('decrypted_secret')
    .eq('id', secretId)
    .single();
  
  if (error || !data) {
    throw new Error('Failed to retrieve token from vault');
  }
  
  return data.decrypted_secret;
}

async function updateTokenInVault(supabase: any, secretId: string, newToken: string): Promise<void> {
  const { error } = await supabase
    .from('vault.secrets')
    .update({ secret: newToken })
    .eq('id', secretId);
  
  if (error) {
    throw new Error('Failed to update token in vault');
  }
}

// ============= TOKEN REFRESH UTILITIES =============

async function refreshGoogleToken(refreshToken: string, supabase: any, accessTokenSecretId: string): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  
  const tokens = await response.json();
  
  if (tokens.error) {
    throw new Error(`Token refresh failed: ${tokens.error_description || tokens.error}`);
  }
  
  const newAccessToken = tokens.access_token;
  
  // Update vault with new token
  await updateTokenInVault(supabase, accessTokenSecretId, newAccessToken);
  
  console.log('✅ Google Drive token refreshed in vault');
  return newAccessToken;
}

async function refreshDropboxToken(refreshToken: string, supabase: any, accessTokenSecretId: string): Promise<string> {
  const appKey = Deno.env.get('DROPBOX_APP_KEY');
  const appSecret = Deno.env.get('DROPBOX_APP_SECRET');
  
  const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: appKey!,
      client_secret: appSecret!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  
  const tokens = await response.json();
  
  if (tokens.error) {
    throw new Error(`Token refresh failed: ${tokens.error_description || tokens.error}`);
  }
  
  const newAccessToken = tokens.access_token;
  
  // Update vault with new token
  await updateTokenInVault(supabase, accessTokenSecretId, newAccessToken);
  
  console.log('✅ Dropbox token refreshed in vault');
  return newAccessToken;
}

// ============= MAIN HANDLER =============

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

      // Get backup job with destination
      const { data: backupJob, error: jobError } = await supabase
        .from('backup_jobs')
        .select(`
          *,
          backup_destinations!inner(*)
        `)
        .eq('id', backupJobId)
        .single();

      if (jobError) throw jobError;
      if (!backupJob) throw new Error('Backup job not found');
      if (!backupJob.backup_destinations) throw new Error('No destination configured');

      const destination = Array.isArray(backupJob.backup_destinations) 
        ? backupJob.backup_destinations[0] 
        : backupJob.backup_destinations;
      
      // Create sync history record
      const { data: syncHistory, error: syncError } = await supabase
        .from('backup_sync_history')
        .insert({
          destination_id: destination.id,
          backup_job_id: backupJobId,
          sync_type: 'full',
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (syncError) throw syncError;

      try {
        // Get backup file from storage
        const storagePath = backupJob.storage_path;
        console.log(`📥 Downloading backup from storage: ${storagePath}`);
        
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('backups')
          .download(storagePath);

        if (downloadError) throw downloadError;
        if (!fileData) throw new Error('Backup file not found');

        console.log(`📦 File downloaded, size: ${fileData.size} bytes`);

        // 🔓 RETRIEVE TOKENS FROM VAULT
        if (!destination.cloud_access_token_secret_id || !destination.cloud_refresh_token_secret_id) {
          throw new Error('Destination tokens not configured in vault');
        }
        
        const accessToken = await getTokenFromVault(supabase, destination.cloud_access_token_secret_id);
        const refreshToken = await getTokenFromVault(supabase, destination.cloud_refresh_token_secret_id);

        // Upload to cloud provider
        let cloudFileId = '';
        let cloudFilePath = '';
        let uploadSuccess = false;

        if (destination.cloud_provider === 'google_drive') {
          console.log('📤 Uploading to Google Drive...');
          
          const fileName = `${backupJob.tour_id}_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
          
          // Create metadata
          const metadata = {
            name: fileName,
            parents: [destination.cloud_folder_id]
          };

          // Try upload with current token
          let currentAccessToken = accessToken;
          let uploadResponse = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${currentAccessToken}`
              },
              body: await createMultipartBody(metadata, fileData)
            }
          );

          // If unauthorized, refresh token and retry
          if (uploadResponse.status === 401) {
            console.log('🔄 Token expired, refreshing Google Drive token...');
            currentAccessToken = await refreshGoogleToken(refreshToken, supabase, destination.cloud_access_token_secret_id);
            
            uploadResponse = await fetch(
              'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${currentAccessToken}`
                },
                body: await createMultipartBody(metadata, fileData)
              }
            );
          }

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Google Drive upload failed: ${errorText}`);
          }

          const uploadResult = await uploadResponse.json();
          cloudFileId = uploadResult.id;
          cloudFilePath = `${destination.cloud_folder_path}/${fileName}`;
          uploadSuccess = true;
          
          console.log(`✅ Uploaded to Google Drive: ${cloudFileId}`);

        } else if (destination.cloud_provider === 'dropbox') {
          console.log('📤 Uploading to Dropbox...');
          
          const fileName = `${backupJob.tour_id}_${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
          const path = `${destination.cloud_folder_path}/${fileName}`;

          // Try upload with current token
          let currentAccessToken = accessToken;
          let uploadResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${currentAccessToken}`,
              'Content-Type': 'application/octet-stream',
              'Dropbox-API-Arg': JSON.stringify({
                path,
                mode: 'add',
                autorename: true
              })
            },
            body: fileData
          });

          // If unauthorized, refresh token and retry
          if (uploadResponse.status === 401) {
            console.log('🔄 Token expired, refreshing Dropbox token...');
            currentAccessToken = await refreshDropboxToken(refreshToken, supabase, destination.cloud_access_token_secret_id);
            
            uploadResponse = await fetch('https://content.dropboxapi.com/2/files/upload', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/octet-stream',
                'Dropbox-API-Arg': JSON.stringify({
                  path,
                  mode: 'add',
                  autorename: true
                })
              },
              body: fileData
            });
          }

          if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Dropbox upload failed: ${errorText}`);
          }

          const uploadResult = await uploadResponse.json();
          cloudFileId = uploadResult.id;
          cloudFilePath = path;
          uploadSuccess = true;
          
          console.log(`✅ Uploaded to Dropbox: ${cloudFileId}`);
        }

        if (!uploadSuccess) {
          throw new Error('Upload failed for unknown reason');
        }

        // Update sync history
        await supabase
          .from('backup_sync_history')
          .update({
            status: 'completed',
            files_synced: 1,
            total_size_bytes: fileData.size,
            completed_at: new Date().toISOString()
          })
          .eq('id', syncHistory.id);

        // Update backup job
        await supabase
          .from('backup_jobs')
          .update({ 
            cloud_synced: true,
            cloud_sync_error: null
          })
          .eq('id', backupJobId);

        // Update destination last backup time
        await supabase
          .from('backup_destinations')
          .update({ last_backup_at: new Date().toISOString() })
          .eq('id', destination.id);

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
            file_size_bytes: fileData.size
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
    console.error('❌ Cloud sync worker error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ============= HELPER FUNCTIONS =============

async function createMultipartBody(metadata: any, file: Blob): Promise<Blob> {
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadataPart = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata);

  const filePart = delimiter +
    'Content-Type: application/zip\r\n\r\n';

  const parts = [
    new Blob([metadataPart], { type: 'text/plain' }),
    new Blob([filePart], { type: 'text/plain' }),
    file,
    new Blob([closeDelimiter], { type: 'text/plain' })
  ];

  return new Blob(parts, { type: `multipart/related; boundary=${boundary}` });
}
