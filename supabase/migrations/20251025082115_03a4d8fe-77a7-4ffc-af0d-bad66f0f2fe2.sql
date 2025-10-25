-- Enable realtime for all analytics-related tables

-- Add tables to supabase_realtime publication (will ignore if already exists)
DO $$
BEGIN
  -- Add virtual_tours
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.virtual_tours;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- Add tour_analytics
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tour_analytics;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- Add tour_views
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tour_views;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- Add email_logs
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.email_logs;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;

  -- Add notifications
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;

-- Enable replica identity for complete row data during updates
ALTER TABLE public.virtual_tours REPLICA IDENTITY FULL;
ALTER TABLE public.tour_analytics REPLICA IDENTITY FULL;
ALTER TABLE public.tour_views REPLICA IDENTITY FULL;
ALTER TABLE public.email_logs REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.tour_comments REPLICA IDENTITY FULL;