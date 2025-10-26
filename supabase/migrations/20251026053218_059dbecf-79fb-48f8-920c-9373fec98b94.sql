-- Create settings access audit log table
CREATE TABLE public.settings_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL, -- 'allowed', 'denied'
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.settings_access_logs ENABLE ROW LEVEL SECURITY;

-- Super admin can view all access logs
CREATE POLICY "Super admin can view all access logs"
ON public.settings_access_logs
FOR SELECT
USING (is_super_admin(auth.uid()));

-- System can insert access logs
CREATE POLICY "System can insert access logs"
ON public.settings_access_logs
FOR INSERT
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_settings_access_logs_user_id ON public.settings_access_logs(user_id);
CREATE INDEX idx_settings_access_logs_created_at ON public.settings_access_logs(created_at DESC);