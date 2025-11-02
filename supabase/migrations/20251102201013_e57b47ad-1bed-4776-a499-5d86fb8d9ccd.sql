-- Fase 1: Limpiar job atascado actual y crear sistema de detección (FORMATO CORREGIDO)

-- 1. Limpiar el job atascado específico
UPDATE sync_jobs 
SET status = 'failed', 
    completed_at = NOW(),
    error_messages = jsonb_build_array(
      jsonb_build_object(
        'error', 'Job was stalled and cleaned up automatically',
        'timestamp', NOW()::text
      )
    )
WHERE id = 'aa05a8f0-4996-4d15-adf7-37f0136dfdc1'
  AND status = 'processing';

-- 2. Eliminar fotos de la cola para ese tour (si existen)
DELETE FROM photo_sync_queue 
WHERE tour_id = (
  SELECT tour_id FROM sync_jobs WHERE id = 'aa05a8f0-4996-4d15-adf7-37f0136dfdc1'
);

-- 3. Crear función para detectar y limpiar jobs atascados
CREATE OR REPLACE FUNCTION cleanup_stalled_jobs()
RETURNS TABLE(
  cleaned_job_id uuid,
  tour_id uuid,
  stalled_for_minutes integer
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cleaned_count INTEGER := 0;
BEGIN
  -- Marcar como 'failed' los jobs que están en 'processing' por más de 15 minutos
  -- y retornar la información de los jobs limpiados
  RETURN QUERY
  WITH stalled AS (
    SELECT 
      sj.id,
      sj.tour_id,
      EXTRACT(EPOCH FROM (NOW() - sj.created_at)) / 60 AS minutes_stalled
    FROM sync_jobs sj
    WHERE sj.status = 'processing'
      AND sj.created_at < NOW() - INTERVAL '15 minutes'
  ),
  updated AS (
    UPDATE sync_jobs
    SET 
      status = 'failed',
      completed_at = NOW(),
      error_messages = COALESCE(error_messages, '[]'::jsonb) || 
                       jsonb_build_array(
                         jsonb_build_object(
                           'error', 'Job timeout - stalled for more than 15 minutes',
                           'timestamp', NOW()::text
                         )
                       )
    FROM stalled
    WHERE sync_jobs.id = stalled.id
    RETURNING sync_jobs.id, sync_jobs.tour_id
  )
  SELECT 
    u.id::uuid,
    u.tour_id::uuid,
    s.minutes_stalled::integer
  FROM updated u
  JOIN stalled s ON s.id = u.id;
  
  -- Log cleanup results
  GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % stalled jobs', v_cleaned_count;
END;
$$;

-- 4. Crear función para limpiar cola de un job cancelado
CREATE OR REPLACE FUNCTION cleanup_queue_for_job(p_job_id uuid)
RETURNS integer
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_tour_id uuid;
  v_deleted_count integer := 0;
BEGIN
  -- Obtener tour_id del job
  SELECT tour_id INTO v_tour_id
  FROM sync_jobs
  WHERE id = p_job_id;
  
  IF v_tour_id IS NULL THEN
    RAISE NOTICE 'Job % not found', p_job_id;
    RETURN 0;
  END IF;
  
  -- Eliminar fotos pending de la cola
  DELETE FROM photo_sync_queue
  WHERE tour_id = v_tour_id
    AND status = 'pending';
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Marcar fotos processing como failed
  UPDATE photo_sync_queue
  SET 
    status = 'failed',
    error_message = 'Job was cancelled',
    updated_at = NOW()
  WHERE tour_id = v_tour_id
    AND status = 'processing';
  
  RAISE NOTICE 'Cleaned up queue for job %: % pending deleted, processing marked as failed', p_job_id, v_deleted_count;
  
  RETURN v_deleted_count;
END;
$$;

-- 5. Configurar pg_cron para ejecutar limpieza cada hora
SELECT cron.schedule(
  'cleanup-stalled-sync-jobs',
  '0 * * * *', -- cada hora en punto
  $$
  SELECT cleanup_stalled_jobs();
  $$
);