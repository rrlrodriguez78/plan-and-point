-- Arreglar search_path en función update_password_timestamp
CREATE OR REPLACE FUNCTION public.update_password_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.password_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;