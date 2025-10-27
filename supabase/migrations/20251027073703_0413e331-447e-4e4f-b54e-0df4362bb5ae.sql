-- Versión mejorada de complete_large_backup_upload con métricas
CREATE OR REPLACE FUNCTION complete_large_backup_upload(
  p_upload_token TEXT
) RETURNS JSONB AS $$
DECLARE
  v_upload_id UUID;
  v_user_id UUID;
  v_total_chunks INTEGER;
  v_received_chunks INTEGER;
  v_backup_name TEXT;
  v_description TEXT;
  v_device_info JSONB;
  v_complete_data TEXT;
  v_settings_snapshot JSONB;
  v_backup_id UUID;
  v_start_time TIMESTAMP := NOW();
  v_data_size BIGINT;
BEGIN
  -- Obtener información del upload
  SELECT 
    lub.id, 
    lub.user_id, 
    lub.total_chunks,
    lub.backup_name,
    lub.description,
    lub.device_info
  INTO v_upload_id, v_user_id, v_total_chunks, v_backup_name, v_description, v_device_info
  FROM public.large_backup_upload lub
  WHERE lub.upload_token = p_upload_token AND lub.status = 'uploading';
  
  IF v_upload_id IS NULL THEN
    PERFORM log_backup_metric(
      'upload_failed', false, NULL, NULL, NULL, NULL,
      'Upload not found or not in uploading status'
    );
    RAISE EXCEPTION 'Upload not found or not in uploading status';
  END IF;
  
  -- Verificar propiedad
  IF v_user_id != auth.uid() THEN
    PERFORM log_backup_metric(
      'upload_failed', false, v_upload_id, NULL, NULL, NULL, 'Access denied'
    );
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Contar chunks recibidos
  SELECT COUNT(*) INTO v_received_chunks
  FROM public.backup_chunks
  WHERE upload_id = v_upload_id;
  
  -- Verificar que tenemos todos los chunks
  IF v_received_chunks != v_total_chunks THEN
    PERFORM log_backup_metric(
      'upload_failed', false, v_upload_id, NULL, NULL, NULL,
      'Missing chunks. Received: ' || v_received_chunks || ', Expected: ' || v_total_chunks
    );
    RAISE EXCEPTION 'Missing chunks. Received: %, Expected: %', v_received_chunks, v_total_chunks;
  END IF;
  
  -- Reconstruir datos completos
  SELECT string_agg(chunk_data, '' ORDER BY chunk_number) INTO v_complete_data
  FROM public.backup_chunks
  WHERE upload_id = v_upload_id;
  
  -- Calcular tamaño
  v_data_size := length(v_complete_data);
  
  -- Convertir a JSONB (validar que es JSON válido)
  BEGIN
    v_settings_snapshot := v_complete_data::JSONB;
  EXCEPTION
    WHEN others THEN
      PERFORM log_backup_metric(
        'upload_failed', false, v_upload_id, NULL, NULL, v_data_size, 'Invalid JSON data in backup'
      );
      RAISE EXCEPTION 'Invalid JSON data in backup';
  END;
  
  -- Marcar upload como completado
  UPDATE public.large_backup_upload
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = v_upload_id;
  
  -- Registrar métrica de éxito
  PERFORM log_backup_metric(
    'upload_complete', 
    true, 
    v_upload_id, 
    NULL, 
    NOW() - v_start_time, 
    v_data_size, 
    NULL
  );
  
  -- Retornar datos completos como JSONB
  RETURN v_settings_snapshot;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;