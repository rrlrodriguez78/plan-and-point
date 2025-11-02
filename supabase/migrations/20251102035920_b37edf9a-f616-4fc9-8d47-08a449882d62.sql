-- Recrear triggers para auto-backup en virtual_tours
DROP TRIGGER IF EXISTS auto_backup_on_tour_create ON virtual_tours;
DROP TRIGGER IF EXISTS auto_backup_on_tour_update ON virtual_tours;

-- Trigger para crear backup cuando se inserta un nuevo tour
CREATE TRIGGER auto_backup_on_tour_create
  AFTER INSERT ON virtual_tours
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_backup();

-- Trigger para crear backup cuando se actualiza un tour
CREATE TRIGGER auto_backup_on_tour_update  
  AFTER UPDATE ON virtual_tours
  FOR EACH ROW
  WHEN (OLD.updated_at IS DISTINCT FROM NEW.updated_at)
  EXECUTE FUNCTION trigger_auto_backup();