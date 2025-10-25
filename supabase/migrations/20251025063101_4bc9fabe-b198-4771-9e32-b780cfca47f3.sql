-- Create tour_views table to track visits
CREATE TABLE public.tour_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID REFERENCES public.virtual_tours(id) ON DELETE CASCADE NOT NULL,
  viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  duration_seconds INTEGER,
  session_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE NOT NULL,
  related_tour_id UUID REFERENCES public.virtual_tours(id) ON DELETE SET NULL,
  related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create analytics_summary table for aggregated stats
CREATE TABLE public.analytics_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id UUID REFERENCES public.virtual_tours(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  total_views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  avg_duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(tour_id, date)
);

-- Create notification_settings table
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email_on_new_view BOOLEAN DEFAULT TRUE,
  email_on_new_user BOOLEAN DEFAULT TRUE,
  email_weekly_report BOOLEAN DEFAULT TRUE,
  push_on_new_view BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.tour_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tour_views
CREATE POLICY "Tour owners can view their tour analytics"
  ON public.tour_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_tours vt
      JOIN public.organizations o ON vt.organization_id = o.id
      WHERE vt.id = tour_views.tour_id
        AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert tour views"
  ON public.tour_views
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for analytics_summary
CREATE POLICY "Tour owners can view their analytics"
  ON public.analytics_summary
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_tours vt
      JOIN public.organizations o ON vt.organization_id = o.id
      WHERE vt.id = analytics_summary.tour_id
        AND o.owner_id = auth.uid()
    )
  );

CREATE POLICY "System can manage analytics"
  ON public.analytics_summary
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for notification_settings
CREATE POLICY "Users can view their own settings"
  ON public.notification_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON public.notification_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.notification_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create function to update analytics summary
CREATE OR REPLACE FUNCTION public.update_analytics_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Create trigger for analytics
CREATE TRIGGER update_analytics_on_view
  AFTER INSERT ON public.tour_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_analytics_summary();

-- Create function to create notification on new view
CREATE OR REPLACE FUNCTION public.notify_tour_owner_on_view()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
  v_tour_title TEXT;
BEGIN
  -- Get tour owner
  SELECT o.owner_id, vt.title INTO v_owner_id, v_tour_title
  FROM public.virtual_tours vt
  JOIN public.organizations o ON vt.organization_id = o.id
  WHERE vt.id = NEW.tour_id;
  
  -- Create notification
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
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for notifications
CREATE TRIGGER notify_on_new_view
  AFTER INSERT ON public.tour_views
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_tour_owner_on_view();

-- Add trigger for updated_at on analytics_summary
CREATE TRIGGER update_analytics_summary_updated_at
  BEFORE UPDATE ON public.analytics_summary
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on notification_settings
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;