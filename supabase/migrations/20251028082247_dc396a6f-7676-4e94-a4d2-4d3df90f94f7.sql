-- Crear tabla de logs para backups
CREATE TABLE IF NOT EXISTS backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_job_id UUID NOT NULL REFERENCES backup_jobs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  is_error BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para la tabla de logs
CREATE INDEX IF NOT EXISTS idx_backup_logs_job_id ON backup_logs(backup_job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_logs_event_type ON backup_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_backup_logs_errors ON backup_logs(is_error) WHERE is_error = true;

-- RLS para la tabla de logs
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view logs for their backup jobs" ON backup_logs;
CREATE POLICY "Users can view logs for their backup jobs" ON backup_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM backup_jobs
    WHERE backup_jobs.id = backup_logs.backup_job_id
    AND backup_jobs.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Service role can manage all logs" ON backup_logs;
CREATE POLICY "Service role can manage all logs" ON backup_logs
FOR ALL USING (true);

-- Eliminar función anterior
DROP FUNCTION IF EXISTS process_backup_queue();

-- Función worker mejorada para procesar la cola
CREATE FUNCTION process_backup_queue()
RETURNS TABLE(processed_count integer, failed_count integer, total_processed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    queue_item RECORD;
    backup_job RECORD;
    max_concurrent INTEGER := 3;
    current_processing INTEGER;
    processed INTEGER := 0;
    failed INTEGER := 0;
    total INTEGER := 0;
    timeout_minutes INTEGER := 30;
BEGIN
    SELECT COUNT(*) INTO current_processing 
    FROM backup_queue 
    WHERE status = 'processing' 
    AND started_at > NOW() - (timeout_minutes || ' minutes')::interval;

    FOR queue_item IN (
        SELECT 
            bq.id as queue_id,
            bq.backup_job_id,
            bq.attempts,
            bq.max_attempts,
            bj.tour_id,
            bj.user_id,
            bj.job_type,
            bj.estimated_size_mb
        FROM backup_queue bq
        JOIN backup_jobs bj ON bq.backup_job_id = bj.id
        WHERE bq.status IN ('pending', 'retry')
        AND bq.scheduled_at <= NOW()
        AND bq.attempts < bq.max_attempts
        ORDER BY 
            bq.priority DESC,
            bq.scheduled_at ASC,
            bj.estimated_size_mb ASC
        LIMIT GREATEST(0, max_concurrent - current_processing)
        FOR UPDATE SKIP LOCKED
    ) LOOP
        BEGIN
            UPDATE backup_queue 
            SET 
                status = 'processing',
                started_at = NOW(),
                attempts = attempts + 1,
                locked_until = NOW() + (timeout_minutes || ' minutes')::interval
            WHERE id = queue_item.queue_id;

            SELECT * INTO backup_job
            FROM backup_jobs 
            WHERE id = queue_item.backup_job_id;

            UPDATE backup_jobs 
            SET 
                status = 'processing',
                processed_items = 0,
                progress_percentage = 0
            WHERE id = queue_item.backup_job_id;

            INSERT INTO backup_logs (backup_job_id, event_type, message, details)
            VALUES (
                queue_item.backup_job_id, 
                'processing_started', 
                'Backup processing started via queue worker',
                jsonb_build_object(
                    'queue_id', queue_item.queue_id,
                    'attempt', queue_item.attempts + 1,
                    'estimated_size_mb', queue_item.estimated_size_mb
                )
            );

            PERFORM extensions.http_post(
                url := 'https://swnhlzcodsnpsqpxaxov.supabase.co/functions/v1/backup-processor',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || current_setting('service_role.jwt_secret', true)
                ),
                body := jsonb_build_object(
                    'action', 'process_queue',
                    'queueId', queue_item.queue_id,
                    'backupJobId', queue_item.backup_job_id
                )
            );

            processed := processed + 1;
            total := total + 1;

        EXCEPTION WHEN OTHERS THEN
            failed := failed + 1;
            total := total + 1;

            IF queue_item.attempts + 1 >= queue_item.max_attempts THEN
                UPDATE backup_queue 
                SET 
                    status = 'failed',
                    error_message = SQLERRM,
                    completed_at = NOW(),
                    locked_until = NULL
                WHERE id = queue_item.queue_id;

                UPDATE backup_jobs 
                SET 
                    status = 'failed',
                    error_message = SQLERRM,
                    completed_at = NOW()
                WHERE id = queue_item.backup_job_id;
            ELSE
                UPDATE backup_queue 
                SET 
                    status = 'retry',
                    error_message = SQLERRM,
                    scheduled_at = NOW() + ((queue_item.attempts * 5) || ' minutes')::interval,
                    locked_until = NULL
                WHERE id = queue_item.queue_id;
            END IF;

            INSERT INTO backup_logs (backup_job_id, event_type, message, details, is_error)
            VALUES (
                queue_item.backup_job_id, 
                'processing_error', 
                'Backup processing failed',
                jsonb_build_object(
                    'error_message', SQLERRM,
                    'attempt', queue_item.attempts + 1,
                    'max_attempts', queue_item.max_attempts
                ),
                true
            );
        END;
    END LOOP;

    UPDATE backup_queue 
    SET 
        status = 'retry',
        error_message = 'Job stuck in processing state - retrying',
        scheduled_at = NOW() + INTERVAL '1 minute',
        locked_until = NULL
    WHERE status = 'processing' 
    AND started_at < NOW() - (timeout_minutes || ' minutes')::interval;

    RETURN QUERY SELECT processed, failed, total;
END;
$$;

COMMENT ON FUNCTION process_backup_queue() IS 
'Processes pending backup jobs from the queue with concurrency control, retry logic, and stuck job recovery';

-- Actualizar cron job
SELECT cron.unschedule('process-backup-queue');

SELECT cron.schedule(
    'process-backup-queue',
    '* * * * *',
    $$
    WITH stats AS (
        SELECT * FROM process_backup_queue()
    )
    SELECT 
        CASE 
            WHEN processed_count > 0 OR failed_count > 0 
            THEN format('Processed: %s, Failed: %s, Total: %s', 
                processed_count, failed_count, total_processed)
            ELSE 'No jobs to process'
        END as result
    FROM stats;
    $$
);