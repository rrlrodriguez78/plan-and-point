-- Function for load testing with multiple simultaneous backups
CREATE OR REPLACE FUNCTION run_load_test(num_backups INTEGER DEFAULT 5)
RETURNS TABLE(
    test_type TEXT,
    backups_created INTEGER,
    successful_backups INTEGER,
    failed_backups INTEGER,
    avg_processing_time_seconds NUMERIC,
    details JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- Get tenant for the authenticated user
    SELECT tenant_id INTO test_tenant_id
    FROM tenant_users
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF test_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant found for authenticated user';
    END IF;

    -- Get a tour for testing from user's tenant
    SELECT id INTO test_tour_id 
    FROM virtual_tours 
    WHERE tenant_id = test_tenant_id
    LIMIT 1;

    IF test_tour_id IS NULL THEN
        RAISE EXCEPTION 'No tours found for load testing in tenant';
    END IF;

    -- Create multiple backup jobs
    FOR i IN 1..num_backups LOOP
        BEGIN
            INSERT INTO backup_jobs (
                tour_id, 
                user_id, 
                tenant_id,
                job_type, 
                status, 
                total_items, 
                estimated_size_mb
            )
            VALUES (
                test_tour_id, 
                auth.uid(), 
                test_tenant_id,
                'full_backup', 
                'pending', 
                10, 
                5
            )
            RETURNING id INTO current_backup_id;

            backup_ids := array_append(backup_ids, current_backup_id);

            INSERT INTO backup_queue (backup_job_id, status, priority)
            VALUES (current_backup_id, 'pending', 1);

            success_count := success_count + 1;
        EXCEPTION WHEN OTHERS THEN
            fail_count := fail_count + 1;
            RAISE NOTICE 'Failed to create backup %: %', i, SQLERRM;
        END;
    END LOOP;

    -- Process queue
    PERFORM process_backup_queue();

    -- Wait for processing
    PERFORM pg_sleep(10);

    -- Calculate results
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

    -- Cleanup test data
    DELETE FROM backup_queue WHERE backup_job_id = ANY(backup_ids);
    DELETE FROM backup_jobs WHERE id = ANY(backup_ids);

    RAISE NOTICE '✅ Load test completed: % successful, % failed', success_count, fail_count;
END;
$$;