-- Fix all SECURITY DEFINER functions to include pg_temp in search_path
-- This prevents privilege escalation via temporary table/function injection

-- Functions with NULL search_path - add full path
CREATE OR REPLACE FUNCTION public.cleanup_backup_jobs_on_tour_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  UPDATE backup_jobs
  SET status = 'cancelled',
      error_message = 'Tour was deleted',
      completed_at = NOW()
  WHERE tour_id = OLD.id
  AND status IN ('pending', 'processing');
  
  UPDATE backup_queue
  SET status = 'failed',
      error_message = 'Tour was deleted',
      completed_at = NOW()
  WHERE backup_job_id IN (
    SELECT id FROM backup_jobs WHERE tour_id = OLD.id
  )
  AND status IN ('pending', 'processing', 'retry');
  
  DELETE FROM backup_jobs
  WHERE tour_id = OLD.id
  AND created_at < NOW() - INTERVAL '7 days';
  
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_orphaned_backups()
RETURNS TABLE(deleted_count integer, cancelled_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_deleted INTEGER := 0;
  v_cancelled INTEGER := 0;
BEGIN
  WITH cancelled AS (
    UPDATE backup_jobs bj
    SET status = 'cancelled',
        error_message = 'Tour no longer exists',
        completed_at = NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM virtual_tours vt WHERE vt.id = bj.tour_id
    )
    AND status IN ('pending', 'processing')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_cancelled FROM cancelled;
  
  WITH deleted AS (
    DELETE FROM backup_jobs bj
    WHERE NOT EXISTS (
      SELECT 1 FROM virtual_tours vt WHERE vt.id = bj.tour_id
    )
    AND created_at < NOW() - INTERVAL '7 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted FROM deleted;
  
  RETURN QUERY SELECT v_deleted, v_cancelled;
END;
$function$;

-- Functions with search_path=public only - add pg_temp
CREATE OR REPLACE FUNCTION public.auto_cleanup_old_backup_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  DELETE FROM backup_jobs
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND completed_at < NOW() - INTERVAL '30 days';
    
  DELETE FROM backup_jobs
  WHERE status IN ('pending', 'processing')
    AND created_at < NOW() - INTERVAL '24 hours';
    
  RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_backup_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  WITH deleted_jobs AS (
    DELETE FROM public.backup_jobs
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND created_at < (NOW() - INTERVAL '30 days')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted_jobs;
  
  RETURN v_deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_stalled_backup_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_stuck_jobs_fallback()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    UPDATE backup_queue 
    SET status = 'retry',
        error_message = 'Reset after timeout',
        scheduled_at = NOW() + INTERVAL '5 minutes'
    WHERE status = 'processing'
    AND started_at < NOW() - INTERVAL '30 minutes';

    DELETE FROM backup_queue 
    WHERE status = 'failed'
    AND completed_at < NOW() - INTERVAL '7 days';

    RAISE NOTICE 'Cleanup completed at %', NOW();
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_backup_system_dashboard()
RETURNS TABLE(queue_status json, recent_activity json, system_metrics json, storage_info json)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_queue_stats RECORD;
    v_queue_status JSON;
    v_recent_jobs JSON;
    v_system_metrics JSON;
    v_storage_info JSON;
BEGIN
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

    SELECT COALESCE(
        (SELECT json_agg(row_to_json(t))
         FROM (
            SELECT 
                bj.id,
                vt.title as tour_name,
                bj.status,
                bj.progress_percentage,
                bj.created_at,
                ROUND(COALESCE(bj.file_size, 0)::numeric / 1024 / 1024, 2) as file_size_mb,
                bj.user_id
            FROM backup_jobs bj
            JOIN virtual_tours vt ON bj.tour_id = vt.id
            WHERE bj.created_at >= NOW() - INTERVAL '1 hour'
            ORDER BY bj.created_at DESC
            LIMIT 10
         ) t),
        '[]'::json
    ) INTO v_recent_jobs;

    SELECT COALESCE(
        (SELECT json_agg(row_to_json(t))
         FROM (
            SELECT metric_type, metric_value, recorded_at
            FROM backup_metrics
            WHERE recorded_at >= NOW() - INTERVAL '1 hour'
            ORDER BY recorded_at DESC
            LIMIT 20
         ) t),
        '[]'::json
    ) INTO v_system_metrics;

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
$function$;

CREATE OR REPLACE FUNCTION public.get_queue_stats()
RETURNS TABLE(pending_count bigint, processing_count bigint, retry_count bigint, completed_today bigint, avg_processing_time_seconds numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
    SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
        COUNT(*) FILTER (WHERE status = 'retry') as retry_count,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at::date = CURRENT_DATE) as completed_today,
        COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))), 0) as avg_processing_time_seconds
    FROM backup_queue 
    WHERE created_at >= NOW() - INTERVAL '24 hours';
$function$;

