-- Migrate backup_destinations to use Supabase Vault for secure token storage

-- Add new columns for Vault secret IDs
ALTER TABLE backup_destinations 
ADD COLUMN IF NOT EXISTS cloud_access_token_secret_id UUID,
ADD COLUMN IF NOT EXISTS cloud_refresh_token_secret_id UUID;

-- For existing records with tokens, we'll need to store them in Vault
-- This will be handled by the edge function on next connection
-- For now, we mark existing active destinations as inactive to force reconnection
UPDATE backup_destinations 
SET is_active = false,
    cloud_access_token = NULL,
    cloud_refresh_token = NULL
WHERE cloud_provider IS NOT NULL 
AND (cloud_access_token IS NOT NULL OR cloud_refresh_token IS NOT NULL);

-- Drop old plaintext token columns after migration
ALTER TABLE backup_destinations 
DROP COLUMN IF EXISTS cloud_access_token,
DROP COLUMN IF EXISTS cloud_refresh_token;

-- Add comment explaining the security improvement
COMMENT ON COLUMN backup_destinations.cloud_access_token_secret_id IS 'Reference to Supabase Vault secret containing encrypted access token';
COMMENT ON COLUMN backup_destinations.cloud_refresh_token_secret_id IS 'Reference to Supabase Vault secret containing encrypted refresh token';