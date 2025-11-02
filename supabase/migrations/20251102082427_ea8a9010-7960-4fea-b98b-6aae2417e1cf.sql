-- Fix: Add protection to update_password_timestamp trigger
-- This prevents the trigger from accessing NEW.password_hash during DELETE operations

CREATE OR REPLACE FUNCTION public.update_password_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Only execute during UPDATE operations when NEW exists
  IF TG_OP = 'UPDATE' AND NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.password_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$function$;