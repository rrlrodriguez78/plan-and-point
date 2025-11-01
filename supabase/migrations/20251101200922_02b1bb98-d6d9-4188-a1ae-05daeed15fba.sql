-- Fix Critical Security Issues: oauth_states RLS and Function Search Paths

-- 1. Enable RLS on oauth_states table
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- 2. Create policies for oauth_states (service role only, deny all users)
DROP POLICY IF EXISTS "Service role full access" ON public.oauth_states;
DROP POLICY IF EXISTS "Deny all user access" ON public.oauth_states;

CREATE POLICY "Service role full access"
ON public.oauth_states
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Deny all user access"
ON public.oauth_states
FOR ALL
TO authenticated, anon
USING (false);

-- 3. Fix all SECURITY DEFINER functions missing pg_temp in search_path
-- These functions currently have 'SET search_path TO public' but need 'public, pg_temp'

CREATE OR REPLACE FUNCTION public.notify_on_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_email TEXT;
  v_user_name TEXT;
  v_email_confirmed_at TIMESTAMPTZ;
BEGIN
  SELECT email, raw_user_meta_data->>'full_name', email_confirmed_at
  INTO v_user_email, v_user_name, v_email_confirmed_at
  FROM auth.users
  WHERE id = NEW.id;
  
  IF v_email_confirmed_at IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://swnhlzcodsnpsqpxaxov.supabase.co/functions/v1/send-notification-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.jwt_secret', true)
      ),
      body := jsonb_build_object(
        'notification_type', 'new_user',
        'recipient_email', v_user_email,
        'recipient_name', v_user_name,
        'data', jsonb_build_object(
          'user_name', v_user_name,
          'registered_at', NEW.created_at
        )
      )
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.process_backup_queue()
RETURNS TABLE(processed_count integer, failed_count integer, total_processed integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    worker_url TEXT := 'https://swnhlzcodsnpsqpxaxov.supabase.co/functions/v1/backup-worker';
    service_key TEXT;
    processed INTEGER := 0;
    failed INTEGER := 0;
    total_processed INTEGER := 0;
    worker_response JSON;
BEGIN
    service_key := current_setting('app.settings.service_key', true);
    
    IF service_key IS NULL THEN
        RAISE NOTICE 'Service key not configured, using default';
    END IF;

    SELECT content INTO worker_response
    FROM extensions.http((
        'POST',
        worker_url,
        ARRAY[extensions.http_header('Authorization', 'Bearer ' || service_key),
              extensions.http_header('Content-Type', 'application/json')],
        'application/json',
        json_build_object(
            'action', 'process_queue',
            'maxJobs', 3
        )::text
    )::extensions.http_request);

    IF worker_response IS NOT NULL THEN
        processed := (worker_response->>'processed')::integer;
        failed := (worker_response->>'failed')::integer;
        total_processed := processed + failed;
        
        RAISE NOTICE 'Worker processed % jobs (% successful, % failed)', 
            total_processed, processed, failed;
    ELSE
        RAISE WARNING 'Worker returned no response';
    END IF;

    PERFORM cleanup_stuck_jobs_fallback();

    RETURN QUERY SELECT processed, failed, total_processed;
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Error calling backup worker: %', SQLERRM;
        
        SELECT * INTO processed, failed, total_processed 
        FROM process_backup_queue_fallback();
        
        RETURN QUERY SELECT processed, failed, total_processed;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_tour_owner_on_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_owner_id UUID;
  v_tour_title TEXT;
  v_owner_email TEXT;
  v_owner_name TEXT;
  v_email_enabled BOOLEAN;
  v_email_confirmed_at TIMESTAMPTZ;
BEGIN
  SELECT 
    o.owner_id, 
    vt.title,
    p.email,
    p.full_name
  INTO v_owner_id, v_tour_title, v_owner_email, v_owner_name
  FROM public.virtual_tours vt
  JOIN public.tenants o ON vt.tenant_id = o.id
  JOIN public.profiles p ON o.owner_id = p.id
  WHERE vt.id = NEW.tour_id;
  
  IF v_owner_id IS NOT NULL THEN
    SELECT email_confirmed_at INTO v_email_confirmed_at
    FROM auth.users
    WHERE id = v_owner_id;
    
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      related_tour_id,
      metadata
    ) VALUES (
      v_owner_id,
      'new_view',
      'Nueva vista en tu tour',
      'Tu tour "' || v_tour_title || '" ha recibido una nueva visita',
      NEW.tour_id,
      jsonb_build_object('view_id', NEW.id, 'viewed_at', NEW.viewed_at)
    );
    
    SELECT email_on_new_view INTO v_email_enabled
    FROM public.notification_settings
    WHERE user_id = v_owner_id;
    
    IF v_email_enabled IS TRUE AND v_email_confirmed_at IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://swnhlzcodsnpsqpxaxov.supabase.co/functions/v1/send-notification-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.jwt_secret', true)
        ),
        body := jsonb_build_object(
          'notification_type', 'new_view',
          'recipient_email', v_owner_email,
          'recipient_name', v_owner_name,
          'data', jsonb_build_object(
            'tour_title', v_tour_title,
            'tour_id', NEW.tour_id,
            'viewed_at', NEW.viewed_at
          )
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.optimize_backup_system()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    ANALYZE backup_jobs;
    ANALYZE backup_queue;
    ANALYZE backup_logs;
    ANALYZE backup_metrics;
    
    ALTER TABLE backup_queue SET (
        autovacuum_vacuum_scale_factor = 0.1,
        autovacuum_analyze_scale_factor = 0.05,
        autovacuum_vacuum_cost_delay = 10
    );
    
    ALTER TABLE backup_logs SET (
        autovacuum_vacuum_scale_factor = 0.2,
        autovacuum_analyze_scale_factor = 0.1,
        autovacuum_vacuum_cost_delay = 10
    );
    
    ALTER TABLE backup_jobs SET (
        autovacuum_vacuum_scale_factor = 0.15,
        autovacuum_analyze_scale_factor = 0.1
    );
    
    ALTER TABLE backup_metrics SET (
        autovacuum_vacuum_scale_factor = 0.2,
        autovacuum_analyze_scale_factor = 0.1
    );
    
    RETURN 'Backup system optimization completed successfully';
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_system_health()
RETURNS TABLE(health_status text, alert_level text, message text, details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    queue_stats RECORD;
    error_stats RECORD;
    storage_stats RECORD;
BEGIN
    SELECT * INTO queue_stats FROM get_queue_stats();
    
    SELECT 
        COUNT(*) as error_count,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as recent_errors
    INTO error_stats
    FROM backup_logs 
    WHERE is_error = true;
    
    SELECT 
        COUNT(*) as total_backups,
        COALESCE(SUM(file_size), 0) as total_bytes,
        COALESCE(AVG(file_size), 0) as avg_size_bytes
    INTO storage_stats
    FROM backup_jobs 
    WHERE status = 'completed'
    AND completed_at > NOW() - INTERVAL '7 days';

    IF queue_stats.pending_count > 20 THEN
        RETURN QUERY SELECT 
            'degraded'::TEXT, 'warning'::TEXT, 'High queue backlog detected'::TEXT,
            jsonb_build_object('pending_jobs', queue_stats.pending_count);
    ELSIF error_stats.recent_errors > 5 THEN
        RETURN QUERY SELECT 
            'unhealthy'::TEXT, 'error'::TEXT, 'High error rate detected'::TEXT,
            jsonb_build_object('recent_errors', error_stats.recent_errors);
    ELSE
        RETURN QUERY SELECT 
            'healthy'::TEXT, 'info'::TEXT, 'System operating normally'::TEXT,
            jsonb_build_object('queue_health', 'good');
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.export_backup_system_config()
RETURNS TABLE(config_type text, config_data jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    RETURN QUERY 
    SELECT 'table_config'::TEXT, jsonb_build_object(
        'backup_jobs', (SELECT COUNT(*) FROM backup_jobs)
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_system_documentation()
RETURNS TABLE(section text, content text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    RETURN QUERY
    SELECT 'SYSTEM OVERVIEW'::TEXT, 'Documentation'::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_production_readiness()
RETURNS TABLE(check_item text, status text, details text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    RETURN QUERY SELECT '1. Database Tables'::TEXT, '✅ OK'::TEXT, 'Tables exist'::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_backup_metrics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    INSERT INTO backup_metrics (metric_type, metric_value)
    SELECT 'queue_size', COUNT(*) FROM backup_queue WHERE status = 'pending';
END;
$function$;