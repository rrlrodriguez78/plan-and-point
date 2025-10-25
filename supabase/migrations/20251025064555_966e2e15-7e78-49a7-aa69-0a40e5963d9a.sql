-- Create comprehensive user settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  -- Notifications
  push_notifications BOOLEAN DEFAULT true,
  email_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,
  notification_types JSONB DEFAULT '{"new_view": true, "new_user": true, "weekly_report": true}'::jsonb,
  
  -- Appearance
  theme TEXT DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  color_scheme TEXT DEFAULT 'default',
  font_size TEXT DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large')),
  layout_mode TEXT DEFAULT 'extended' CHECK (layout_mode IN ('compact', 'extended')),
  
  -- Language and Region
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'es', 'fr', 'de')),
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  time_format TEXT DEFAULT '12h' CHECK (time_format IN ('12h', '24h')),
  timezone TEXT DEFAULT 'UTC',
  currency TEXT DEFAULT 'USD',
  
  -- Privacy and Security
  profile_visibility TEXT DEFAULT 'private' CHECK (profile_visibility IN ('public', 'private', 'friends')),
  data_sharing BOOLEAN DEFAULT false,
  two_factor_enabled BOOLEAN DEFAULT false,
  
  -- Mobile Settings
  image_quality TEXT DEFAULT 'high' CHECK (image_quality IN ('low', 'medium', 'high')),
  data_usage TEXT DEFAULT 'auto' CHECK (data_usage IN ('low', 'auto', 'high')),
  auto_downloads BOOLEAN DEFAULT true,
  local_storage_limit_mb INTEGER DEFAULT 500,
  
  -- Sync Settings
  cloud_sync BOOLEAN DEFAULT true,
  backup_frequency TEXT DEFAULT 'daily' CHECK (backup_frequency IN ('hourly', 'daily', 'weekly', 'manual')),
  sync_data_types JSONB DEFAULT '{"tours": true, "media": true, "settings": true}'::jsonb,
  cross_device_sync BOOLEAN DEFAULT true,
  
  -- Audio and Video
  default_volume INTEGER DEFAULT 80 CHECK (default_volume >= 0 AND default_volume <= 100),
  video_quality TEXT DEFAULT 'high' CHECK (video_quality IN ('low', 'medium', 'high', 'auto')),
  autoplay BOOLEAN DEFAULT false,
  sound_effects BOOLEAN DEFAULT true,
  
  -- Analytics
  share_usage_data BOOLEAN DEFAULT false,
  auto_reports BOOLEAN DEFAULT true,
  metrics_to_track JSONB DEFAULT '{"views": true, "engagement": true, "performance": true}'::jsonb,
  report_frequency TEXT DEFAULT 'weekly' CHECK (report_frequency IN ('daily', 'weekly', 'monthly')),
  
  -- Account Settings
  contact_preferences JSONB DEFAULT '{"email": true, "phone": false, "sms": false}'::jsonb,
  subscription_tier TEXT DEFAULT 'free',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own settings"
  ON public.user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON public.user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.user_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create default settings for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger to create default settings when user signs up
CREATE TRIGGER on_auth_user_created_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_settings();