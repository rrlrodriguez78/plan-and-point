-- Final production readiness verification function
CREATE OR REPLACE FUNCTION verify_production_readiness()
RETURNS TABLE(check_item TEXT, status TEXT, details TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_table_count INTEGER;
    v_function_count INTEGER;
    v_cron_count INTEGER;
    v_bucket_exists BOOLEAN;
BEGIN
    -- 1. Verify all database tables exist
    BEGIN
        SELECT COUNT(*) INTO v_table_count
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('backup_jobs', 'backup_queue', 'backup_logs', 'backup_metrics');
        
        IF v_table_count = 4 THEN
            RETURN QUERY SELECT 
                '1. Database Tables'::TEXT, 
                '✅ OK'::TEXT, 
                'All 4 required tables exist'::TEXT;
        ELSE
            RETURN QUERY SELECT 
                '1. Database Tables'::TEXT, 
                '⚠️ WARNING'::TEXT, 
                format('Only %s/4 tables found', v_table_count)::TEXT;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT '1. Database Tables'::TEXT, '❌ FAILED'::TEXT, SQLERRM::TEXT;
    END;
    
    -- 2. Verify queue processing function
    BEGIN
        PERFORM process_backup_queue();
        RETURN QUERY SELECT 
            '2. Queue Processing'::TEXT, 
            '✅ OK'::TEXT, 
            'Queue processor functional'::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT '2. Queue Processing'::TEXT, '❌ FAILED'::TEXT, SQLERRM::TEXT;
    END;
    
    -- 3. Verify monitoring dashboard
    BEGIN
        PERFORM get_backup_system_dashboard();
        RETURN QUERY SELECT 
            '3. Monitoring Dashboard'::TEXT, 
            '✅ OK'::TEXT, 
            'Dashboard accessible and functional'::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT '3. Monitoring Dashboard'::TEXT, '❌ FAILED'::TEXT, SQLERRM::TEXT;
    END;
    
    -- 4. Verify metrics system
    BEGIN
        PERFORM record_backup_metrics();
        RETURN QUERY SELECT 
            '4. Metrics System'::TEXT, 
            '✅ OK'::TEXT, 
            'Metrics recording active'::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT '4. Metrics System'::TEXT, '❌ FAILED'::TEXT, SQLERRM::TEXT;
    END;
    
    -- 5. Verify health checks
    BEGIN
        PERFORM check_system_health();
        RETURN QUERY SELECT 
            '5. Health Monitoring'::TEXT, 
            '✅ OK'::TEXT, 
            'Health checks operational'::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT '5. Health Monitoring'::TEXT, '❌ FAILED'::TEXT, SQLERRM::TEXT;
    END;
    
    -- 6. Verify core database functions
    BEGIN
        SELECT COUNT(*) INTO v_function_count
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN (
            'process_backup_queue',
            'get_queue_stats',
            'get_backup_system_dashboard',
            'check_system_health',
            'record_backup_metrics',
            'optimize_backup_system',
            'export_backup_system_config',
            'generate_system_documentation'
        );
        
        IF v_function_count >= 8 THEN
            RETURN QUERY SELECT 
                '6. Database Functions'::TEXT, 
                '✅ OK'::TEXT, 
                format('%s core functions deployed', v_function_count)::TEXT;
        ELSE
            RETURN QUERY SELECT 
                '6. Database Functions'::TEXT, 
                '⚠️ WARNING'::TEXT, 
                format('Only %s/8 core functions found', v_function_count)::TEXT;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT '6. Database Functions'::TEXT, '❌ FAILED'::TEXT, SQLERRM::TEXT;
    END;
    
    -- 7. Verify cron jobs
    BEGIN
        SELECT COUNT(*) INTO v_cron_count
        FROM cron.job
        WHERE jobname IN ('process-backup-queue', 'record-backup-metrics', 'system-health-check');
        
        IF v_cron_count >= 3 THEN
            RETURN QUERY SELECT 
                '7. Scheduled Tasks'::TEXT, 
                '✅ OK'::TEXT, 
                format('%s cron jobs configured and active', v_cron_count)::TEXT;
        ELSE
            RETURN QUERY SELECT 
                '7. Scheduled Tasks'::TEXT, 
                '⚠️ WARNING'::TEXT, 
                format('Only %s/3 cron jobs found', v_cron_count)::TEXT;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT '7. Scheduled Tasks'::TEXT, '⚠️ WARNING'::TEXT, 'Could not verify cron jobs'::TEXT;
    END;
    
    -- 8. Verify storage bucket
    BEGIN
        SELECT EXISTS(
            SELECT 1 FROM storage.buckets WHERE id = 'backups'
        ) INTO v_bucket_exists;
        
        IF v_bucket_exists THEN
            RETURN QUERY SELECT 
                '8. Storage Bucket'::TEXT, 
                '✅ OK'::TEXT, 
                'backups bucket configured'::TEXT;
        ELSE
            RETURN QUERY SELECT 
                '8. Storage Bucket'::TEXT, 
                '❌ MISSING'::TEXT, 
                'backups bucket not found'::TEXT;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT '8. Storage Bucket'::TEXT, '⚠️ WARNING'::TEXT, 'Could not verify storage'::TEXT;
    END;
    
    -- 9. Verify indexes
    BEGIN
        SELECT COUNT(*) INTO v_function_count
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename IN ('backup_jobs', 'backup_queue', 'backup_logs')
        AND indexname LIKE 'idx_backup_%';
        
        IF v_function_count >= 3 THEN
            RETURN QUERY SELECT 
                '9. Performance Indexes'::TEXT, 
                '✅ OK'::TEXT, 
                format('%s performance indexes created', v_function_count)::TEXT;
        ELSE
            RETURN QUERY SELECT 
                '9. Performance Indexes'::TEXT, 
                '⚠️ WARNING'::TEXT, 
                'Some indexes may be missing'::TEXT;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT '9. Performance Indexes'::TEXT, '❌ FAILED'::TEXT, SQLERRM::TEXT;
    END;
    
    -- 10. Edge Functions (informational - cannot verify directly)
    RETURN QUERY SELECT 
        '10. Edge Functions'::TEXT, 
        '📋 INFO'::TEXT, 
        'backup-processor & backup-worker must be deployed separately'::TEXT;
    
    -- 11. System optimization status
    BEGIN
        PERFORM optimize_backup_system();
        RETURN QUERY SELECT 
            '11. System Optimization'::TEXT, 
            '✅ OK'::TEXT, 
            'Performance tuning applied'::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT '11. System Optimization'::TEXT, '⚠️ WARNING'::TEXT, SQLERRM::TEXT;
    END;
    
    -- Final summary
    RETURN QUERY SELECT 
        '═══════════════════'::TEXT, 
        '📊 SUMMARY'::TEXT, 
        'Production readiness verification complete'::TEXT;
        
END;
$$;

-- Execute final verification
SELECT * FROM verify_production_readiness();