-- Create secure RPC functions to interact with Supabase Vault

-- Function to create a new secret in the vault
CREATE OR REPLACE FUNCTION public.vault_create_secret(
  secret TEXT,
  name TEXT,
  description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  secret_id UUID;
BEGIN
  -- Insert secret into vault.secrets table
  INSERT INTO vault.secrets (secret, name, description)
  VALUES (secret, name, description)
  RETURNING id INTO secret_id;
  
  RETURN secret_id;
END;
$$;

-- Function to read a secret from the vault (decrypted)
CREATE OR REPLACE FUNCTION public.vault_read_secret(
  secret_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  secret_value TEXT;
BEGIN
  -- Read decrypted secret from vault
  SELECT decrypted_secret INTO secret_value
  FROM vault.decrypted_secrets
  WHERE id = secret_id;
  
  IF secret_value IS NULL THEN
    RAISE EXCEPTION 'Secret not found with id: %', secret_id;
  END IF;
  
  RETURN secret_value;
END;
$$;

-- Function to update an existing secret in the vault
CREATE OR REPLACE FUNCTION public.vault_update_secret(
  secret_id UUID,
  new_secret TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
BEGIN
  -- Update secret in vault.secrets table
  UPDATE vault.secrets
  SET secret = new_secret,
      updated_at = NOW()
  WHERE id = secret_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Secret not found with id: %', secret_id;
  END IF;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.vault_create_secret(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_read_secret(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vault_update_secret(UUID, TEXT) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.vault_create_secret IS 'Securely creates a new encrypted secret in Supabase Vault';
COMMENT ON FUNCTION public.vault_read_secret IS 'Retrieves and decrypts a secret from Supabase Vault';
COMMENT ON FUNCTION public.vault_update_secret IS 'Updates an existing encrypted secret in Supabase Vault';