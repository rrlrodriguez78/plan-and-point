-- Tabla para métricas del sistema
CREATE TABLE IF NOT EXISTS backup_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type TEXT NOT NULL,
    metric_value NUMERIC,
    details JSONB,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para métricas
CREATE INDEX IF NOT EXISTS idx_backup_metrics_type ON backup_metrics(metric_type, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_metrics_time ON backup_metrics(recorded_at DESC);

-- RLS para métricas (solo super admins pueden ver)
ALTER TABLE backup_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view metrics" ON backup_metrics
FOR SELECT USING (is_super_admin(auth.uid()));

CREATE POLICY "System can insert metrics" ON backup_metrics
FOR INSERT WITH CHECK (true);

-- Función para registrar métricas automáticamente
CREATE OR REPLACE FUNCTION record_backup_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    queue_stats RECORD;
    job_stats RECORD;
BEGIN
    -- Estadísticas de la cola
    SELECT * INTO queue_stats FROM get_queue_stats();
    
    INSERT INTO backup_metrics (metric_type, metric_value, details)
    VALUES 
        ('queue_pending', queue_stats.pending_count, '{"type": "queue_size"}'),
        ('queue_processing', queue_stats.processing_count, '{"type": "active_workers"}'),
        ('queue_retry', queue_stats.retry_count, '{"type": "retry_count"}'),
        ('queue_completed_today', queue_stats.completed_today, '{"type": "daily_completions"}'),
        ('queue_avg_processing_time', queue_stats.avg_processing_time_seconds, '{"type": "performance"}');

    -- Estadísticas de trabajos (últimas 24 horas)
    SELECT 
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
        AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) FILTER (WHERE completed_at IS NOT NULL) as avg_job_duration,
        COALESCE(SUM(file_size), 0) as total_storage_bytes
    INTO job_stats
    FROM backup_jobs 
    WHERE created_at >= NOW() - INTERVAL '24 hours';

    INSERT INTO backup_metrics (metric_type, metric_value, details)
    VALUES 
        ('jobs_total_24h', job_stats.total_jobs, '{"type": "throughput"}'),
        ('jobs_completed_24h', job_stats.completed_jobs, '{"type": "success_rate"}'),
        ('jobs_failed_24h', job_stats.failed_jobs, '{"type": "failure_rate"}'),
        ('jobs_avg_duration', job_stats.avg_job_duration, '{"type": "performance"}'),
        ('storage_used_bytes', job_stats.total_storage_bytes, '{"type": "storage"}');

    -- Limpiar métricas antiguas (más de 30 días)
    DELETE FROM backup_metrics 
    WHERE recorded_at < NOW() - INTERVAL '30 days';

    RAISE NOTICE 'Metrics recorded at %', NOW();
END;
$$;

-- Programar recolección de métricas cada 5 minutos
SELECT cron.schedule(
    'record-backup-metrics',
    '*/5 * * * *',
    $$SELECT record_backup_metrics();$$
);