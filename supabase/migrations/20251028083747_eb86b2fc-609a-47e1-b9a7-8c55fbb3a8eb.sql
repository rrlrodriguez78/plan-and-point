-- Actualizar la función process_backup_queue para usar el worker
CREATE OR REPLACE FUNCTION process_backup_queue()
RETURNS TABLE(processed_count integer, failed_count integer, total_processed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    worker_url TEXT := 'https://swnhlzcodsnpsqpxaxov.supabase.co/functions/v1/backup-worker';
    service_key TEXT;
    processed INTEGER := 0;
    failed INTEGER := 0;
    total_processed INTEGER := 0;
    worker_response JSON;
BEGIN
    -- Obtener la service key desde las variables de entorno
    service_key := current_setting('app.settings.service_key', true);
    
    -- Si no está configurada, usar un valor por defecto (solo para desarrollo)
    IF service_key IS NULL THEN
        RAISE NOTICE 'Service key not configured, using default';
    END IF;

    -- Llamar al worker para procesar la cola
    SELECT content INTO worker_response
    FROM extensions.http((
        'POST',
        worker_url,
        ARRAY[extensions.http_header('Authorization', 'Bearer ' || service_key),
              extensions.http_header('Content-Type', 'application/json')],
        'application/json',
        json_build_object(
            'action', 'process_queue',
            'maxJobs', 3
        )::text
    )::extensions.http_request);

    -- Procesar respuesta del worker
    IF worker_response IS NOT NULL THEN
        processed := (worker_response->>'processed')::integer;
        failed := (worker_response->>'failed')::integer;
        total_processed := processed + failed;
        
        RAISE NOTICE 'Worker processed % jobs (% successful, % failed)', 
            total_processed, processed, failed;
    ELSE
        RAISE WARNING 'Worker returned no response';
    END IF;

    -- Limpiar trabajos stuck manualmente como fallback
    PERFORM cleanup_stuck_jobs_fallback();

    RETURN QUERY SELECT processed, failed, total_processed;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error calling backup worker: %', SQLERRM;
        
        -- Fallback: procesamiento básico local
        SELECT * INTO processed, failed, total_processed 
        FROM process_backup_queue_fallback();
        
        RETURN QUERY SELECT processed, failed, total_processed;
END;
$$;

-- Función fallback para cuando el worker no está disponible
CREATE OR REPLACE FUNCTION process_backup_queue_fallback()
RETURNS TABLE(processed integer, failed integer, total_processed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_processed INTEGER := 0;
    v_failed INTEGER := 0;
    v_total INTEGER := 0;
BEGIN
    -- Implementación básica de procesamiento local
    -- Marcar trabajos muy antiguos como fallidos
    WITH updated AS (
        UPDATE backup_queue 
        SET status = 'failed',
            error_message = 'Processing timeout - system fallback',
            completed_at = NOW()
        WHERE status = 'processing'
        AND started_at < NOW() - INTERVAL '1 hour'
        RETURNING id
    )
    SELECT COUNT(*) INTO v_failed FROM updated;

    -- Simular algún procesamiento exitoso para mantener las estadísticas
    v_processed := 0;
    v_total := v_failed;

    RETURN QUERY SELECT v_processed, v_failed, v_total;
END;
$$;

-- Función para limpiar trabajos stuck
CREATE OR REPLACE FUNCTION cleanup_stuck_jobs_fallback()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Resetear trabajos en procesamiento por más de 30 minutos
    UPDATE backup_queue 
    SET status = 'retry',
        error_message = 'Reset after timeout',
        scheduled_at = NOW() + INTERVAL '5 minutes'
    WHERE status = 'processing'
    AND started_at < NOW() - INTERVAL '30 minutes';

    -- Limpiar trabajos fallidos muy antiguos
    DELETE FROM backup_queue 
    WHERE status = 'failed'
    AND completed_at < NOW() - INTERVAL '7 days';

    RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$$;