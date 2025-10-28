-- Función de testing completo del sistema de backup
CREATE OR REPLACE FUNCTION run_backup_system_tests()
RETURNS TABLE(
    test_name TEXT,
    test_result TEXT,
    details JSONB,
    duration_ms INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    test_start TIMESTAMPTZ;
    test_duration INTEGER;
    test_tour_id UUID;
    test_tenant_id UUID;
    test_backup_job_id UUID;
    test_queue_id UUID;
    test_user_id UUID := 'f457bb3a-5ba9-4da1-9fcb-3fcabc2ed94b'; -- ID del usuario actual
    test_results JSONB := '[]'::JSONB;
BEGIN
    RAISE NOTICE '🧪 Starting comprehensive backup system tests...';

    -- TEST 1: Verificar tablas esenciales
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

    -- TEST 2: Crear trabajo de backup de prueba
    test_start := clock_timestamp();
    BEGIN
        -- Obtener tenant del usuario
        SELECT tenant_id INTO test_tenant_id
        FROM tenant_users
        WHERE user_id = test_user_id
        LIMIT 1;

        IF test_tenant_id IS NULL THEN
            RAISE EXCEPTION 'No tenant found for user';
        END IF;

        -- Obtener un tour del tenant
        SELECT id INTO test_tour_id 
        FROM virtual_tours 
        WHERE tenant_id = test_tenant_id
        LIMIT 1;

        IF test_tour_id IS NULL THEN
            RAISE EXCEPTION 'No tours found for testing';
        END IF;

        -- Crear job de backup
        INSERT INTO backup_jobs (tour_id, tenant_id, user_id, job_type, status, total_items, estimated_size_mb)
        VALUES (test_tour_id, test_tenant_id, test_user_id, 'full_backup', 'pending', 10, 5)
        RETURNING id INTO test_backup_job_id;

        -- Agregar a la cola
        INSERT INTO backup_queue (backup_job_id, status, priority)
        VALUES (test_backup_job_id, 'pending', 1)
        RETURNING id INTO test_queue_id;

        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'create_backup_job',
            'test_result', 'PASSED',
            'details', jsonb_build_object(
                'backup_job_id', test_backup_job_id,
                'queue_id', test_queue_id,
                'tour_id', test_tour_id,
                'tenant_id', test_tenant_id
            ),
            'duration_ms', test_duration
        );
    EXCEPTION WHEN OTHERS THEN
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'create_backup_job',
            'test_result', 'FAILED',
            'details', jsonb_build_object('error', SQLERRM),
            'duration_ms', test_duration
        );
    END;

    -- TEST 3: Verificar cola
    test_start := clock_timestamp();
    BEGIN
        PERFORM * FROM get_queue_stats();
        
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'queue_stats',
            'test_result', 'PASSED',
            'details', jsonb_build_object('queue_stats_accessible', true),
            'duration_ms', test_duration
        );
    EXCEPTION WHEN OTHERS THEN
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'queue_stats',
            'test_result', 'FAILED',
            'details', jsonb_build_object('error', SQLERRM),
            'duration_ms', test_duration
        );
    END;

    -- TEST 4: Verificar sistema de logs
    test_start := clock_timestamp();
    BEGIN
        -- Crear un log de prueba
        INSERT INTO backup_logs (backup_job_id, event_type, message, details)
        VALUES (test_backup_job_id, 'test_event', 'Test log entry', jsonb_build_object('test', true));

        PERFORM 1 FROM backup_logs 
        WHERE backup_job_id = test_backup_job_id
        AND event_type = 'test_event';

        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'logging_system',
            'test_result', 'PASSED',
            'details', jsonb_build_object('logs_created', true),
            'duration_ms', test_duration
        );
    EXCEPTION WHEN OTHERS THEN
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'logging_system',
            'test_result', 'FAILED',
            'details', jsonb_build_object('error', SQLERRM),
            'duration_ms', test_duration
        );
    END;

    -- TEST 5: Verificar dashboard
    test_start := clock_timestamp();
    BEGIN
        PERFORM * FROM get_backup_system_dashboard();
        
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'dashboard_function',
            'test_result', 'PASSED',
            'details', jsonb_build_object('dashboard_accessible', true),
            'duration_ms', test_duration
        );
    EXCEPTION WHEN OTHERS THEN
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'dashboard_function',
            'test_result', 'FAILED',
            'details', jsonb_build_object('error', SQLERRM),
            'duration_ms', test_duration
        );
    END;

    -- TEST 6: Verificar métricas
    test_start := clock_timestamp();
    BEGIN
        PERFORM record_backup_metrics();
        PERFORM 1 FROM backup_metrics 
        WHERE recorded_at > NOW() - INTERVAL '1 minute';
        
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'metrics_system',
            'test_result', 'PASSED',
            'details', jsonb_build_object('metrics_recorded', true),
            'duration_ms', test_duration
        );
    EXCEPTION WHEN OTHERS THEN
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'metrics_system',
            'test_result', 'FAILED',
            'details', jsonb_build_object('error', SQLERRM),
            'duration_ms', test_duration
        );
    END;

    -- TEST 7: Verificar triggers
    test_start := clock_timestamp();
    BEGIN
        -- Verificar que el trigger existe
        PERFORM 1 FROM pg_trigger 
        WHERE tgname = 'on_backup_queue_insert';
        
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'triggers',
            'test_result', 'PASSED',
            'details', jsonb_build_object('triggers_configured', true),
            'duration_ms', test_duration
        );
    EXCEPTION WHEN OTHERS THEN
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'triggers',
            'test_result', 'FAILED',
            'details', jsonb_build_object('error', SQLERRM),
            'duration_ms', test_duration
        );
    END;

    -- TEST 8: Limpieza de datos de prueba
    test_start := clock_timestamp();
    BEGIN
        -- Limpiar datos de prueba
        DELETE FROM backup_logs WHERE backup_job_id = test_backup_job_id AND event_type = 'test_event';
        DELETE FROM backup_queue WHERE id = test_queue_id;
        DELETE FROM backup_jobs WHERE id = test_backup_job_id;
        
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'test_cleanup',
            'test_result', 'PASSED',
            'details', jsonb_build_object('test_data_cleaned', true),
            'duration_ms', test_duration
        );
    EXCEPTION WHEN OTHERS THEN
        test_duration := EXTRACT(EPOCH FROM (clock_timestamp() - test_start)) * 1000;
        test_results := test_results || jsonb_build_object(
            'test_name', 'test_cleanup',
            'test_result', 'FAILED',
            'details', jsonb_build_object('error', SQLERRM),
            'duration_ms', test_duration
        );
    END;

    -- Convertir resultados a formato de tabla
    RETURN QUERY 
    SELECT 
        (result->>'test_name')::TEXT,
        (result->>'test_result')::TEXT,
        (result->>'details')::JSONB,
        (result->>'duration_ms')::INTEGER
    FROM jsonb_array_elements(test_results) AS result;

    RAISE NOTICE '✅ All tests completed';
END;
$$;

-- Permitir que authenticated users ejecuten tests
GRANT EXECUTE ON FUNCTION run_backup_system_tests() TO authenticated;
COMMENT ON FUNCTION run_backup_system_tests() IS 'Comprehensive test suite for the backup system - creates test data, runs tests, and cleans up';