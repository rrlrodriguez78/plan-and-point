-- Fix Critical Security Issues

-- ============================================================================
-- 1. FIX OAUTH_STATES RLS POLICIES
-- ============================================================================

-- Drop any broken/conflicting policies
DROP POLICY IF EXISTS "System access only" ON public.oauth_states;
DROP POLICY IF EXISTS "Service role can manage oauth states" ON public.oauth_states;

-- Allow service role full access for edge functions
CREATE POLICY "Service role full access"
ON public.oauth_states
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Deny all other access (no user should access this)
CREATE POLICY "Deny public access"
ON public.oauth_states
FOR ALL
TO authenticated, anon
USING (false);

-- ============================================================================
-- 2. FIX SECURITY DEFINER FUNCTIONS - ADD FIXED SEARCH_PATH
-- ============================================================================

-- Fix is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT has_role(_user_id, 'admin'::app_role)
$function$;

-- Fix has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- Fix is_tenant_admin
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = 'tenant_admin'
  );
$function$;

-- Fix belongs_to_tenant
CREATE OR REPLACE FUNCTION public.belongs_to_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
  );
$function$;

-- Fix get_active_backup_destination
CREATE OR REPLACE FUNCTION public.get_active_backup_destination(p_tenant_id uuid)
RETURNS TABLE(id uuid, destination_type text, cloud_provider text, auto_backup_enabled boolean)
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT 
    id,
    destination_type,
    cloud_provider,
    auto_backup_enabled
  FROM backup_destinations
  WHERE tenant_id = p_tenant_id
    AND is_active = true
  LIMIT 1;
$function$;

-- Fix get_user_tenants
CREATE OR REPLACE FUNCTION public.get_user_tenants(_user_id uuid)
RETURNS TABLE(tenant_id uuid, tenant_name text, user_role text)
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    tu.role::text as user_role
  FROM public.tenants t
  INNER JOIN public.tenant_users tu ON t.id = tu.tenant_id
  WHERE tu.user_id = _user_id
  ORDER BY t.created_at ASC;
$function$;

