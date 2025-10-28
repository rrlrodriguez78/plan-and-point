-- System health check function for monitoring and alerting
CREATE OR REPLACE FUNCTION check_system_health()
RETURNS TABLE(
    health_status TEXT,
    alert_level TEXT,
    message TEXT,
    details JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    queue_stats RECORD;
    error_stats RECORD;
    storage_stats RECORD;
BEGIN
    -- Get queue statistics
    SELECT * INTO queue_stats FROM get_queue_stats();
    
    -- Check recent errors
    SELECT 
        COUNT(*) as error_count,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as recent_errors
    INTO error_stats
    FROM backup_logs 
    WHERE is_error = true;
    
    -- Check storage usage
    SELECT 
        COUNT(*) as total_backups,
        COALESCE(SUM(file_size), 0) as total_bytes,
        COALESCE(AVG(file_size), 0) as avg_size_bytes
    INTO storage_stats
    FROM backup_jobs 
    WHERE status = 'completed'
    AND completed_at > NOW() - INTERVAL '7 days';

    -- Evaluate system health and return appropriate alerts
    IF queue_stats.pending_count > 20 THEN
        RETURN QUERY SELECT 
            'degraded'::TEXT,
            'warning'::TEXT,
            'High queue backlog detected'::TEXT,
            jsonb_build_object(
                'pending_jobs', queue_stats.pending_count,
                'recommendation', 'Consider scaling workers or investigating processing delays'
            );
    
    ELSIF error_stats.recent_errors > 5 THEN
        RETURN QUERY SELECT 
            'unhealthy'::TEXT,
            'error'::TEXT,
            'High error rate detected'::TEXT,
            jsonb_build_object(
                'recent_errors', error_stats.recent_errors,
                'recommendation', 'Check backup_logs table for error details'
            );
    
    ELSIF queue_stats.retry_count > 10 THEN
        RETURN QUERY SELECT 
            'degraded'::TEXT,
            'warning'::TEXT,
            'Multiple jobs in retry state'::TEXT,
            jsonb_build_object(
                'retry_jobs', queue_stats.retry_count,
                'recommendation', 'Review failed jobs and system resources'
            );
    
    ELSIF (storage_stats.total_bytes / 1024 / 1024 / 1024) > 10 THEN  -- 10GB
        RETURN QUERY SELECT 
            'healthy'::TEXT,
            'info'::TEXT,
            'Storage usage approaching limit'::TEXT,
            jsonb_build_object(
                'storage_gb', ROUND(storage_stats.total_bytes::numeric / 1024 / 1024 / 1024, 2),
                'total_backups', storage_stats.total_backups,
                'recommendation', 'Consider implementing backup retention policies'
            );
    
    ELSE
        RETURN QUERY SELECT 
            'healthy'::TEXT,
            'info'::TEXT,
            'System operating normally'::TEXT,
            jsonb_build_object(
                'queue_health', 'good',
                'pending_jobs', queue_stats.pending_count,
                'processing_jobs', queue_stats.processing_count,
                'error_rate', COALESCE(error_stats.recent_errors, 0),
                'storage_usage_gb', ROUND(storage_stats.total_bytes::numeric / 1024 / 1024 / 1024, 2),
                'avg_processing_time', queue_stats.avg_processing_time_seconds
            );
    END IF;
END;
$$;

-- Schedule health checks every 5 minutes
-- This will monitor system health and log metrics automatically
SELECT cron.schedule(
    'system-health-check',
    '*/5 * * * *',
    $$
    INSERT INTO backup_metrics (metric_type, metric_value, details) 
    SELECT 
        'health_status'::text,
        CASE 
            WHEN health_status = 'healthy' THEN 1 
            WHEN health_status = 'degraded' THEN 0.5
            ELSE 0 
        END,
        jsonb_build_object(
            'status', health_status, 
            'alert_level', alert_level, 
            'message', message,
            'checked_at', NOW()
        ) || details
    FROM check_system_health();
    $$
);