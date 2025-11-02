-- Función para habilitar auto-backup en todos los tours existentes de un tenant
CREATE OR REPLACE FUNCTION public.enable_auto_backup_for_existing_tours(p_tenant_id uuid)
RETURNS TABLE (
  tours_updated integer,
  configs_created integer
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_destination_id uuid;
  v_tours_count integer := 0;
  v_configs_count integer := 0;
  v_tour record;
BEGIN
  -- Buscar el destination activo para este tenant
  SELECT id INTO v_destination_id
  FROM backup_destinations
  WHERE tenant_id = p_tenant_id
    AND is_active = true
    AND cloud_provider = 'google_drive'
  LIMIT 1;

  -- Si no hay destination, no hacer nada
  IF v_destination_id IS NULL THEN
    RAISE NOTICE 'No active backup destination found for tenant %', p_tenant_id;
    RETURN QUERY SELECT 0::integer, 0::integer;
    RETURN;
  END IF;

  -- Para cada tour del tenant que no tiene config de backup
  FOR v_tour IN 
    SELECT vt.id, vt.tenant_id
    FROM virtual_tours vt
    LEFT JOIN tour_backup_config tbc ON tbc.tour_id = vt.id
    WHERE vt.tenant_id = p_tenant_id
      AND tbc.id IS NULL
  LOOP
    -- Crear configuración de backup
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
      v_tour.id,
      v_tour.tenant_id,
      v_destination_id,
      true,
      'full_backup',
      'immediate',
      true,
      true
    )
    ON CONFLICT (tour_id) DO NOTHING;
    
    v_configs_count := v_configs_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_tours_count, v_configs_count;
END;
$$;

COMMENT ON FUNCTION enable_auto_backup_for_existing_tours(uuid) IS 'Habilita auto-backup para todos los tours existentes de un tenant que no tienen configuración';