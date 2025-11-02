-- Separar funciones de trigger para evitar error de password_hash

-- 1. Crear función genérica para updated_at (sin password_hash)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Crear función específica para virtual_tours con password_hash
CREATE OR REPLACE FUNCTION public.update_tour_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at = NOW();
    IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
      NEW.password_updated_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Recrear trigger de virtual_tours para usar la función específica
DROP TRIGGER IF EXISTS update_virtual_tours_updated_at ON virtual_tours;
CREATE TRIGGER update_virtual_tours_updated_at
  BEFORE UPDATE ON virtual_tours
  FOR EACH ROW
  EXECUTE FUNCTION update_tour_timestamps();