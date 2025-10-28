-- Función completa para dashboard del sistema
CREATE OR REPLACE FUNCTION get_backup_system_dashboard()
RETURNS TABLE(
    queue_status JSON,
    recent_activity JSON,
    system_metrics JSON,
    storage_info JSON
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_queue_stats RECORD;
    v_queue_status JSON;
    v_recent_jobs JSON;
    v_system_metrics JSON;
    v_storage_info JSON;
BEGIN
    -- Estado de la cola
    SELECT * INTO v_queue_stats FROM get_queue_stats();
    
    v_queue_status := json_build_object(
        'pending', v_queue_stats.pending_count,
        'processing', v_queue_stats.processing_count,
        'retry', v_queue_stats.retry_count,
        'completed_today', v_queue_stats.completed_today,
        'avg_processing_time_seconds', v_queue_stats.avg_processing_time_seconds,
        'health', CASE 
            WHEN v_queue_stats.pending_count > 10 THEN 'high_load'
            WHEN v_queue_stats.retry_count > 5 THEN 'degraded'
            ELSE 'healthy'
        END
    );

    -- Actividad reciente (últimas horas)
    SELECT COALESCE(json_agg(
        json_build_object(
            'id', bj.id,
            'tour_name', vt.title,
            'status', bj.status,
            'progress_percentage', bj.progress_percentage,
            'created_at', bj.created_at,
            'file_size_mb', ROUND(COALESCE(bj.file_size, 0)::numeric / 1024 / 1024, 2),
            'user_id', bj.user_id
        )
    ), '[]'::json) INTO v_recent_jobs
    FROM backup_jobs bj
    JOIN virtual_tours vt ON bj.tour_id = vt.id
    WHERE bj.created_at >= NOW() - INTERVAL '1 hour'
    ORDER BY bj.created_at DESC
    LIMIT 10;

    -- Métricas del sistema (última hora)
    SELECT COALESCE(json_agg(
        json_build_object(
            'metric_type', metric_type,
            'value', metric_value,
            'recorded_at', recorded_at
        )
    ), '[]'::json) INTO v_system_metrics
    FROM backup_metrics
    WHERE recorded_at >= NOW() - INTERVAL '1 hour'
    ORDER BY recorded_at DESC
    LIMIT 20;

    -- Información de almacenamiento (últimos 7 días)
    SELECT json_build_object(
        'total_backups', COUNT(*),
        'total_storage_gb', ROUND(COALESCE(SUM(file_size), 0)::numeric / 1024 / 1024 / 1024, 2),
        'largest_backup_mb', ROUND(COALESCE(MAX(file_size), 0)::numeric / 1024 / 1024, 2),
        'avg_backup_size_mb', ROUND(COALESCE(AVG(file_size), 0)::numeric / 1024 / 1024, 2)
    ) INTO v_storage_info
    FROM backup_jobs
    WHERE status = 'completed'
    AND completed_at >= NOW() - INTERVAL '7 days';

    RETURN QUERY SELECT v_queue_status, v_recent_jobs, v_system_metrics, v_storage_info;
END;
$$;

-- RLS: Solo super admins pueden ejecutar esta función
GRANT EXECUTE ON FUNCTION get_backup_system_dashboard() TO authenticated;
COMMENT ON FUNCTION get_backup_system_dashboard() IS 'Returns comprehensive backup system dashboard data including queue status, recent activity, metrics, and storage info';