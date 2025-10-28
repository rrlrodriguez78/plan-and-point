-- Production optimization function for backup system (corrected version)
CREATE OR REPLACE FUNCTION optimize_backup_system()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Update statistics for the query planner
    -- This helps PostgreSQL choose optimal query plans
    ANALYZE backup_jobs;
    ANALYZE backup_queue;
    ANALYZE backup_logs;
    ANALYZE backup_metrics;
    
    -- 2. Configure autovacuum for tables with high write frequency
    -- Backup queue has frequent inserts/updates, so vacuum more aggressively
    ALTER TABLE backup_queue SET (
        autovacuum_vacuum_scale_factor = 0.1,
        autovacuum_analyze_scale_factor = 0.05,
        autovacuum_vacuum_cost_delay = 10
    );
    
    -- Backup logs accumulate quickly, need regular cleanup
    ALTER TABLE backup_logs SET (
        autovacuum_vacuum_scale_factor = 0.2,
        autovacuum_analyze_scale_factor = 0.1,
        autovacuum_vacuum_cost_delay = 10
    );
    
    -- Backup jobs table optimization
    ALTER TABLE backup_jobs SET (
        autovacuum_vacuum_scale_factor = 0.15,
        autovacuum_analyze_scale_factor = 0.1
    );
    
    -- Backup metrics for long-term data
    ALTER TABLE backup_metrics SET (
        autovacuum_vacuum_scale_factor = 0.2,
        autovacuum_analyze_scale_factor = 0.1
    );
    
    RAISE NOTICE '✅ Backup system optimization completed';
    RAISE NOTICE '📊 Statistics updated for all backup tables';
    RAISE NOTICE '🔧 Autovacuum configured for optimal performance';
    RAISE NOTICE '💡 Tip: Run VACUUM manually during maintenance windows if needed';
    
    RETURN 'Backup system optimization completed successfully. Statistics updated, autovacuum configured for high-frequency tables.';
END;
$$;

-- Execute initial optimization
SELECT optimize_backup_system();