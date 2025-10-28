-- Trigger para limpiar backups cuando se elimina un tour
CREATE OR REPLACE FUNCTION cleanup_backup_jobs_on_tour_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Marcar todos los backup jobs del tour como cancelados
  UPDATE backup_jobs
  SET status = 'cancelled',
      error_message = 'Tour was deleted',
      completed_at = NOW()
  WHERE tour_id = OLD.id
  AND status IN ('pending', 'processing');
  
  -- Cancelar entradas en la cola de backup
  UPDATE backup_queue
  SET status = 'failed',
      error_message = 'Tour was deleted',
      completed_at = NOW()
  WHERE backup_job_id IN (
    SELECT id FROM backup_jobs WHERE tour_id = OLD.id
  )
  AND status IN ('pending', 'processing', 'retry');
  
  -- Opcional: Eliminar backups muy antiguos (más de 7 días)
  DELETE FROM backup_jobs
  WHERE tour_id = OLD.id
  AND created_at < NOW() - INTERVAL '7 days';
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el trigger
DROP TRIGGER IF EXISTS trigger_cleanup_backups_on_tour_delete ON virtual_tours;
CREATE TRIGGER trigger_cleanup_backups_on_tour_delete
  BEFORE DELETE ON virtual_tours
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_backup_jobs_on_tour_delete();

-- Función para limpieza manual de backups huérfanos
CREATE OR REPLACE FUNCTION cleanup_orphaned_backups()
RETURNS TABLE(
  deleted_count INTEGER,
  cancelled_count INTEGER
) AS $$
DECLARE
  v_deleted INTEGER := 0;
  v_cancelled INTEGER := 0;
BEGIN
  -- Cancelar backups activos de tours eliminados
  WITH cancelled AS (
    UPDATE backup_jobs bj
    SET status = 'cancelled',
        error_message = 'Tour no longer exists',
        completed_at = NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM virtual_tours vt WHERE vt.id = bj.tour_id
    )
    AND status IN ('pending', 'processing')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_cancelled FROM cancelled;
  
  -- Eliminar backups antiguos de tours eliminados (más de 7 días)
  WITH deleted AS (
    DELETE FROM backup_jobs bj
    WHERE NOT EXISTS (
      SELECT 1 FROM virtual_tours vt WHERE vt.id = bj.tour_id
    )
    AND created_at < NOW() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;
  
  RETURN QUERY SELECT v_deleted, v_cancelled;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ejecutar limpieza inicial
SELECT * FROM cleanup_orphaned_backups();