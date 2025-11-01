-- Ensure backup_destinations has cloud_access_token and cloud_refresh_token columns
DO $$
BEGIN
  -- Add cloud_access_token column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'backup_destinations' 
    AND column_name = 'cloud_access_token'
  ) THEN
    ALTER TABLE public.backup_destinations 
    ADD COLUMN cloud_access_token TEXT;
  END IF;

  -- Add cloud_refresh_token column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'backup_destinations' 
    AND column_name = 'cloud_refresh_token'
  ) THEN
    ALTER TABLE public.backup_destinations 
    ADD COLUMN cloud_refresh_token TEXT;
  END IF;

  -- Drop old vault secret ID columns if they exist
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'backup_destinations' 
    AND column_name = 'cloud_access_token_secret_id'
  ) THEN
    ALTER TABLE public.backup_destinations 
    DROP COLUMN cloud_access_token_secret_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'backup_destinations' 
    AND column_name = 'cloud_refresh_token_secret_id'
  ) THEN
    ALTER TABLE public.backup_destinations 
    DROP COLUMN cloud_refresh_token_secret_id;
  END IF;
END $$;

-- Drop vault RPC functions if they exist (no longer needed)
DROP FUNCTION IF EXISTS public.vault_create_secret(text, text, text);
DROP FUNCTION IF EXISTS public.vault_read_secret(uuid);
DROP FUNCTION IF EXISTS public.vault_update_secret(uuid, text);