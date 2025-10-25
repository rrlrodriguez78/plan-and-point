-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create email_logs table to track all email sending attempts
CREATE TABLE public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  email_address TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'bounced')),
  resend_id TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on email_logs
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own email logs
CREATE POLICY "Users can view their own email logs"
ON public.email_logs
FOR SELECT
USING (auth.uid() = user_id);

-- System can insert email logs
CREATE POLICY "System can insert email logs"
ON public.email_logs
FOR INSERT
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_email_logs_user_id ON public.email_logs(user_id);
CREATE INDEX idx_email_logs_sent_at ON public.email_logs(sent_at DESC);

-- Update notify_tour_owner_on_view to also send email
CREATE OR REPLACE FUNCTION public.notify_tour_owner_on_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_owner_id UUID;
  v_tour_title TEXT;
  v_owner_email TEXT;
  v_owner_name TEXT;
  v_email_enabled BOOLEAN;
BEGIN
  -- Get tour owner info
  SELECT 
    o.owner_id, 
    vt.title,
    p.email,
    p.full_name
  INTO v_owner_id, v_tour_title, v_owner_email, v_owner_name
  FROM public.virtual_tours vt
  JOIN public.organizations o ON vt.organization_id = o.id
  JOIN public.profiles p ON o.owner_id = p.id
  WHERE vt.id = NEW.tour_id;
  
  -- Create in-app notification
  IF v_owner_id IS NOT NULL THEN
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
    
    -- Send email notification if enabled (async using pg_net)
    IF v_email_enabled IS TRUE THEN
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

-- Create function to notify on new user registration
CREATE OR REPLACE FUNCTION public.notify_on_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_email TEXT;
  v_user_name TEXT;
BEGIN
  -- Get user info
  SELECT email, raw_user_meta_data->>'full_name'
  INTO v_user_email, v_user_name
  FROM auth.users
  WHERE id = NEW.id;
  
  -- Send welcome email (async using pg_net)
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
  
  RETURN NEW;
END;
$function$;

-- Create trigger for new user registration
CREATE TRIGGER on_new_user_registration
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_user();

-- Schedule weekly reports (every Monday at 9 AM UTC)
SELECT cron.schedule(
  'send-weekly-reports',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://swnhlzcodsnpsqpxaxov.supabase.co/functions/v1/send-weekly-reports',
    headers := '{"Content-Type": "application/json"}'::jsonb
  ) as request_id;
  $$
);