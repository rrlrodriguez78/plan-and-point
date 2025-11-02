-- Corregir trigger para usar owner_id del tenant en lugar de auth.uid()
DROP TRIGGER IF EXISTS auto_backup_on_tour_create ON virtual_tours;
DROP TRIGGER IF EXISTS auto_backup_on_tour_update ON virtual_tours;
DROP FUNCTION IF EXISTS trigger_auto_backup();

CREATE OR REPLACE FUNCTION trigger_auto_backup()
RETURNS TRIGGER AS $$
DECLARE
  v_config RECORD;
  v_backup_job_id UUID;
  v_owner_id UUID;
BEGIN
  -- Obtener owner_id del tenant (en lugar de auth.uid() que es NULL en background)
  SELECT owner_id INTO v_owner_id
  FROM tenants
  WHERE id = NEW.tenant_id;
  
  IF v_owner_id IS NULL THEN
    RAISE WARNING 'No owner found for tenant %, skipping auto-backup', NEW.tenant_id;
    RETURN NEW;
  END IF;
  
  -- Buscar configuraciones activas para este tour
  FOR v_config IN 
    SELECT * FROM tour_backup_config
    WHERE tour_id = NEW.id 
    AND auto_backup_enabled = true
    AND (
      (TG_OP = 'INSERT' AND backup_on_create = true) OR
      (TG_OP = 'UPDATE' AND backup_on_update = true AND OLD.updated_at IS DISTINCT FROM NEW.updated_at)
    )
  LOOP
    -- Crear el backup job con owner_id
    INSERT INTO backup_jobs (
      tour_id,
      tenant_id,
      user_id,
      destination_id,
      job_type,
      destination_type,
      status
    ) VALUES (
      NEW.id,
      NEW.tenant_id,
      v_owner_id,  -- Usar owner_id en lugar de auth.uid()
      v_config.destination_id,
      v_config.backup_type,
      'cloud_drive',
      'pending'
    )
    RETURNING id INTO v_backup_job_id;
    
    -- Agregar a la cola de procesamiento
    INSERT INTO backup_queue (
      backup_job_id,
      status,
      priority,
      scheduled_at
    ) VALUES (
      v_backup_job_id,
      'pending',
      2, -- Prioridad alta para auto-backups
      NOW()
    );
    
    -- Actualizar timestamp de último backup
    UPDATE tour_backup_config
    SET last_auto_backup_at = NOW()
    WHERE id = v_config.id;
    
    RAISE NOTICE 'Auto-backup job created: % for tour: % (owner: %)', v_backup_job_id, NEW.id, v_owner_id;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recrear triggers
CREATE TRIGGER auto_backup_on_tour_create
  AFTER INSERT ON virtual_tours
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_backup();

CREATE TRIGGER auto_backup_on_tour_update
  AFTER UPDATE ON virtual_tours
  FOR EACH ROW
  WHEN (OLD.updated_at IS DISTINCT FROM NEW.updated_at)
  EXECUTE FUNCTION trigger_auto_backup();