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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { action, provider, tenantId, destinationId } = await req.json();

    switch (action) {
      case 'authorize': {
        // Generate OAuth URL for provider
        const redirectUri = `${supabaseUrl}/functions/v1/cloud-storage-auth`;
        let authUrl = '';

        if (provider === 'google_drive') {
          const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
          const scope = 'https://www.googleapis.com/auth/drive.file';
          authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${tenantId}&access_type=offline&prompt=consent`;
        } else if (provider === 'dropbox') {
          const appKey = Deno.env.get('DROPBOX_APP_KEY');
          authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&redirect_uri=${redirectUri}&response_type=code&state=${tenantId}&token_access_type=offline`;
        }

        return new Response(
          JSON.stringify({ authUrl }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'callback': {
        // Handle OAuth callback (exchange code for tokens)
        const { code, state: tenantId, provider } = await req.json();
        
        let accessToken = '';
        let refreshToken = '';
        let folderId = '';

        if (provider === 'google_drive') {
          const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
          const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
          const redirectUri = `${supabaseUrl}/functions/v1/cloud-storage-auth`;

          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: clientId!,
              client_secret: clientSecret!,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code'
            })
          });

          const tokens = await tokenResponse.json();
          accessToken = tokens.access_token;
          refreshToken = tokens.refresh_token;

          // Create root folder
          const folderResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: 'VirtualTours_Backups',
              mimeType: 'application/vnd.google-apps.folder'
            })
          });

          const folder = await folderResponse.json();
          folderId = folder.id;
        } else if (provider === 'dropbox') {
          const appKey = Deno.env.get('DROPBOX_APP_KEY');
          const appSecret = Deno.env.get('DROPBOX_APP_SECRET');
          const redirectUri = `${supabaseUrl}/functions/v1/cloud-storage-auth`;

          const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: appKey!,
              client_secret: appSecret!,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code'
            })
          });

          const tokens = await tokenResponse.json();
          accessToken = tokens.access_token;
          refreshToken = tokens.refresh_token;
          folderId = '/VirtualTours_Backups';
        }

        // Store in database (simplified - should encrypt tokens)
        const { error } = await supabase
          .from('backup_destinations')
          .insert({
            tenant_id: tenantId,
            destination_type: 'cloud_storage',
            cloud_provider: provider,
            cloud_access_token: accessToken,
            cloud_refresh_token: refreshToken,
            cloud_folder_id: folderId,
            cloud_folder_path: '/VirtualTours_Backups',
            is_active: true
          });

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'test-connection': {
        // Test cloud connection
        const { data: destination } = await supabase
          .from('backup_destinations')
          .select('*')
          .eq('id', destinationId)
          .single();

        if (!destination) throw new Error('Destination not found');

        let success = false;

        if (destination.cloud_provider === 'google_drive') {
          const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
            headers: { 'Authorization': `Bearer ${destination.cloud_access_token}` }
          });
          success = response.ok;
        } else if (destination.cloud_provider === 'dropbox') {
          const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${destination.cloud_access_token}` }
          });
          success = response.ok;
        }

        return new Response(
          JSON.stringify({ success }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'disconnect': {
        // Deactivate destination
        const { error } = await supabase
          .from('backup_destinations')
          .update({ is_active: false })
          .eq('id', destinationId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Invalid action');
    }
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
