-- Function to export backup system configuration for disaster recovery
CREATE OR REPLACE FUNCTION export_backup_system_config()
RETURNS TABLE(config_type TEXT, config_data JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Table statistics and configuration
    RETURN QUERY 
    SELECT 'table_config'::TEXT, jsonb_build_object(
        'backup_jobs', (SELECT COUNT(*) FROM backup_jobs),
        'backup_queue', (SELECT COUNT(*) FROM backup_queue),
        'backup_logs', (SELECT COUNT(*) FROM backup_logs),
        'backup_metrics', (SELECT COUNT(*) FROM backup_metrics),
        'active_jobs', (SELECT COUNT(*) FROM backup_jobs WHERE status IN ('pending', 'processing')),
        'completed_jobs_7d', (SELECT COUNT(*) FROM backup_jobs WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '7 days')
    );
    
    -- Database functions configuration
    RETURN QUERY
    SELECT 'function_config'::TEXT, jsonb_build_object(
        'queue_functions', ARRAY[
            'process_backup_queue',
            'get_queue_stats',
            'cleanup_stuck_jobs_fallback',
            'process_backup_queue_fallback'
        ],
        'monitoring_functions', ARRAY[
            'get_backup_system_dashboard',
            'check_system_health',
            'record_backup_metrics'
        ],
        'testing_functions', ARRAY[
            'run_backup_system_tests',
            'run_load_test',
            'run_edge_case_tests'
        ],
        'utility_functions', ARRAY[
            'export_backup_system_config',
            'optimize_backup_system',
            'cleanup_old_backup_jobs',
            'auto_cleanup_old_backup_jobs',
            'cleanup_stalled_backup_jobs'
        ]
    );
    
    -- Cron jobs configuration
    RETURN QUERY
    SELECT 'cron_config'::TEXT, jsonb_agg(
        jsonb_build_object(
            'jobid', jobid,
            'jobname', jobname,
            'schedule', schedule,
            'command', command,
            'active', active
        )
    )
    FROM cron.job
    WHERE jobname LIKE '%backup%' OR jobname LIKE '%health%' OR jobname LIKE '%metrics%';
    
    -- Indexes configuration
    RETURN QUERY
    SELECT 'index_config'::TEXT, jsonb_build_object(
        'backup_jobs_indexes', ARRAY[
            'idx_backup_jobs_status_created',
            'idx_backup_jobs_user_created'
        ],
        'backup_queue_indexes', ARRAY[
            'idx_backup_queue_status',
            'idx_backup_queue_scheduled'
        ],
        'backup_logs_indexes', ARRAY[
            'idx_backup_logs_job_created'
        ]
    );
    
    -- Storage configuration
    RETURN QUERY
    SELECT 'storage_config'::TEXT, jsonb_build_object(
        'total_storage_mb', COALESCE(
            (SELECT ROUND(SUM(file_size)::numeric / 1024 / 1024, 2) 
             FROM backup_jobs 
             WHERE status = 'completed'), 
            0
        ),
        'avg_backup_size_mb', COALESCE(
            (SELECT ROUND(AVG(file_size)::numeric / 1024 / 1024, 2) 
             FROM backup_jobs 
             WHERE status = 'completed'), 
            0
        ),
        'retention_policy', '30 days for completed/failed, 24 hours for abandoned'
    );
    
    -- Performance configuration
    RETURN QUERY
    SELECT 'performance_config'::TEXT, jsonb_build_object(
        'autovacuum', jsonb_build_object(
            'backup_queue', 'aggressive (scale_factor: 0.1)',
            'backup_logs', 'aggressive (scale_factor: 0.2)',
            'backup_jobs', 'standard (scale_factor: 0.15)'
        ),
        'worker_timeout', '600 seconds',
        'max_retries', 3,
        'queue_batch_size', 3
    );
    
    -- Health check thresholds
    RETURN QUERY
    SELECT 'health_thresholds'::TEXT, jsonb_build_object(
        'queue_backlog_warning', 20,
        'error_rate_critical', 5,
        'retry_count_warning', 10,
        'storage_warning_gb', 10,
        'check_frequency', 'every 5 minutes'
    );
END;
$$;