-- Verificar que la función trigger_auto_backup existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'trigger_auto_backup' 
    AND pronamespace = 'public'::regnamespace
  ) THEN
    RAISE EXCEPTION 'Function trigger_auto_backup does not exist';
  END IF;
END $$;

-- Eliminar triggers existentes (por seguridad)
DROP TRIGGER IF EXISTS auto_backup_on_tour_create ON virtual_tours;
DROP TRIGGER IF EXISTS auto_backup_on_tour_update ON virtual_tours;

-- Crear trigger para INSERT (nuevo tour)
CREATE TRIGGER auto_backup_on_tour_create
  AFTER INSERT ON virtual_tours
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_backup();

-- Crear trigger para UPDATE (actualización de tour)
CREATE TRIGGER auto_backup_on_tour_update  
  AFTER UPDATE ON virtual_tours
  FOR EACH ROW
  WHEN (OLD.updated_at IS DISTINCT FROM NEW.updated_at)
  EXECUTE FUNCTION trigger_auto_backup();

-- Comentarios para documentación
COMMENT ON TRIGGER auto_backup_on_tour_create ON virtual_tours IS 
  'Automatically creates backup jobs when a new tour is created if auto_backup is enabled';

COMMENT ON TRIGGER auto_backup_on_tour_update ON virtual_tours IS 
  'Automatically creates backup jobs when a tour is updated (timestamp change) if auto_backup is enabled';