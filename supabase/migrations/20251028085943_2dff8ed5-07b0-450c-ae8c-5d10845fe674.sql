-- Function to generate automated system documentation
CREATE OR REPLACE FUNCTION generate_system_documentation()
RETURNS TABLE(section TEXT, content TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- System overview
    RETURN QUERY
    SELECT 'SYSTEM OVERVIEW'::TEXT, 
           'Complete backup system with true background processing, queue management, and real-time monitoring. Built for high availability and fault tolerance.'::TEXT;
    
    -- Core components
    RETURN QUERY
    SELECT 'CORE COMPONENTS'::TEXT, 
           '1. backup_jobs - Main backup tracking with status, progress, and metadata
2. backup_queue - Processing queue with retry logic and priority scheduling
3. backup_logs - Comprehensive audit trail and error tracking
4. backup_metrics - Performance monitoring and system health metrics
5. Edge Functions - backup-processor (API) & backup-worker (background processor)
6. Cron Jobs - Scheduled tasks for queue processing and monitoring'::TEXT;
    
    -- Key features
    RETURN QUERY
    SELECT 'KEY FEATURES'::TEXT,
           '✅ True background processing (survives page closes and browser restarts)
✅ Automatic retry with exponential backoff (max 3 attempts)
✅ Real-time progress tracking (0-100%)
✅ Concurrent job processing (max 3 simultaneous jobs)
✅ Comprehensive error handling with detailed logging
✅ Storage management with signed URLs (7-day expiration)
✅ Health monitoring and automated alerts
✅ Performance metrics and interactive dashboard
✅ Automatic cleanup of old backups (30-day retention)
✅ Database optimization with autovacuum tuning'::TEXT;
    
    -- API endpoints
    RETURN QUERY
    SELECT 'API ENDPOINTS'::TEXT,
           'backup-processor Edge Function:
  POST {action: "start", tourId: UUID, backupType: "full_backup"|"media_only"}
    → Returns: {backupId, status, message}
  
  POST {action: "status", backupId: UUID}
    → Returns: {status, progress, fileUrl, downloadUrl}
  
  POST {action: "cancel", backupId: UUID}
    → Returns: {success, message}

backup-worker Edge Function:
  POST {action: "process_queue", maxJobs: number}
    → Returns: {processed, failed, total}'::TEXT;
    
    -- Database functions
    RETURN QUERY
    SELECT 'DATABASE FUNCTIONS'::TEXT,
           'Queue Management:
  - process_backup_queue() - Process pending backup jobs
  - get_queue_stats() - Get current queue statistics
  - cleanup_stuck_jobs_fallback() - Reset stuck jobs

Monitoring:
  - get_backup_system_dashboard() - Complete system overview
  - check_system_health() - Health check with alerts
  - record_backup_metrics() - Log performance metrics

Utilities:
  - optimize_backup_system() - Performance tuning
  - export_backup_system_config() - Configuration backup
  - cleanup_old_backup_jobs() - Manual cleanup

Testing:
  - run_backup_system_tests() - Comprehensive test suite
  - run_load_test(n) - Load testing with n jobs
  - run_edge_case_tests() - Edge case validation'::TEXT;
    
    -- Monitoring queries
    RETURN QUERY
    SELECT 'MONITORING QUERIES'::TEXT,
           'System Dashboard:
  SELECT * FROM get_backup_system_dashboard();

System Health:
  SELECT * FROM check_system_health();

Recent Metrics:
  SELECT metric_type, ROUND(metric_value::numeric, 2), recorded_at 
  FROM backup_metrics 
  ORDER BY recorded_at DESC 
  LIMIT 50;

Active Jobs:
  SELECT id, job_type, status, progress_percentage, created_at 
  FROM backup_jobs 
  WHERE status IN (''pending'', ''processing'') 
  ORDER BY created_at ASC;

Recent Errors:
  SELECT backup_job_id, event_type, message, created_at 
  FROM backup_logs 
  WHERE is_error = true 
  ORDER BY created_at DESC 
  LIMIT 10;'::TEXT;
    
    -- Cron jobs
    RETURN QUERY
    SELECT 'SCHEDULED JOBS'::TEXT,
           'Automated Tasks (via pg_cron):

1. process-backup-queue (every 2 minutes)
   - Processes pending backup jobs
   - Invokes backup-worker edge function
   
2. record-backup-metrics (every 5 minutes)
   - Records queue statistics
   - Tracks performance metrics
   
3. system-health-check (every 5 minutes)
   - Monitors system health
   - Generates alerts for issues
   
4. auto_cleanup_old_backup_jobs (configurable)
   - Removes backups older than 30 days
   - Cleans up abandoned jobs'::TEXT;
    
    -- Configuration
    RETURN QUERY
    SELECT 'CONFIGURATION'::TEXT,
           'Performance Settings:
  - Worker timeout: 600 seconds (10 minutes)
  - Max retries: 3 attempts
  - Queue batch size: 3 concurrent jobs
  - Autovacuum: Aggressive on high-write tables

Health Thresholds:
  - Queue backlog warning: 20+ pending jobs
  - Error rate critical: 5+ errors/hour
  - Retry count warning: 10+ retry jobs
  - Storage warning: 10GB+ usage

Retention Policies:
  - Completed backups: 30 days
  - Failed backups: 30 days
  - Abandoned jobs: 24 hours
  - Metrics data: 30 days
  - Backup logs: Unlimited (manual cleanup recommended)'::TEXT;
    
    -- Troubleshooting
    RETURN QUERY
    SELECT 'TROUBLESHOOTING'::TEXT,
           'Common Issues:

1. Jobs Stuck in Processing
   → Run: SELECT cleanup_stuck_jobs_fallback();
   
2. High Queue Backlog
   → Check worker logs: SELECT * FROM backup_logs WHERE is_error = true;
   → Manually process: SELECT process_backup_queue();
   
3. Storage Issues
   → Check usage: SELECT * FROM export_backup_system_config() WHERE config_type = ''storage_config'';
   → Run cleanup: SELECT cleanup_old_backup_jobs();
   
4. Performance Degradation
   → Optimize: SELECT optimize_backup_system();
   → Check metrics: SELECT * FROM check_system_health();

5. Cron Jobs Not Running
   → List jobs: SELECT * FROM cron.job WHERE jobname LIKE ''%backup%'';
   → Check logs: SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;'::TEXT;
END;
$$;