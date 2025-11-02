-- Fix: Add protection to update_updated_at_column trigger
-- This prevents the trigger from accessing NEW.password_hash during DELETE operations

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Only execute during UPDATE operations when NEW exists
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at = NOW();
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
      NEW.password_updated_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;