-- Add unique constraint to tour_backup_config to prevent duplicates
ALTER TABLE tour_backup_config 
ADD CONSTRAINT tour_backup_config_tour_destination_unique 
UNIQUE (tour_id, destination_id);

-- Update the auto_create_tour_backup_config function to use the correct ON CONFLICT
CREATE OR REPLACE FUNCTION public.auto_create_tour_backup_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      true,
      'full_backup',
      'immediate',
      true,
      true
    )
    ON CONFLICT (tour_id, destination_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;