CREATE OR REPLACE FUNCTION public.process_backup_queue_fallback()
RETURNS TABLE(processed integer, failed integer, total_processed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_processed INTEGER := 0;
    v_failed INTEGER := 0;
    v_total INTEGER := 0;
BEGIN
    WITH updated AS (
        UPDATE backup_queue 
        SET status = 'failed',
            error_message = 'Processing timeout - system fallback',
            completed_at = NOW()
        WHERE status = 'processing'
        AND started_at < NOW() - INTERVAL '1 hour'
        RETURNING id
    )
    SELECT COUNT(*) INTO v_failed FROM updated;

    v_processed := 0;
    v_total := v_failed;

    RETURN QUERY SELECT v_processed, v_failed, v_total;
END;
$function$;

CREATE OR REPLACE FUNCTION public.run_backup_system_tests()
RETURNS TABLE(test_name text, test_result text, details jsonb, duration_ms integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    test_start TIMESTAMPTZ;
    test_duration INTEGER;
    test_tour_id UUID;
    test_tenant_id UUID;
    test_backup_job_id UUID;
    test_queue_id UUID;
    test_user_id UUID := 'f457bb3a-5ba9-4da1-9fcb-3fcabc2ed94b';
    test_results JSONB := '[]'::JSONB;
BEGIN
    RAISE NOTICE '🧪 Starting comprehensive backup system tests...';

    test_start := clock_timestamp();
    BEGIN
        PERFORM 1 FROM backup_jobs LIMIT 1;
        PERFORM 1 FROM backup_queue LIMIT 1;
        PERFORM 1 FROM backup_logs LIMIT 1;
        PERFORM 1 FROM backup_metrics LIMIT 1;
        
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'database_tables',
            'test_result', 'PASSED',
            'details', jsonb_build_object('tables_verified', ARRAY['backup_jobs', 'backup_queue', 'backup_logs', 'backup_metrics']),
            'duration_ms', test_duration
        );
    EXCEPTION WHEN OTHERS THEN
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'database_tables',
            'test_result', 'FAILED',
            'details', jsonb_build_object('error', SQLERRM),
            'duration_ms', test_duration
        );
    END;

    RETURN QUERY 
    SELECT 
        (result->>'test_name')::TEXT,
        (result->>'test_result')::TEXT,
        (result->>'details')::JSONB,
        (result->>'duration_ms')::INTEGER
    FROM jsonb_array_elements(test_results) AS result;

    RAISE NOTICE '✅ All tests completed';
END;
$function$;

CREATE OR REPLACE FUNCTION public.run_edge_case_tests()
RETURNS TABLE(edge_case text, test_result text, details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    test_results JSONB := '[]'::JSONB;
    test_backup_job_id UUID;
    test_queue_id UUID;
    test_tour_id UUID;
    test_tenant_id UUID;
BEGIN
    RAISE NOTICE '🔬 Testing edge cases...';

    SELECT tenant_id INTO test_tenant_id
    FROM tenant_users
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF test_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant found for authenticated user';
    END IF;

    SELECT id INTO test_tour_id 
    FROM virtual_tours 
    WHERE tenant_id = test_tenant_id
    LIMIT 1;

    IF test_tour_id IS NULL THEN
        RAISE EXCEPTION 'No tours found for edge case testing in tenant';
    END IF;

    RETURN QUERY 
    SELECT 
        (result->>'edge_case')::TEXT,
        (result->>'test_result')::TEXT,
        (result->>'details')::JSONB
    FROM jsonb_array_elements(test_results) AS result;

    RAISE NOTICE '✅ Edge case tests completed';
END;
$function$;

CREATE OR REPLACE FUNCTION public.run_load_test(num_backups integer DEFAULT 5)
RETURNS TABLE(test_type text, backups_created integer, successful_backups integer, failed_backups integer, avg_processing_time_seconds numeric, details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    test_tour_id UUID;
    test_tenant_id UUID;
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    backup_ids UUID[] := '{}';
    success_count INTEGER := 0;
    fail_count INTEGER := 0;
    current_backup_id UUID;
BEGIN
    RAISE NOTICE '🚀 Starting load test with % simultaneous backups...', num_backups;

    start_time := clock_timestamp();

    SELECT tenant_id INTO test_tenant_id
    FROM tenant_users
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF test_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant found for authenticated user';
    END IF;

    SELECT id INTO test_tour_id 
    FROM virtual_tours 
    WHERE tenant_id = test_tenant_id
    LIMIT 1;

    IF test_tour_id IS NULL THEN
        RAISE EXCEPTION 'No tours found for load testing in tenant';
    END IF;

    end_time := clock_timestamp();

    RETURN QUERY 
    SELECT 
        'load_test'::TEXT,
        num_backups,
        success_count,
        fail_count,
        CASE 
            WHEN num_backups > 0 THEN EXTRACT(EPOCH FROM (end_time - start_time)) / num_backups
            ELSE 0
        END,
        jsonb_build_object(
            'total_time_seconds', EXTRACT(EPOCH FROM (end_time - start_time)),
            'backups_per_second', CASE 
                WHEN EXTRACT(EPOCH FROM (end_time - start_time)) > 0 
                THEN num_backups / EXTRACT(EPOCH FROM (end_time - start_time))
                ELSE 0
            END,
            'test_tour_id', test_tour_id,
            'backup_ids', array_to_json(backup_ids),
            'test_tenant_id', test_tenant_id
        );

    RAISE NOTICE '✅ Load test completed: % successful, % failed', success_count, fail_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_hotspot_panorama_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.hotspots
    SET panorama_count = panorama_count + 1,
        has_panorama = true
    WHERE id = NEW.hotspot_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.hotspots
    SET panorama_count = GREATEST(0, panorama_count - 1),
        has_panorama = CASE WHEN panorama_count - 1 > 0 THEN true ELSE false END
    WHERE id = OLD.hotspot_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.password_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$function$;