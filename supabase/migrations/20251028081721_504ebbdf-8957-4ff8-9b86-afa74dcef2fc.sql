-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Agregar columna para bloqueo temporal de jobs
ALTER TABLE backup_queue 
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Función principal para procesar la cola de backups
CREATE OR REPLACE FUNCTION process_backup_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_job record;
    timeout_seconds integer := 300;
    concurrent_jobs integer := 2;
    running_jobs integer;
BEGIN
    -- Verificar trabajos en ejecución
    SELECT COUNT(*) INTO running_jobs 
    FROM backup_queue 
    WHERE status = 'processing' 
    AND started_at > NOW() - (timeout_seconds || ' seconds')::interval;
    
    IF running_jobs >= concurrent_jobs THEN
        RAISE NOTICE 'Máximo de trabajos concurrentes (%) alcanzado', concurrent_jobs;
        RETURN;
    END IF;
    
    -- Buscar próximo trabajo pendiente
    SELECT * INTO current_job
    FROM backup_queue 
    WHERE status IN ('pending', 'retry') 
    AND attempts < max_attempts
    AND (locked_until IS NULL OR locked_until < NOW())
    AND scheduled_at <= NOW()
    ORDER BY 
        priority DESC,
        attempts ASC,
        scheduled_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    IF current_job IS NULL THEN
        RAISE NOTICE 'No hay trabajos pendientes en la cola';
        RETURN;
    END IF;
    
    -- Bloquear el trabajo
    UPDATE backup_queue 
    SET 
        status = 'processing',
        started_at = NOW(),
        locked_until = NOW() + (timeout_seconds || ' seconds')::interval,
        attempts = attempts + 1
    WHERE id = current_job.id;
    
    -- Llamar a Edge Function via pg_net
    BEGIN
        PERFORM extensions.http_post(
            url := 'https://swnhlzcodsnpsqpxaxov.supabase.co/functions/v1/backup-processor',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('service_role.jwt_secret', true)
            ),
            body := jsonb_build_object(
                'action', 'process_queue',
                'queueId', current_job.id,
                'backupJobId', current_job.backup_job_id
            )
        );
        
        RAISE NOTICE 'Backup job % iniciado (queue: %)', 
            current_job.backup_job_id, current_job.id;
            
    EXCEPTION
        WHEN OTHERS THEN
            UPDATE backup_queue 
            SET 
                status = CASE 
                    WHEN attempts >= max_attempts THEN 'failed'
                    ELSE 'retry'
                END,
                error_message = SQLERRM,
                completed_at = CASE 
                    WHEN attempts >= max_attempts THEN NOW()
                    ELSE NULL
                END,
                locked_until = NULL
            WHERE id = current_job.id;
            
            RAISE NOTICE 'Error iniciando backup job %: %', 
                current_job.backup_job_id, SQLERRM;
    END;
END;
$$;

-- Función para limpiar jobs bloqueados
CREATE OR REPLACE FUNCTION cleanup_stalled_backup_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    timeout_seconds integer := 600;
    stalled_count integer;
BEGIN
    WITH updated AS (
        UPDATE backup_queue 
        SET 
            status = CASE 
                WHEN attempts >= max_attempts THEN 'failed'
                ELSE 'retry'
            END,
            error_message = 'Job timeout - exceeded maximum processing time',
            locked_until = NULL,
            completed_at = CASE 
                WHEN attempts >= max_attempts THEN NOW()
                ELSE NULL
            END
        WHERE status = 'processing'
        AND started_at < NOW() - (timeout_seconds || ' seconds')::interval
        RETURNING id
    )
    SELECT COUNT(*) INTO stalled_count FROM updated;
    
    IF stalled_count > 0 THEN
        RAISE NOTICE 'Limpiados % jobs bloqueados', stalled_count;
    END IF;
END;
$$;

-- Crear cron jobs
SELECT cron.schedule(
    'process-backup-queue',
    '* * * * *',
    $$SELECT process_backup_queue();$$
);

SELECT cron.schedule(
    'cleanup-stalled-backups',
    '*/5 * * * *',
    $$SELECT cleanup_stalled_backup_jobs();$$
);