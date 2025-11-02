-- Función para crear automáticamente configuración de backup cuando se crea un tour
CREATE OR REPLACE FUNCTION public.auto_create_tour_backup_config()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destination_id uuid;
BEGIN
  -- Buscar si existe un backup_destination activo para este tenant
  SELECT id INTO v_destination_id
  FROM backup_destinations
  WHERE tenant_id = NEW.tenant_id
    AND is_active = true
    AND cloud_provider = 'google_drive'
  LIMIT 1;

  -- Si existe un destination activo, crear la config de backup automáticamente
  IF v_destination_id IS NOT NULL THEN
    INSERT INTO tour_backup_config (
      tour_id,
      tenant_id,
      destination_id,
      auto_backup_enabled,
      backup_type,
      backup_frequency,
      backup_on_create,
      backup_on_update
    ) VALUES (
      NEW.id,
      NEW.tenant_id,
      v_destination_id,
      true, -- Por defecto habilitado
      'full_backup',
      'immediate',
      true,
      true
    )
    ON CONFLICT (tour_id) DO NOTHING; -- Evitar duplicados
  END IF;

  RETURN NEW;
END;
$$;

-- Crear trigger que se ejecuta después de insertar un tour
DROP TRIGGER IF EXISTS trigger_auto_create_backup_config ON virtual_tours;
CREATE TRIGGER trigger_auto_create_backup_config
AFTER INSERT ON virtual_tours
FOR EACH ROW
EXECUTE FUNCTION auto_create_tour_backup_config();

COMMENT ON FUNCTION auto_create_tour_backup_config() IS 'Crea automáticamente configuración de backup cuando se crea un tour y existe un destination activo';
COMMENT ON TRIGGER trigger_auto_create_backup_config ON virtual_tours IS 'Activa la creación automática de config de backup para nuevos tours';