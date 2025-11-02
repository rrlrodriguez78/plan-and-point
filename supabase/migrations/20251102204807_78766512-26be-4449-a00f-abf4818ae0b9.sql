-- Fase 3: Función para limpiar cola antes de re-sync
CREATE OR REPLACE FUNCTION public.reset_queue_for_tour(p_tour_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Eliminar fotos completed/failed de la cola para permitir re-encolado
  DELETE FROM photo_sync_queue
  WHERE tour_id = p_tour_id
    AND status IN ('completed', 'failed');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Reset queue for tour %: % items removed', p_tour_id, deleted_count;
  RETURN deleted_count;
END;
$function$;

-- Fase 4: Modificar update_queue_item_status para implementar backoff exponencial
CREATE OR REPLACE FUNCTION public.update_queue_item_status(p_queue_id uuid, p_status text, p_error_message text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_attempts INTEGER;
BEGIN
  -- Obtener intentos actuales
  SELECT attempts INTO v_attempts
  FROM photo_sync_queue
  WHERE id = p_queue_id;
  
  -- Actualizar con backoff exponencial en priority
  UPDATE photo_sync_queue
  SET 
    status = p_status,
    error_message = p_error_message,
    attempts = CASE WHEN p_status = 'failed' THEN attempts + 1 ELSE attempts END,
    priority = CASE 
      WHEN p_status = 'failed' THEN GREATEST(1, priority - attempts - 1) -- Reducir prioridad con más intentos
      ELSE priority 
    END,
    processed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_queue_id;
END;
$function$;