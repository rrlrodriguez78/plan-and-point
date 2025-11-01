import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= VAULT UTILITIES =============
// Store tokens in Supabase Vault for enhanced security

async function storeTokenInVault(
  supabase: any,
  tokenValue: string,
  tokenType: 'access' | 'refresh',
  provider: string,
  destinationId: string
): Promise<string> {
  const secretName = `oauth_${tokenType}_${provider}_${destinationId}`;
  const description = `OAuth ${tokenType} token for ${provider} backup destination`;
  
  const { data, error } = await supabase.rpc('vault_create_secret', {
    secret: tokenValue,
    name: secretName,
    description: description
  });
  
  if (error) {
    console.error(`❌ Failed to store ${tokenType} token in vault:`, error);
    throw new Error(`Failed to store ${tokenType} token securely`);
  }
  
  console.log(`✅ ${tokenType} token stored in vault: ${data}`);
  return data; // Returns the secret ID
}

async function getTokenFromVault(supabase: any, secretId: string): Promise<string> {
  const { data, error } = await supabase.rpc('vault_read_secret', {
    secret_id: secretId
  });
  
  if (error || !data) {
    console.error('❌ Failed to retrieve token from vault:', error);
    throw new Error('Failed to retrieve token from vault');
  }
  
  return data;
}

async function updateTokenInVault(supabase: any, secretId: string, newToken: string): Promise<void> {
  const { error } = await supabase.rpc('vault_update_secret', {
    secret_id: secretId,
    new_secret: newToken
  });
  
  if (error) {
    console.error('❌ Failed to update token in vault:', error);
    throw new Error('Failed to update token in vault');
  }
}

// ============= STATE GENERATION =============

