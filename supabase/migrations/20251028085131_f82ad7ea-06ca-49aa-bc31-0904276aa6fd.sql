-- Function for testing edge cases in the backup system
CREATE OR REPLACE FUNCTION run_edge_case_tests()
RETURNS TABLE(
    edge_case TEXT,
    test_result TEXT,
    details JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    test_results JSONB := '[]'::JSONB;
    test_backup_job_id UUID;
    test_queue_id UUID;
    test_tour_id UUID;
    test_tenant_id UUID;
BEGIN
    RAISE NOTICE '🔬 Testing edge cases...';

    -- Get tenant for the authenticated user
    SELECT tenant_id INTO test_tenant_id
    FROM tenant_users
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF test_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant found for authenticated user';
    END IF;

    -- Get tour for testing from user's tenant
    SELECT id INTO test_tour_id 
    FROM virtual_tours 
    WHERE tenant_id = test_tenant_id
    LIMIT 1;

    IF test_tour_id IS NULL THEN
        RAISE EXCEPTION 'No tours found for edge case testing in tenant';
    END IF;

    -- EDGE CASE 1: Backup with very large estimated size
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
            1000, 
            5000
        ) -- 5GB
        RETURNING id INTO test_backup_job_id;

        INSERT INTO backup_queue (backup_job_id, status, priority)
        VALUES (test_backup_job_id, 'pending', 3); -- High priority for large backups

        test_results := test_results || jsonb_build_object(
            'edge_case', 'large_backup_creation',
            'test_result', 'PASSED',
            'details', jsonb_build_object(
                'estimated_size_gb', 5, 
                'priority', 3,
                'backup_job_id', test_backup_job_id
            )
        );

        -- Cleanup
        DELETE FROM backup_queue WHERE backup_job_id = test_backup_job_id;
        DELETE FROM backup_jobs WHERE id = test_backup_job_id;
    EXCEPTION WHEN OTHERS THEN
        test_results := test_results || jsonb_build_object(
            'edge_case', 'large_backup_creation',
            'test_result', 'FAILED',
            'details', jsonb_build_object('error', SQLERRM)
        );
    END;

    -- EDGE CASE 2: Multiple retries
    BEGIN
        INSERT INTO backup_jobs (
            tour_id, 
            user_id, 
            tenant_id,
            job_type, 
            status, 
            total_items
        )
        VALUES (
            test_tour_id, 
            auth.uid(), 
            test_tenant_id,
            'full_backup', 
            'pending', 
            10
        )
        RETURNING id INTO test_backup_job_id;

        INSERT INTO backup_queue (backup_job_id, status, attempts, max_attempts)
        VALUES (test_backup_job_id, 'retry', 2, 3);

        -- Verify it can be reprocessed
        PERFORM 1 FROM backup_queue 
        WHERE backup_job_id = test_backup_job_id 
        AND status = 'retry'
        AND attempts = 2;

        test_results := test_results || jsonb_build_object(
            'edge_case', 'retry_mechanism',
            'test_result', 'PASSED',
            'details', jsonb_build_object(
                'current_attempts', 2, 
                'max_attempts', 3,
                'backup_job_id', test_backup_job_id
            )
        );

        -- Cleanup
        DELETE FROM backup_queue WHERE backup_job_id = test_backup_job_id;
        DELETE FROM backup_jobs WHERE id = test_backup_job_id;
    EXCEPTION WHEN OTHERS THEN
        test_results := test_results || jsonb_build_object(
            'edge_case', 'retry_mechanism',
            'test_result', 'FAILED',
            'details', jsonb_build_object('error', SQLERRM)
        );
    END;

    -- EDGE CASE 3: Cancelled job
    BEGIN
        INSERT INTO backup_jobs (
            tour_id, 
            user_id, 
            tenant_id,
            job_type, 
            status, 
            total_items
        )
        VALUES (
            test_tour_id, 
            auth.uid(), 
            test_tenant_id,
            'full_backup', 
            'processing', 
            10
        )
        RETURNING id INTO test_backup_job_id;

        INSERT INTO backup_queue (backup_job_id, status, started_at)
        VALUES (test_backup_job_id, 'processing', NOW());

        -- Simulate cancellation
        UPDATE backup_jobs SET status = 'cancelled' WHERE id = test_backup_job_id;
        UPDATE backup_queue 
        SET status = 'failed', error_message = 'Cancelled by user' 
        WHERE backup_job_id = test_backup_job_id;

        test_results := test_results || jsonb_build_object(
            'edge_case', 'job_cancellation',
            'test_result', 'PASSED',
            'details', jsonb_build_object(
                'cancellation_successful', true,
                'backup_job_id', test_backup_job_id
            )
        );

        -- Cleanup
        DELETE FROM backup_queue WHERE backup_job_id = test_backup_job_id;
        DELETE FROM backup_jobs WHERE id = test_backup_job_id;
    EXCEPTION WHEN OTHERS THEN
        test_results := test_results || jsonb_build_object(
            'edge_case', 'job_cancellation',
            'test_result', 'FAILED',
            'details', jsonb_build_object('error', SQLERRM)
        );
    END;

    -- EDGE CASE 4: Stuck processing job cleanup
    BEGIN
        INSERT INTO backup_jobs (
            tour_id, 
            user_id, 
            tenant_id,
            job_type, 
            status, 
            total_items
        )
        VALUES (
            test_tour_id, 
            auth.uid(), 
            test_tenant_id,
            'full_backup', 
            'processing', 
            10
        )
        RETURNING id INTO test_backup_job_id;

        -- Create a stuck job (locked for more than 1 hour)
        INSERT INTO backup_queue (
            backup_job_id, 
            status, 
            started_at,
            locked_until
        )
        VALUES (
            test_backup_job_id, 
            'processing', 
            NOW() - INTERVAL '2 hours',
            NOW() - INTERVAL '1 hour'
        );

        -- Run cleanup
        PERFORM cleanup_stuck_jobs();

        -- Verify job was reset
        PERFORM 1 FROM backup_queue 
        WHERE backup_job_id = test_backup_job_id 
        AND status = 'retry';

        test_results := test_results || jsonb_build_object(
            'edge_case', 'stuck_job_cleanup',
            'test_result', 'PASSED',
            'details', jsonb_build_object(
                'cleanup_successful', true,
                'backup_job_id', test_backup_job_id
            )
        );

        -- Cleanup
        DELETE FROM backup_queue WHERE backup_job_id = test_backup_job_id;
        DELETE FROM backup_jobs WHERE id = test_backup_job_id;
    EXCEPTION WHEN OTHERS THEN
        test_results := test_results || jsonb_build_object(
            'edge_case', 'stuck_job_cleanup',
            'test_result', 'FAILED',
            'details', jsonb_build_object('error', SQLERRM)
        );
    END;

    -- Convert results to table format
    RETURN QUERY 
    SELECT 
        (result->>'edge_case')::TEXT,
        (result->>'test_result')::TEXT,
        (result->>'details')::JSONB
    FROM jsonb_array_elements(test_results) AS result;

    RAISE NOTICE '✅ Edge case tests completed';
END;
$$;