-- Fix approve_user
CREATE OR REPLACE FUNCTION public.approve_user(_user_id uuid, _approved_by uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_email text;
  v_user_name text;
  new_tenant_id uuid;
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin(_approved_by) THEN
    RAISE EXCEPTION 'Only super admins can approve users';
  END IF;
  
  -- Get user info
  SELECT email, full_name INTO v_user_email, v_user_name
  FROM public.profiles
  WHERE id = _user_id;
  
  -- Update profile status
  UPDATE public.profiles
  SET account_status = 'approved'
  WHERE id = _user_id;
  
  -- Create tenant for approved user
  INSERT INTO public.tenants (owner_id, name)
  VALUES (
    _user_id,
    COALESCE(v_user_name, v_user_email) || '''s Organization'
  )
  RETURNING id INTO new_tenant_id;
  
  -- Assign user as tenant_admin
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (new_tenant_id, _user_id, 'tenant_admin');
  
  -- Update approval request
  UPDATE public.user_approval_requests
  SET 
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = _approved_by,
    notes = _notes
  WHERE user_id = _user_id;
  
  -- Create notification for approved user
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    _user_id,
    'account_approved',
    '¡Cuenta aprobada!',
    'Tu cuenta ha sido aprobada. Ya puedes acceder a la aplicación.'
  );
END;
$function$;

-- Fix reject_user
CREATE OR REPLACE FUNCTION public.reject_user(_user_id uuid, _rejected_by uuid, _notes text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin(_rejected_by) THEN
    RAISE EXCEPTION 'Only super admins can reject users';
  END IF;
  
  -- Update profile status
  UPDATE public.profiles
  SET account_status = 'rejected'
  WHERE id = _user_id;
  
  -- Update approval request
  UPDATE public.user_approval_requests
  SET 
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = _rejected_by,
    notes = _notes
  WHERE user_id = _user_id;
  
  -- Create notification for rejected user
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    _user_id,
    'account_rejected',
    'Solicitud rechazada',
    'Tu solicitud de registro ha sido rechazada. Si crees que esto es un error, contacta al administrador.'
  );
END;
$function$;

-- Fix is_feature_enabled
CREATE OR REPLACE FUNCTION public.is_feature_enabled(_tenant_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  feature_enabled BOOLEAN;
  feature_uuid UUID;
BEGIN
  -- Get feature ID
  SELECT id INTO feature_uuid
  FROM public.features
  WHERE feature_key = _feature_key;
  
  IF feature_uuid IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if explicitly enabled/disabled for tenant
  SELECT enabled INTO feature_enabled
  FROM public.tenant_features
  WHERE tenant_id = _tenant_id AND feature_id = feature_uuid;
  
  IF feature_enabled IS NOT NULL THEN
    RETURN feature_enabled;
  END IF;
  
  -- Check global default
  SELECT default_enabled INTO feature_enabled
  FROM public.global_feature_config
  WHERE feature_id = feature_uuid;
  
  RETURN COALESCE(feature_enabled, false);
END;
$function$;

-- Fix generate_share_token
CREATE OR REPLACE FUNCTION public.generate_share_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $function$
DECLARE
  token TEXT;
  exists_token BOOLEAN;
BEGIN
  LOOP
    -- Use gen_random_bytes from extensions schema
    token := encode(extensions.gen_random_bytes(6), 'base64');
    token := replace(token, '/', '_');
    token := replace(token, '+', '-');
    token := substring(token, 1, 8);
    
    SELECT EXISTS(SELECT 1 FROM tour_shares WHERE share_token = token) INTO exists_token;
    
    EXIT WHEN NOT exists_token;
  END LOOP;
  
  RETURN token;
END;
$function$;

-- Fix all trigger functions (SECURITY DEFINER triggers)
CREATE OR REPLACE FUNCTION public.update_password_timestamp()
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

CREATE OR REPLACE FUNCTION public.update_analytics_summary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.analytics_summary (tour_id, date, total_views, unique_viewers)
  VALUES (
    NEW.tour_id,
    CURRENT_DATE,
    1,
    1
  )
  ON CONFLICT (tour_id, date)
  DO UPDATE SET
    total_views = analytics_summary.total_views + 1,
    unique_viewers = (
      SELECT COUNT(DISTINCT viewer_id)
      FROM tour_views
      WHERE tour_id = NEW.tour_id
        AND DATE(viewed_at) = CURRENT_DATE
    ),
    updated_at = NOW();
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.increment_share_view_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  UPDATE tour_shares
  SET view_count = view_count + 1
  WHERE share_token = NEW.session_id
  AND EXISTS (SELECT 1 FROM tour_shares WHERE share_token = NEW.session_id);
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- Insert user profile with pending status
  INSERT INTO public.profiles (id, email, full_name, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'pending'
  );
  
  -- Create approval request
  INSERT INTO public.user_approval_requests (user_id, status)
  VALUES (NEW.id, 'pending');
  
  -- Notify all super admins
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT 
    ur.user_id,
    'new_user_pending',
    'Nueva solicitud de registro',
    'Un nuevo usuario ha solicitado acceso: ' || COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    jsonb_build_object('pending_user_id', NEW.id, 'email', NEW.email)
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.init_tenant_features()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  -- For each feature with global config, decide if it should be enabled
  INSERT INTO public.tenant_features (tenant_id, feature_id, enabled)
  SELECT 
    NEW.id,
    gfc.feature_id,
    CASE 
      WHEN gfc.default_enabled THEN true
      WHEN gfc.rollout_percentage >= (random() * 100) THEN true
      ELSE false
    END
  FROM public.global_feature_config gfc;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_process_backup_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
    -- Programar procesamiento en 10 segundos para dar tiempo a agrupar trabajos
    PERFORM pg_notify('backup_queue_updated', 
        json_build_object(
            'action', 'process_queue', 
            'queue_id', NEW.id,
            'timestamp', extract(epoch from now())
        )::text
    );
    
    RETURN NEW;
END;
$function$;