function generateState(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  // Convert to base64 using native btoa
  const base64 = btoa(String.fromCharCode(...randomBytes));
  // Make it URL-safe
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// ============= OAUTH HELPERS =============

async function refreshGoogleToken(refreshToken: string): Promise<string> {
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
  return tokens.access_token;
}

async function refreshDropboxToken(refreshToken: string): Promise<string> {
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
  return tokens.access_token;
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
    const url = new URL(req.url);

    // ============= HANDLE OAUTH CALLBACK (GET request from Google/Dropbox) =============
    if (req.method === 'GET') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      console.log(`🔄 OAuth callback received: code=${code ? 'present' : 'missing'}, state=${state}, error=${error}`);

      if (error) {
        console.error(`❌ OAuth error: ${error}`);
        return Response.redirect(`${Deno.env.get('APP_URL') || 'https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com'}/app/backups?error=${encodeURIComponent(error)}`, 302);
      }

      if (!code || !state) {
        console.error('❌ Missing code or state in OAuth callback');
        return Response.redirect(`${Deno.env.get('APP_URL') || 'https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com'}/app/backups?error=missing_params`, 302);
      }

      // 🔒 VALIDATE STATE TOKEN
      console.log('🔐 Validating state token...');
      
      // Clean up expired states first
      await supabase
        .from('oauth_states')
        .delete()
        .lt('expires_at', new Date().toISOString());

      // Retrieve and validate state
      const { data: oauthState, error: stateError } = await supabase
        .from('oauth_states')
        .select('*')
        .eq('state_token', state)
        .single();

      if (stateError || !oauthState) {
        console.error('❌ Invalid or expired state token');
        return Response.redirect(`${Deno.env.get('APP_URL') || 'https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com'}/app/backups?error=invalid_state`, 302);
      }

      // Check expiration
      if (new Date(oauthState.expires_at) < new Date()) {
        console.error('❌ State token expired');
        await supabase.from('oauth_states').delete().eq('id', oauthState.id);
        return Response.redirect(`${Deno.env.get('APP_URL') || 'https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com'}/app/backups?error=state_expired`, 302);
      }

      // Delete state token (one-time use)
      await supabase.from('oauth_states').delete().eq('id', oauthState.id);

      const tenantId = oauthState.tenant_id;
      const provider = oauthState.provider;
      const storedRedirectUri = oauthState.redirect_uri;
      
      console.log(`✅ State validated. TenantId: ${tenantId}, Provider: ${provider}, Redirect URI: ${storedRedirectUri}`);
      
      try {
        let accessToken = '';
        let refreshToken = '';
        let folderId = '';

        if (provider === 'google_drive') {
          const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
          const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
          
          // Use the stored redirect_uri from oauth_states
          const callbackRedirectUri = storedRedirectUri || `${supabaseUrl}/functions/v1/cloud-storage-auth`;

          console.log(`🔄 Exchanging code for tokens with redirect_uri: ${callbackRedirectUri}`);
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: clientId!,
              client_secret: clientSecret!,
              redirect_uri: callbackRedirectUri,
              grant_type: 'authorization_code'
            })
          });

          const tokens = await tokenResponse.json();
          
          if (tokens.error) {
            console.error(`❌ Token exchange error: ${tokens.error_description || tokens.error}`);
            return Response.redirect(`${Deno.env.get('APP_URL') || 'https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com'}/app/backups?error=${encodeURIComponent(tokens.error)}`, 302);
          }
          
          accessToken = tokens.access_token;
          refreshToken = tokens.refresh_token;

          console.log('✅ Tokens received, creating folder...');

          // Create root folder in Google Drive
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
          
          if (folder.error) {
            console.error(`❌ Folder creation error: ${folder.error.message}`);
            return Response.redirect(`${Deno.env.get('APP_URL') || 'https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com'}/app/backups?error=folder_creation_failed`, 302);
          }
          
          folderId = folder.id;
          console.log(`✅ Created Google Drive folder: ${folderId}`);
        }

        // 🔐 CHECK IF DESTINATION ALREADY EXISTS
        console.log('🔍 Checking for existing destination...');
        
        const { data: existingDestination } = await supabase
          .from('backup_destinations')
          .select('id, cloud_access_token_secret_id, cloud_refresh_token_secret_id')
          .eq('tenant_id', tenantId)
          .eq('cloud_provider', provider)
          .maybeSingle();

        let destinationId: string;
        let isReconnection = false;

        if (existingDestination) {
          // UPDATE EXISTING DESTINATION
          console.log('🔄 Updating existing destination...');
          isReconnection = true;
          destinationId = existingDestination.id;

          try {
            // Update tokens in vault
            if (existingDestination.cloud_access_token_secret_id && existingDestination.cloud_refresh_token_secret_id) {
              console.log('🔒 Updating tokens in vault...');
              await updateTokenInVault(supabase, existingDestination.cloud_access_token_secret_id, accessToken);
              await updateTokenInVault(supabase, existingDestination.cloud_refresh_token_secret_id, refreshToken);
            } else {
              // Create new vault entries if they don't exist
              console.log('🔒 Creating new vault entries...');
              const accessSecretId = await storeTokenInVault(supabase, accessToken, 'access', provider, destinationId);
              const refreshSecretId = await storeTokenInVault(supabase, refreshToken, 'refresh', provider, destinationId);
              
              await supabase
                .from('backup_destinations')
                .update({
                  cloud_access_token_secret_id: accessSecretId,
                  cloud_refresh_token_secret_id: refreshSecretId
                })
                .eq('id', destinationId);
            }

            // Update destination metadata
            const { error: updateError } = await supabase
              .from('backup_destinations')
              .update({
                cloud_folder_id: folderId,
                cloud_folder_path: '/VirtualTours_Backups',
                is_active: true,
                last_backup_at: new Date().toISOString()
              })
              .eq('id', destinationId);

            if (updateError) {
              console.error('❌ Failed to update destination:', updateError);
              throw new Error('Failed to update destination');
            }

            console.log('✅ Destination reconnected successfully');
          } catch (updateError: any) {
            console.error('❌ Update error:', updateError);
            return Response.redirect(`${Deno.env.get('APP_URL') || 'https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com'}/app/backups?error=update_failed`, 302);
          }

        } else {
          // CREATE NEW DESTINATION
          console.log('💾 Creating new backup destination...');
          
          const { data: newDestination, error: dbError } = await supabase
            .from('backup_destinations')
            .insert({
              tenant_id: tenantId,
              destination_type: 'cloud_storage',
              cloud_provider: provider,
              cloud_folder_id: folderId,
              cloud_folder_path: '/VirtualTours_Backups',
              is_active: true
            })
            .select('id')
            .single();

          if (dbError || !newDestination) {
            console.error('❌ Database error:', dbError);
            return Response.redirect(`${Deno.env.get('APP_URL') || 'https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com'}/app/backups?error=database_error`, 302);
          }

          destinationId = newDestination.id;

          console.log('🔒 Storing tokens in vault securely...');
          
          try {
            // Store tokens in vault
            const accessSecretId = await storeTokenInVault(supabase, accessToken, 'access', provider, destinationId);
            const refreshSecretId = await storeTokenInVault(supabase, refreshToken, 'refresh', provider, destinationId);
            
            // Update destination with vault secret IDs
            const { error: updateError } = await supabase
              .from('backup_destinations')
              .update({
                cloud_access_token_secret_id: accessSecretId,
                cloud_refresh_token_secret_id: refreshSecretId
              })
              .eq('id', destinationId);
            
            if (updateError) {
              console.error('❌ Failed to update destination with vault IDs:', updateError);
              throw new Error('Failed to link vault secrets');
            }
            
            console.log('✅ Cloud destination configured securely with vault');
          } catch (vaultError: any) {
            console.error('❌ Vault storage error:', vaultError);
            // Clean up: delete the destination if vault storage failed
            await supabase.from('backup_destinations').delete().eq('id', destinationId);
            return Response.redirect(`${Deno.env.get('APP_URL') || 'https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com'}/app/backups?error=vault_error`, 302);
          }
        }

        // Redirect back to app with appropriate success message
        const action = isReconnection ? 'reconnected' : 'connected';
        return Response.redirect(`${Deno.env.get('APP_URL') || 'https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com'}/app/backups?success=${action}`, 302);

      } catch (callbackError: any) {
        console.error('❌ OAuth callback processing error:', callbackError);
        return Response.redirect(`${Deno.env.get('APP_URL') || 'https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com'}/app/backups?error=${encodeURIComponent(callbackError.message)}`, 302);
      }
    }

    // ============= HANDLE API CALLS (POST requests) =============
    if (!req.method || req.method !== 'POST') {
      throw new Error('Invalid request method');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header missing');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { action, provider, tenant_id, redirect_uri, destinationId, destination_id, code, state } = await req.json();
    console.log(`🔐 Cloud storage auth action: ${action}, provider: ${provider}, tenant_id: ${tenant_id}, redirect_uri: ${redirect_uri}, destinationId: ${destinationId}, destination_id: ${destination_id}`);

    switch (action) {
      case 'authorize': {
        // Generate secure state token
        const state = generateState();
        
        // Store state → tenant_id mapping (expires in 10 minutes)
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        
        // Use client redirect_uri or fallback to edge function URL
        const finalRedirectUri = redirect_uri || `${supabaseUrl}/functions/v1/cloud-storage-auth`;
        
        const { error: stateError } = await supabase
          .from('oauth_states')
          .insert({
            state_token: state,
            tenant_id: tenant_id,
            provider: provider,
            redirect_uri: finalRedirectUri,
            expires_at: expiresAt
          });

        if (stateError) {
          console.error('❌ Failed to store OAuth state:', stateError);
          throw new Error('Failed to initialize OAuth flow');
        }

        console.log(`🔐 Generated secure state token for ${provider} with redirect_uri: ${finalRedirectUri}`);

        // Generate OAuth URL for provider using the finalRedirectUri
        let authUrl = '';

        if (provider === 'google_drive') {
          const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
          if (!clientId) throw new Error('Google Drive Client ID not configured');
          
          const scope = 'https://www.googleapis.com/auth/drive.file';
          authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${state}&access_type=offline&prompt=consent`;
          
          console.log('✅ Generated Google Drive OAuth URL with secure state and client redirect_uri');
        } else if (provider === 'dropbox') {
          const appKey = Deno.env.get('DROPBOX_APP_KEY');
          if (!appKey) throw new Error('Dropbox App Key not configured');
          
          authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${appKey}&redirect_uri=${encodeURIComponent(finalRedirectUri)}&response_type=code&state=${state}&token_access_type=offline`;
          
          console.log('✅ Generated Dropbox OAuth URL with secure state and client redirect_uri');
        }

        return new Response(
          JSON.stringify({ 
            authUrl,
            redirectUri: finalRedirectUri // For debugging
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'test-connection': {
        // Test cloud connection by decrypting token and making API call
        const destId = destinationId || destination_id;
        console.log(`🧪 Testing connection for destination: ${destId}`);
        
        if (!destId) {
          return new Response(JSON.stringify({ error: 'Missing destination ID' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        const { data: destination } = await supabase
          .from('backup_destinations')
          .select('*')
          .eq('id', destId)
          .single();

        if (!destination) throw new Error('Destination not found');

        // 🔓 RETRIEVE TOKEN FROM VAULT
        if (!destination.cloud_access_token_secret_id) {
          throw new Error('No access token configured for this destination');
        }
        
        const accessToken = await getTokenFromVault(supabase, destination.cloud_access_token_secret_id);
        let success = false;

        if (destination.cloud_provider === 'google_drive') {
          const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          if (response.status === 401) {
            // Token expired, try to refresh
            console.log('🔄 Access token expired, refreshing...');
            
            if (!destination.cloud_refresh_token_secret_id) {
              throw new Error('No refresh token available');
            }
            
            const refreshToken = await getTokenFromVault(supabase, destination.cloud_refresh_token_secret_id);
            const newAccessToken = await refreshGoogleToken(refreshToken);
            
            // Update vault with new token
            await updateTokenInVault(supabase, destination.cloud_access_token_secret_id, newAccessToken);
            
            // Retry test
            const retryResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
              headers: { 'Authorization': `Bearer ${newAccessToken}` }
            });
            success = retryResponse.ok;
          } else {
            success = response.ok;
          }
          
        } else if (destination.cloud_provider === 'dropbox') {
          const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          if (response.status === 401) {
            // Token expired, try to refresh
            console.log('🔄 Access token expired, refreshing...');
            
            if (!destination.cloud_refresh_token_secret_id) {
              throw new Error('No refresh token available');
            }
            
            const refreshToken = await getTokenFromVault(supabase, destination.cloud_refresh_token_secret_id);
            const newAccessToken = await refreshDropboxToken(refreshToken);
            
            // Update vault with new token
            await updateTokenInVault(supabase, destination.cloud_access_token_secret_id, newAccessToken);
            
            // Retry test
            const retryResponse = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${newAccessToken}` }
            });
            success = retryResponse.ok;
          } else {
            success = response.ok;
          }
        }

        console.log(success ? '✅ Connection test successful' : '❌ Connection test failed');

        return new Response(
          JSON.stringify({ success }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'disconnect': {
        // Deactivate destination
        console.log(`🔌 Disconnecting destination: ${destinationId}`);
        
        const { error } = await supabase
          .from('backup_destinations')
          .update({ is_active: false })
          .eq('id', destinationId);

        if (error) throw error;

        console.log('✅ Destination disconnected');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'callback': {
        // Handle OAuth callback from React component
        // code and state already parsed from request body at line 292
        
        console.log(`🔄 Processing OAuth callback: code=${code ? 'present' : 'missing'}, state=${state}`);

        if (!code || !state) {
          throw new Error('Missing code or state in callback');
        }

        // 🔒 VALIDATE STATE TOKEN
        console.log('🔐 Validating state token...');
        
        // Clean up expired states first
        await supabase
          .from('oauth_states')
          .delete()
          .lt('expires_at', new Date().toISOString());

        // Retrieve and validate state
        const { data: oauthState, error: stateError } = await supabase
          .from('oauth_states')
          .select('*')
          .eq('state_token', state)
          .single();

        if (stateError || !oauthState) {
          console.error('❌ Invalid or expired state token');
          throw new Error('Invalid or expired state token');
        }

        // Check expiration
        if (new Date(oauthState.expires_at) < new Date()) {
          console.error('❌ State token expired');
          await supabase.from('oauth_states').delete().eq('id', oauthState.id);
          throw new Error('State token expired');
        }

        // Delete state token (one-time use)
        await supabase.from('oauth_states').delete().eq('id', oauthState.id);

        const tenantId = oauthState.tenant_id;
        const provider = oauthState.provider;
        const storedRedirectUri = oauthState.redirect_uri;
        
        console.log(`✅ State validated. TenantId: ${tenantId}, Provider: ${provider}`);
        
        let accessToken = '';
        let refreshToken = '';
        let folderId = '';

        if (provider === 'google_drive') {
          const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
          const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
          
          // Use the stored redirect_uri from oauth_states
          const callbackRedirectUri = storedRedirectUri || `${supabaseUrl}/functions/v1/cloud-storage-auth`;

          console.log(`🔄 Exchanging code for tokens with redirect_uri: ${callbackRedirectUri}`);
          const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: clientId!,
              client_secret: clientSecret!,
              redirect_uri: callbackRedirectUri,
              grant_type: 'authorization_code'
            })
          });

          const tokens = await tokenResponse.json();
          
          if (tokens.error) {
            console.error(`❌ Token exchange error: ${tokens.error_description || tokens.error}`);
            throw new Error(tokens.error_description || tokens.error);
          }
          
          accessToken = tokens.access_token;
          refreshToken = tokens.refresh_token;

          console.log('✅ Tokens received, creating folder...');

          // Create root folder in Google Drive
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
          
          if (folder.error) {
            console.error(`❌ Folder creation error: ${folder.error.message}`);
            throw new Error('Folder creation failed: ' + folder.error.message);
          }
          
          folderId = folder.id;
          console.log(`✅ Created Google Drive folder: ${folderId}`);
        }

        // 🔐 STORE TOKENS IN VAULT
        console.log('💾 Managing destination and vault storage...');
        
        // Check if destination already exists for this tenant + provider
        const { data: existingDest } = await supabase
          .from('backup_destinations')
          .select('id, cloud_access_token_secret_id, cloud_refresh_token_secret_id')
          .eq('tenant_id', tenantId)
          .eq('cloud_provider', provider)
          .single();

        let destinationId: string;
        let dbError = null;

        if (existingDest) {
          // UPDATE existing entry
          console.log(`🔄 Updating existing destination: ${existingDest.id}`);
          destinationId = existingDest.id;
          
          try {
            // Update or create vault secrets
            if (existingDest.cloud_access_token_secret_id) {
              await updateTokenInVault(supabase, existingDest.cloud_access_token_secret_id, accessToken);
            } else {
              const accessSecretId = await storeTokenInVault(supabase, accessToken, 'access', provider, destinationId);
              await supabase
                .from('backup_destinations')
                .update({ cloud_access_token_secret_id: accessSecretId })
                .eq('id', destinationId);
            }
            
            if (existingDest.cloud_refresh_token_secret_id) {
              await updateTokenInVault(supabase, existingDest.cloud_refresh_token_secret_id, refreshToken);
            } else {
              const refreshSecretId = await storeTokenInVault(supabase, refreshToken, 'refresh', provider, destinationId);
              await supabase
                .from('backup_destinations')
                .update({ cloud_refresh_token_secret_id: refreshSecretId })
                .eq('id', destinationId);
            }
            
            // Update destination metadata
            const { error } = await supabase
              .from('backup_destinations')
              .update({
                cloud_folder_id: folderId,
                cloud_folder_path: '/VirtualTours_Backups',
                is_active: true,
                updated_at: new Date().toISOString()
              })
              .eq('id', destinationId);
            
            dbError = error;
          } catch (vaultError: any) {
            console.error('❌ Vault update error:', vaultError);
            dbError = vaultError;
          }
        } else {
          // INSERT new entry
          console.log('➕ Creating new destination entry');
          
          try {
            // Create destination first
            const { data: newDest, error: insertError } = await supabase
              .from('backup_destinations')
              .insert({
                tenant_id: tenantId,
                destination_type: 'cloud_storage',
                cloud_provider: provider,
                cloud_folder_id: folderId,
                cloud_folder_path: '/VirtualTours_Backups',
                is_active: true
              })
              .select('id')
              .single();
            
            if (insertError || !newDest) {
              throw insertError || new Error('Failed to create destination');
            }
            
            destinationId = newDest.id;
            
            // Store tokens in vault
            const accessSecretId = await storeTokenInVault(supabase, accessToken, 'access', provider, destinationId);
            const refreshSecretId = await storeTokenInVault(supabase, refreshToken, 'refresh', provider, destinationId);
            
            // Update destination with vault IDs
            const { error: updateError } = await supabase
              .from('backup_destinations')
              .update({
                cloud_access_token_secret_id: accessSecretId,
                cloud_refresh_token_secret_id: refreshSecretId
              })
              .eq('id', destinationId);
            
            dbError = updateError;
          } catch (vaultError: any) {
            console.error('❌ Vault storage error:', vaultError);
            dbError = vaultError;
          }
        }

        if (dbError) {
          console.error('❌ Database error:', dbError);
          throw new Error('Database error: ' + dbError.message);
        }

        console.log('✅ Cloud destination configured successfully');

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Invalid action');
    }
  } catch (error: any) {
    console.error('❌ Cloud storage auth error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
