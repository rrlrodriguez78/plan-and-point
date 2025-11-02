import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============= ENCRYPTION UTILITIES =============
// Use Web Crypto API for secure token encryption

async function encryptToken(token: string): Promise<string> {
  const encryptionKey = Deno.env.get('CLOUD_ENCRYPTION_KEY');
  if (!encryptionKey) throw new Error('CLOUD_ENCRYPTION_KEY not configured');
  
  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Import encryption key
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  // Encrypt the token
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(token)
  );
  
  // Combine IV and encrypted data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  // Return as base64
  return btoa(String.fromCharCode(...combined));
}

async function decryptToken(encryptedToken: string): Promise<string> {
  const encryptionKey = Deno.env.get('CLOUD_ENCRYPTION_KEY');
  if (!encryptionKey) throw new Error('CLOUD_ENCRYPTION_KEY not configured');
  
  // Decode from base64
  const combined = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
  
  // Extract IV and encrypted data
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  // Import decryption key
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(encryptionKey.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );
  
  return new TextDecoder().decode(decrypted);
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
        const appUrl = Deno.env.get('APP_URL');
        return Response.redirect(`${appUrl}/app/backups?error=${encodeURIComponent(error)}`, 302);
      }

      if (!code || !state) {
        console.error('❌ Missing code or state in OAuth callback');
        const appUrl = Deno.env.get('APP_URL');
        return Response.redirect(`${appUrl}/app/backups?error=missing_params`, 302);
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
        const appUrl = Deno.env.get('APP_URL');
        return Response.redirect(`${appUrl}/app/backups?error=invalid_state`, 302);
      }

      // Check expiration
      if (new Date(oauthState.expires_at) < new Date()) {
        console.error('❌ State token expired');
        await supabase.from('oauth_states').delete().eq('id', oauthState.id);
        const appUrl = Deno.env.get('APP_URL');
        return Response.redirect(`${appUrl}/app/backups?error=state_expired`, 302);
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
            const appUrl = Deno.env.get('APP_URL');
            return Response.redirect(`${appUrl}/app/backups?error=${encodeURIComponent(tokens.error)}`, 302);
          }
          
          accessToken = tokens.access_token;
          refreshToken = tokens.refresh_token;

          console.log('✅ Tokens received, searching for existing folder...');

          // Search for existing VirtualTours_Backups folder
          console.log('🔍 Searching for existing VirtualTours_Backups folder...');
          const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='VirtualTours_Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );

          if (!searchResponse.ok) {
            console.error(`❌ Folder search error: ${searchResponse.statusText}`);
            const appUrl = Deno.env.get('APP_URL');
            return Response.redirect(`${appUrl}/app/backups?error=folder_search_failed`, 302);
          }

          const searchData = await searchResponse.json();

          if (searchData.files && searchData.files.length > 0) {
            // Use existing folder
            folderId = searchData.files[0].id;
            console.log('📍 Using existing folder:', folderId);
          } else {
            // Create new folder
            console.log('🆕 Creating new VirtualTours_Backups folder...');
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
              const appUrl = Deno.env.get('APP_URL');
              return Response.redirect(`${appUrl}/app/backups?error=folder_creation_failed`, 302);
            }
            
            folderId = folder.id;
            console.log(`✅ New folder created: ${folderId}`);
          }
        }

        // 🔐 ENCRYPT AND STORE TOKENS
        console.log('🔒 Encrypting tokens...');
        const encryptedAccessToken = await encryptToken(accessToken);
        const encryptedRefreshToken = await encryptToken(refreshToken);

        // 🔐 CHECK IF DESTINATION ALREADY EXISTS
        console.log('🔍 Checking for existing destination...');
        
        const { data: existingDestination } = await supabase
          .from('backup_destinations')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('cloud_provider', provider)
          .maybeSingle();

        let destinationId: string;
        let isReconnection = false;

        if (existingDestination) {
          // UPDATE EXISTING DESTINATION
          console.log('🔄 Updating existing destination...', {
            destinationId: existingDestination.id,
            tenantId: tenantId,
            provider: provider
          });
          isReconnection = true;
          destinationId = existingDestination.id;

          const updateData = {
            cloud_access_token: encryptedAccessToken,
            cloud_refresh_token: encryptedRefreshToken,
            cloud_folder_id: folderId,
            cloud_folder_path: '/VirtualTours_Backups',
            is_active: true,
            updated_at: new Date().toISOString()
          };

          console.log('📝 Attempting update with data:', {
            destinationId,
            hasAccessToken: !!updateData.cloud_access_token,
            hasRefreshToken: !!updateData.cloud_refresh_token,
            folderId: updateData.cloud_folder_id,
            is_active: updateData.is_active
          });

          const { data: updateResult, error: updateError } = await supabase
            .from('backup_destinations')
            .update(updateData)
            .eq('id', destinationId)
            .select();

          if (updateError) {
            console.error('❌ Failed to update destination:', {
              error: updateError,
              code: updateError.code,
              message: updateError.message,
              details: updateError.details,
              hint: updateError.hint
            });
            const appUrl = Deno.env.get('APP_URL');
            return Response.redirect(`${appUrl}/app/backups?error=update_failed&msg=${encodeURIComponent(updateError.message)}`, 302);
          }

          console.log('✅ Destination reconnected successfully:', {
            updated: updateResult,
            rowsAffected: updateResult?.length || 0
          });

        } else {
          // CREATE NEW DESTINATION
          console.log('💾 Creating new backup destination...');
          
          const { data: newDestination, error: dbError } = await supabase
            .from('backup_destinations')
            .insert({
              tenant_id: tenantId,
              destination_type: 'cloud_storage',
              cloud_provider: provider,
              cloud_access_token: encryptedAccessToken,
              cloud_refresh_token: encryptedRefreshToken,
              cloud_folder_id: folderId,
              cloud_folder_path: '/VirtualTours_Backups',
              is_active: true
            })
            .select('id')
            .single();

          if (dbError || !newDestination) {
            console.error('❌ Database error:', dbError);
            const appUrl = Deno.env.get('APP_URL');
            return Response.redirect(`${appUrl}/app/backups?error=database_error`, 302);
          }

          destinationId = newDestination.id;
          console.log('✅ Cloud destination configured securely');
        }

        // Return direct redirect to app - no intermediate page
        const action = isReconnection ? 'reconnected' : 'connected';
        const appUrl = Deno.env.get('APP_URL');
        const redirectUrl = `${appUrl}/app/backups?success=${action}`;
        
        console.log('🚀 Redirecting directly to app:', redirectUrl);
        
        // 302 redirect - browser will immediately navigate to the app
        return Response.redirect(redirectUrl, 302);

      } catch (callbackError: any) {
        console.error('❌ OAuth callback processing error:', callbackError);
        const appUrl = Deno.env.get('APP_URL');
        return Response.redirect(`${appUrl}/app/backups?error=${encodeURIComponent(callbackError.message)}`, 302);
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

        // 🔓 DECRYPT TOKEN
        if (!destination.cloud_access_token || !destination.cloud_refresh_token) {
          throw new Error('No tokens configured for this destination');
        }
        
        let accessToken = await decryptToken(destination.cloud_access_token);
        const refreshToken = await decryptToken(destination.cloud_refresh_token);
        let success = false;

        if (destination.cloud_provider === 'google_drive') {
          const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          if (response.status === 401) {
            // Token expired, try to refresh
            console.log('🔄 Access token expired, refreshing...');
            accessToken = await refreshGoogleToken(refreshToken);
            const encryptedToken = await encryptToken(accessToken);
            await supabase
              .from('backup_destinations')
              .update({ cloud_access_token: encryptedToken })
              .eq('id', destId);
            
            // Retry test
            const retryResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
              headers: { 'Authorization': `Bearer ${accessToken}` }
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
            accessToken = await refreshDropboxToken(refreshToken);
            const encryptedToken = await encryptToken(accessToken);
            await supabase
              .from('backup_destinations')
              .update({ cloud_access_token: encryptedToken })
              .eq('id', destId);
            
            // Retry test
            const retryResponse = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${accessToken}` }
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

          console.log('✅ Tokens received, searching for existing folder...');

          // Search for existing VirtualTours_Backups folder
          console.log('🔍 Searching for existing VirtualTours_Backups folder...');
          const searchResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=name='VirtualTours_Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
              },
            }
          );

          if (!searchResponse.ok) {
            console.error(`❌ Folder search error: ${searchResponse.statusText}`);
            throw new Error('Folder search failed: ' + searchResponse.statusText);
          }

          const searchData = await searchResponse.json();

          if (searchData.files && searchData.files.length > 0) {
            // Use existing folder
            folderId = searchData.files[0].id;
            console.log('📍 Using existing folder:', folderId);
          } else {
            // Create new folder
            console.log('🆕 Creating new VirtualTours_Backups folder...');
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
            console.log(`✅ New folder created: ${folderId}`);
          }
        }

        // 🔐 ENCRYPT AND STORE TOKENS
        console.log('💾 Encrypting and storing tokens...');
        const encryptedAccessToken = await encryptToken(accessToken);
        const encryptedRefreshToken = await encryptToken(refreshToken);
        
        // Check if destination already exists for this tenant + provider
        const { data: existingDest } = await supabase
          .from('backup_destinations')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('cloud_provider', provider)
          .single();

        let destinationId: string;
        let dbError = null;
        let isReconnection = false;

        if (existingDest) {
          // UPDATE existing entry
          console.log(`🔄 Updating existing destination: ${existingDest.id}`);
          destinationId = existingDest.id;
          isReconnection = true;
          
          const { error } = await supabase
            .from('backup_destinations')
            .update({
              cloud_access_token: encryptedAccessToken,
              cloud_refresh_token: encryptedRefreshToken,
              cloud_folder_id: folderId,
              cloud_folder_path: '/VirtualTours_Backups',
              is_active: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', destinationId);
          
          dbError = error;
        } else {
          // INSERT new entry
          console.log('➕ Creating new destination entry');
          
          const { data: newDest, error: insertError } = await supabase
            .from('backup_destinations')
            .insert({
              tenant_id: tenantId,
              destination_type: 'cloud_storage',
              cloud_provider: provider,
              cloud_access_token: encryptedAccessToken,
              cloud_refresh_token: encryptedRefreshToken,
              cloud_folder_id: folderId,
              cloud_folder_path: '/VirtualTours_Backups',
              is_active: true
            })
            .select('id')
            .single();
          
          if (insertError || !newDest) {
            dbError = insertError || new Error('Failed to create destination');
          } else {
            destinationId = newDest.id;
          }
        }

        if (dbError) {
          console.error('❌ Database error:', dbError);
          throw new Error('Database error: ' + dbError.message);
        }

        console.log('✅ Cloud destination configured successfully');

        // Return premium HTML page
        const action = isReconnection ? 'reconnected' : 'connected';
        const appUrl = Deno.env.get('APP_URL');
        const redirectUrl = `${appUrl}/app/backups?success=${action}`;
        
        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Backup Set Successfully</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: radial-gradient(ellipse at center, #FFD700 0%, #FFA500 40%, #1a1a1a 100%);
      overflow: hidden;
      position: relative;
    }
    
    /* Confetti Particles */
    .confetti-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    }
    
    .confetti {
      position: absolute;
      width: 10px;
      height: 10px;
      background: #FFD700;
      animation: confettiFall linear infinite;
    }
    
    @keyframes confettiFall {
      0% {
        transform: translateY(-100vh) rotate(0deg);
        opacity: 1;
      }
      100% {
        transform: translateY(100vh) rotate(720deg);
        opacity: 0;
      }
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes glowPulse {
      0%, 100% {
        text-shadow: 0 0 20px rgba(255, 215, 0, 0.8),
                     0 0 40px rgba(255, 215, 0, 0.4);
      }
      50% {
        text-shadow: 0 0 30px rgba(255, 215, 0, 1),
                     0 0 60px rgba(255, 215, 0, 0.6);
      }
    }
    
    .container {
      text-align: center;
      padding: 3rem;
      max-width: 500px;
      position: relative;
      z-index: 2;
      animation: fadeInUp 0.8s ease-out;
    }
    
    .sparkle {
      font-size: 2rem;
      margin-bottom: 1rem;
      animation: glowPulse 2s ease-in-out infinite;
      display: inline-block;
    }
    
    h1 {
      font-family: 'Playfair Display', serif;
      font-size: 3.5rem;
      font-weight: 700;
      margin: 0 0 1rem;
      background: linear-gradient(135deg, #FFD700 0%, #FFF 50%, #FFD700 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: glowPulse 2s ease-in-out infinite;
      line-height: 1.2;
    }
    
    .subtitle {
      font-size: 1.5rem;
      color: rgba(255, 255, 255, 0.95);
      font-weight: 600;
      margin-bottom: 2rem;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      animation: fadeInUp 0.8s ease-out 0.2s both;
    }
    
    .success-message {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-size: 1.2rem;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 2.5rem;
      padding: 1rem 1.5rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 215, 0, 0.3);
      animation: fadeInUp 0.8s ease-out 0.4s both;
    }
    
    .checkmark {
      font-size: 1.5rem;
      animation: glowPulse 2s ease-in-out infinite;
    }
    
    .close-btn {
      margin-top: 1rem;
      padding: 1.2rem 3rem;
      background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
      border: none;
      border-radius: 50px;
      color: #1a1a1a;
      font-size: 1.1rem;
      font-weight: 600;
      font-family: 'Inter', sans-serif;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 8px 20px rgba(255, 215, 0, 0.4),
                  0 2px 8px rgba(0, 0, 0, 0.2);
      animation: fadeInUp 0.8s ease-out 0.6s both;
      position: relative;
      overflow: hidden;
    }
    
    .close-btn::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.3);
      transform: translate(-50%, -50%);
      transition: width 0.6s, height 0.6s;
    }
    
    .close-btn:hover::before {
      width: 300px;
      height: 300px;
    }
    
    .close-btn:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 28px rgba(255, 215, 0, 0.6),
                  0 4px 12px rgba(0, 0, 0, 0.3);
    }
    
    .close-btn:active {
      transform: translateY(-2px);
    }
    
    .countdown {
      margin-top: 1.5rem;
      font-size: 0.95rem;
      color: rgba(255, 255, 255, 0.7);
      animation: fadeInUp 0.8s ease-out 0.8s both;
    }
    
    #countdown {
      font-weight: bold;
      font-size: 1.2rem;
      color: #FFD700;
      text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
    }
    
    @media (max-width: 600px) {
      h1 {
        font-size: 2.5rem;
      }
      .subtitle {
        font-size: 1.2rem;
      }
      .close-btn {
        padding: 1rem 2rem;
        font-size: 1rem;
      }
    }
  </style>
</head>
<body>
  <!-- Confetti Container -->
  <div class="confetti-container" id="confettiContainer"></div>
  
  <div class="container">
    <div class="sparkle">✨</div>
    <h1>Congratulations!</h1>
    <p class="subtitle">Backup Set Successfully</p>
    <div class="success-message">
      <span class="checkmark">✅</span>
      <span>Google Drive connected & configured</span>
    </div>
    <button class="close-btn" onclick="handleClose()">
      <span style="position: relative; z-index: 1;">Cerrar Ventana</span>
    </button>
    <div class="countdown">
      <p>Auto-cierre en <span id="countdown">5</span> segundos</p>
    </div>
  </div>
  
  <script>
    (function() {
      // Create confetti particles
      const confettiContainer = document.getElementById('confettiContainer');
      const colors = ['#FFD700', '#FFA500', '#FFFFFF', '#FFE55C', '#FFC700'];
      
      for (let i = 0; i < 30; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.width = (Math.random() * 8 + 6) + 'px';
        confetti.style.height = (Math.random() * 8 + 6) + 'px';
        confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
        confettiContainer.appendChild(confetti);
      }
      
      console.log('🎉 OAuth successful, notifying parent window...');
      const countdownEl = document.getElementById('countdown');
      let countdown = 5;
      
      // Notify opener window if exists
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({
            type: 'oauth-success',
            provider: '${provider}',
            action: '${action}',
            timestamp: Date.now()
          }, '*');
          console.log('✅ postMessage sent to opener');
        } catch (e) {
          console.error('❌ Failed to send postMessage:', e);
        }
      }
      
      // Countdown timer
      const countdownInterval = setInterval(function() {
        countdown--;
        if (countdownEl) {
          countdownEl.textContent = countdown;
        }
        
        if (countdown <= 0) {
          clearInterval(countdownInterval);
        }
      }, 1000);
      
      // Try to auto-close multiple times
      function attemptClose() {
        const attempts = [3000, 3500, 4000, 4500, 5000];
        let closedSuccessfully = false;
        
        attempts.forEach(function(delay) {
          setTimeout(function() {
            if (closedSuccessfully) return;
            
            try {
              window.close();
              closedSuccessfully = true;
              console.log('✅ Window closed successfully');
            } catch (e) {
              console.warn('⚠️ Close attempt failed:', e);
            }
          }, delay);
        });
        
        // If opened in full page (not popup), redirect after 5 seconds
        if (!window.opener || window.opener.closed) {
          setTimeout(function() {
            window.location.href = '${redirectUrl}';
          }, 5000);
        }
      }
      
      // Start close attempts
      attemptClose();
      
      // Manual close button handler
      window.handleClose = function() {
        try {
          window.close();
        } catch (e) {
          // If can't close (not a popup), redirect to app
          if (!window.opener || window.opener.closed) {
            window.location.href = '${redirectUrl}';
          }
        }
      };
    })();
  </script>
</body>
</html>`;
        
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            ...corsHeaders
          }
        });
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
