-- Add PWA update settings columns to user_settings table
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS pwa_auto_update BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pwa_auto_update_delay INTEGER DEFAULT 30000,
ADD COLUMN IF NOT EXISTS pwa_browser_notifications BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pwa_check_interval INTEGER DEFAULT 3600000;