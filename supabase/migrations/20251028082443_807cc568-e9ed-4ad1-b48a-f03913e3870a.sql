-- Eliminar cron job anterior (cada minuto)
SELECT cron.unschedule('process-backup-queue');

-- Crear nuevo cron job (cada 2 minutos)
SELECT cron.schedule(
    'process-backup-queue',
    '*/2 * * * *',
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

-- Función para monitoreo del estado de la cola
CREATE OR REPLACE FUNCTION get_queue_stats()
RETURNS TABLE(
    pending_count bigint,
    processing_count bigint, 
    retry_count bigint,
    completed_today bigint,
    avg_processing_time_seconds numeric
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
        COUNT(*) FILTER (WHERE status = 'retry') as retry_count,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at::date = CURRENT_DATE) as completed_today,
        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))), 0) as avg_processing_time_seconds
    FROM backup_queue 
    WHERE created_at >= NOW() - INTERVAL '24 hours';
$$;

COMMENT ON FUNCTION get_queue_stats() IS 
'Returns real-time statistics about the backup queue including pending, processing, retry counts and average processing time';