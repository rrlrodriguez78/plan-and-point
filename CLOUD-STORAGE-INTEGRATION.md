# 🔐 Cloud Storage Integration - Complete Guide

## Overview

This document describes the complete cloud storage integration system for automatic backup synchronization with Google Drive and Dropbox. The system includes **enterprise-grade security** with AES-256-GCM token encryption.

---

## 🎯 Features

✅ **Secure OAuth 2.0 Authentication**
- Google Drive integration with offline access
- Dropbox integration with refresh tokens
- Automatic token refresh when expired

✅ **Enterprise-Grade Security**
- AES-256-GCM encryption for all OAuth tokens
- Tokens encrypted at rest in database
- Automatic key derivation from `CLOUD_ENCRYPTION_KEY`
- No plaintext tokens ever stored

✅ **Automatic Backup Sync**
- Background sync to cloud storage
- Automatic retry on token expiration
- Detailed sync history and logs
- File mapping between local and cloud storage

✅ **Multi-Provider Support**
- Google Drive (15 GB free)
- Dropbox (2 GB free)
- Easy to extend for additional providers

---

## 🔐 Security Architecture

### Token Encryption

All OAuth tokens (access tokens and refresh tokens) are encrypted using **AES-256-GCM** before being stored in the database.

#### Encryption Process

1. **Key Derivation**: 
   - Uses `CLOUD_ENCRYPTION_KEY` environment variable (256-bit hex key)
   - Imported as CryptoKey for Web Crypto API

2. **Encryption**:
   - Algorithm: AES-GCM (Galois/Counter Mode)
   - IV: 12 random bytes generated for each encryption
   - Output: Base64-encoded string containing IV + encrypted data

3. **Decryption**:
   - Extracts IV from first 12 bytes
   - Decrypts data using original key and IV
   - Returns plaintext token

#### Code Example

```typescript
// Encryption
async function encryptToken(token: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedToken = new TextEncoder().encode(token);
  
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedToken
  );
  
  // Combine IV + encrypted data, then base64 encode
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}
```

---

## 🏗️ System Architecture

### Components

1. **Edge Function: cloud-storage-auth**
   - Handles OAuth authorization flow
   - Encrypts and stores tokens
   - Tests connections
   - Manages disconnections

2. **Edge Function: cloud-sync-worker**
   - Processes backup sync jobs
   - Decrypts tokens for API calls
   - Handles token refresh automatically
   - Creates cloud file mappings

3. **Frontend Components**
   - `CloudProviderSelector` - UI for connecting providers
   - `useCloudStorage` - React hook for cloud operations
   - `BackupDestinationSettings` - Configuration interface

4. **Database Tables**
   - `backup_destinations` - Stores encrypted credentials
   - `backup_sync_history` - Tracks sync operations
   - `cloud_file_mappings` - Maps local files to cloud files

---

## 📋 Setup Instructions

### 1. Prerequisites

- Google Cloud Console account (for Google Drive)
- Dropbox App Console account (for Dropbox)
- Lovable Cloud project with Supabase backend

### 2. Configure Google Drive

