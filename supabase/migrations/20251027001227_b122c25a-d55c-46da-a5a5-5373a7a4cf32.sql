-- Fix 1: Add email validation to notification triggers and fix search_path
CREATE OR REPLACE FUNCTION public.notify_tour_owner_on_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner_id UUID;
  v_tour_title TEXT;
  v_owner_email TEXT;
  v_owner_name TEXT;
  v_email_enabled BOOLEAN;
  v_email_confirmed_at TIMESTAMPTZ;
BEGIN
  -- Get tour owner info
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
  
  -- Create in-app notification
  IF v_owner_id IS NOT NULL THEN
    -- Verify email is confirmed before sending
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
    
    -- Check if user has email notifications enabled
    SELECT email_on_new_view INTO v_email_enabled
    FROM public.notification_settings
    WHERE user_id = v_owner_id;
    
    -- Send email notification if enabled AND email is confirmed
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

CREATE OR REPLACE FUNCTION public.notify_on_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_email TEXT;
  v_user_name TEXT;
  v_email_confirmed_at TIMESTAMPTZ;
BEGIN
  -- Get user info and verification status
  SELECT email, raw_user_meta_data->>'full_name', email_confirmed_at
  INTO v_user_email, v_user_name, v_email_confirmed_at
  FROM auth.users
  WHERE id = NEW.id;
  
  -- Only send welcome email if email is confirmed
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

-- Fix 2: Populate user_roles table and update is_super_admin to use it
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'rrlrodriguez78@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT has_role(_user_id, 'admin'::app_role)
$function$;