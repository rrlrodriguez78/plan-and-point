-- Habilitar extensión pg_net si no está habilitada
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Función para sincronizar fotos automáticamente a Google Drive
CREATE OR REPLACE FUNCTION public.auto_sync_photo_to_drive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_tenant_id UUID;
  v_destination_active BOOLEAN;
BEGIN
  -- Obtener tenant_id del tour asociado
  SELECT vt.tenant_id INTO v_tenant_id
  FROM panorama_photos pp
  JOIN hotspots h ON pp.hotspot_id = h.id
  JOIN floor_plans fp ON h.floor_plan_id = fp.id
  JOIN virtual_tours vt ON fp.tour_id = vt.id
  WHERE pp.id = NEW.id;

  -- Verificar si existe un backup destination activo para Google Drive
  SELECT EXISTS(
    SELECT 1 FROM backup_destinations
    WHERE tenant_id = v_tenant_id
    AND is_active = true
    AND cloud_provider = 'google_drive'
  ) INTO v_destination_active;

  -- Solo intentar sincronizar si hay un destination activo
  IF v_destination_active THEN
    -- Llamar al edge function de forma asíncrona (no bloqueante)
    PERFORM extensions.http_post(
      url := 'https://swnhlzcodsnpsqpxaxov.supabase.co/functions/v1/photo-sync-to-drive',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_key', true)
      ),
      body := jsonb_build_object(
        'action', 'sync_photo',
        'photoId', NEW.id,
        'tenantId', v_tenant_id
      )
    );
    
    RAISE NOTICE 'Photo sync initiated for photo ID: % (tenant: %)', NEW.id, v_tenant_id;
  ELSE
    RAISE NOTICE 'No active Google Drive destination for tenant %, skipping photo sync', v_tenant_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Crear trigger para sincronizar fotos automáticamente al insertarse
DROP TRIGGER IF EXISTS trigger_auto_sync_photo_to_drive ON panorama_photos;

CREATE TRIGGER trigger_auto_sync_photo_to_drive
  AFTER INSERT ON panorama_photos
  FOR EACH ROW
  EXECUTE FUNCTION auto_sync_photo_to_drive();

COMMENT ON FUNCTION auto_sync_photo_to_drive() IS 'Sincroniza automáticamente fotos nuevas a Google Drive cuando se suben';
COMMENT ON TRIGGER trigger_auto_sync_photo_to_drive ON panorama_photos IS 'Ejecuta la sincronización automática de fotos a Google Drive';