1. **Go to Google Cloud Console** (https://console.cloud.google.com)

2. **Create OAuth Credentials**:
   - Navigation: APIs & Services → Credentials
   - Click "Create Credentials" → "OAuth Client ID"
   - Application type: **Web Application**

3. **Configure OAuth Consent Screen**:
   - Add authorized domain: `swnhlzcodsnpsqpxaxov.supabase.co`
   - Add scopes:
     - `.../auth/userinfo.email`
     - `.../auth/userinfo.profile`
     - `openid`

4. **Set Redirect URIs**:
   - Authorized JavaScript origins:
     - `https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com`
     - `https://swnhlzcodsnpsqpxaxov.supabase.co`
   - Authorized redirect URIs:
     - `https://swnhlzcodsnpsqpxaxov.supabase.co/functions/v1/cloud-storage-auth`

5. **Save Credentials**:
   - Copy **Client ID**
   - Copy **Client Secret**

### 3. Configure Dropbox

1. **Go to Dropbox App Console** (https://www.dropbox.com/developers/apps)

2. **Create New App**:
   - Access type: **Scoped access**
   - Access level: **App folder**
   - App name: `VirtualTours Backup`

3. **Configure Permissions**:
   - Required scopes:
     - `files.content.write`
     - `files.content.read`

4. **Set Redirect URIs**:
   - Add: `https://swnhlzcodsnpsqpxaxov.supabase.co/functions/v1/cloud-storage-auth`

5. **Save Credentials**:
   - Copy **App Key**
   - Copy **App Secret**

### 4. Generate Encryption Key

Generate a secure 256-bit (64 hex characters) encryption key:

**Option 1: Browser Console**
```javascript
Array.from(crypto.getRandomValues(new Uint8Array(32)))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('')
```

**Option 2: Node.js**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option 3: OpenSSL**
```bash
openssl rand -hex 32
```

### 5. Add Secrets to Lovable Cloud

Add these **5 secrets** via Lovable Cloud dashboard:

| Secret Name | Value | Source |
|-------------|-------|--------|
| `GOOGLE_DRIVE_CLIENT_ID` | Your Google Client ID | Google Cloud Console |
| `GOOGLE_DRIVE_CLIENT_SECRET` | Your Google Client Secret | Google Cloud Console |
| `DROPBOX_APP_KEY` | Your Dropbox App Key | Dropbox App Console |
| `DROPBOX_APP_SECRET` | Your Dropbox App Secret | Dropbox App Console |
| `CLOUD_ENCRYPTION_KEY` | 64-character hex string | Generated above |

---

## 🚀 Usage

### Connecting a Cloud Provider

1. Navigate to **Backups** page in your app
2. Click **"Cloud Storage Settings"**
3. Choose provider (Google Drive or Dropbox)
4. Click **"Connect"**
5. Authorize access in popup window
6. Confirm connection successful

### Testing Connection

After connecting, click the **"Test"** button to verify:
- Token is valid and decrypts correctly
- API access works
- Automatic token refresh works if expired

### Automatic Backup Sync

Once connected, backups are automatically synced to cloud storage:

1. User creates backup via UI
2. Backup is processed and stored locally in Supabase Storage
3. Background worker (`cloud-sync-worker`) triggers automatically
4. Encrypted tokens are decrypted for API access
5. File is uploaded to configured cloud provider
6. Sync history record is created
7. Cloud file mapping is stored

### Disconnecting

Click **"Disconnect"** to deactivate cloud storage integration.
- Tokens remain encrypted in database but marked as inactive
- No new backups will sync to that provider
- Existing cloud files remain untouched

---

## 🔍 Monitoring & Debugging

### View Sync History

```sql
SELECT 
  bsh.id,
  bsh.sync_type,
  bsh.status,
  bsh.files_synced,
  bsh.total_size_bytes / 1024 / 1024 as size_mb,
  bsh.error_message,
  bsh.started_at,
  bsh.completed_at,
  bd.cloud_provider
FROM backup_sync_history bsh
JOIN backup_destinations bd ON bsh.destination_id = bd.id
ORDER BY bsh.started_at DESC
LIMIT 20;
```

### Check Active Destinations

```sql
SELECT 
  id,
  tenant_id,
  cloud_provider,
  is_active,
  last_backup_at,
  created_at
FROM backup_destinations
WHERE is_active = true;
```

### View Cloud File Mappings

```sql
SELECT 
  cfm.cloud_file_name,
  cfm.cloud_file_path,
  cfm.file_size_bytes / 1024 / 1024 as size_mb,
  cfm.created_at,
  bd.cloud_provider
FROM cloud_file_mappings cfm
JOIN backup_destinations bd ON cfm.destination_id = bd.id
ORDER BY cfm.created_at DESC
LIMIT 20;
```

### Edge Function Logs

**cloud-storage-auth logs:**
```bash
# View in Lovable Cloud → Backend → Edge Functions → cloud-storage-auth → Logs
```

Look for:
- `✅ Generated Google Drive OAuth URL`
- `🔒 Tokens encrypted, storing in database`
- `✅ Cloud destination configured successfully`
- `🔄 Access token expired, refreshing...`

**cloud-sync-worker logs:**
```bash
# View in Lovable Cloud → Backend → Edge Functions → cloud-sync-worker → Logs
```

Look for:
- `📥 Downloading backup from storage`
- `📤 Uploading to Google Drive...`
- `✅ Uploaded to Google Drive: {fileId}`
- `🔄 Token expired, refreshing Google Drive token...`

---

## ⚠️ Troubleshooting

### Error: "Google OAuth error: redirect_uri_mismatch"

**Cause**: Redirect URI not configured correctly in Google Cloud Console

**Solution**:
1. Go to Google Cloud Console → Credentials
2. Edit your OAuth Client ID
3. Add exact redirect URI: `https://swnhlzcodsnpsqpxaxov.supabase.co/functions/v1/cloud-storage-auth`
4. Save changes and wait 5 minutes for propagation

### Error: "Token refresh failed"

**Cause**: Refresh token invalid or expired

**Solution**:
1. Disconnect the provider
2. Reconnect and re-authorize
3. Ensure `access_type=offline` and `prompt=consent` in OAuth URL

### Error: "Encryption key not configured"

**Cause**: `CLOUD_ENCRYPTION_KEY` secret not set

**Solution**:
1. Generate encryption key (see Setup Instructions)
2. Add secret via Lovable Cloud dashboard
3. Redeploy edge functions

### Error: "Upload failed: 401 Unauthorized"

**Cause**: Token expired and refresh failed

**Solution**:
1. Check edge function logs for detailed error
2. Verify refresh token is stored correctly
3. Test connection via UI
4. If issue persists, reconnect provider

---

## 🔒 Security Best Practices

1. ✅ **Never log decrypted tokens** - Always use `console.log('Token: ***')` in production
2. ✅ **Rotate encryption key periodically** - Update `CLOUD_ENCRYPTION_KEY` every 6-12 months
3. ✅ **Use HTTPS only** - All OAuth redirects must use HTTPS
4. ✅ **Limit OAuth scopes** - Only request minimum required permissions
5. ✅ **Monitor failed logins** - Set up alerts for repeated authentication failures
6. ✅ **Regular security audits** - Review sync logs and access patterns monthly

---

## 📊 Database Schema

### backup_destinations

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `tenant_id` | uuid | Tenant owner |
| `destination_type` | text | 'cloud_storage', 'local_download', 'both' |
| `cloud_provider` | text | 'google_drive', 'dropbox' |
| `cloud_access_token` | text | **Encrypted** OAuth access token |
| `cloud_refresh_token` | text | **Encrypted** OAuth refresh token |
| `cloud_folder_id` | text | Cloud folder ID/path |
| `cloud_folder_path` | text | Display folder path |
| `is_active` | boolean | Connection active status |
| `last_backup_at` | timestamp | Last successful sync |

### backup_sync_history

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `destination_id` | uuid | FK to backup_destinations |
| `backup_job_id` | uuid | FK to backup_jobs |
| `sync_type` | text | 'full', 'incremental' |
| `status` | text | 'in_progress', 'completed', 'failed' |
| `files_synced` | integer | Number of files synced |
| `total_size_bytes` | bigint | Total data synced |
| `error_message` | text | Error details if failed |
| `started_at` | timestamp | Sync start time |
| `completed_at` | timestamp | Sync completion time |

### cloud_file_mappings

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `destination_id` | uuid | FK to backup_destinations |
| `backup_job_id` | uuid | FK to backup_jobs |
| `tour_id` | uuid | FK to virtual_tours |
| `local_file_url` | text | Supabase Storage URL |
| `cloud_file_id` | text | Cloud provider file ID |
| `cloud_file_path` | text | Full cloud file path |
| `cloud_file_name` | text | File name in cloud |
| `file_size_bytes` | bigint | File size |
| `created_at` | timestamp | Mapping creation time |

---

## 🎓 Additional Resources

- [Google Drive API Documentation](https://developers.google.com/drive/api/v3/about-sdk)
- [Dropbox API Documentation](https://www.dropbox.com/developers/documentation)
- [Web Crypto API (AES-GCM)](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt)
- [OAuth 2.0 Specification](https://oauth.net/2/)

---

## 📝 Change Log

### Version 1.0 (2025-01-30)

✅ Initial release with:
- Google Drive integration
- Dropbox integration
- AES-256-GCM token encryption
- Automatic token refresh
- Background sync worker
- Comprehensive logging
- Error handling and retry logic

---

## 👥 Support

For issues or questions:
1. Check edge function logs in Lovable Cloud
2. Review this documentation
3. Check the troubleshooting section
4. Contact your system administrator

---

**⚡ System Status: PRODUCTION READY**

All security measures implemented and tested. Ready for deployment.
