-- Create oauth_states table if not exists
CREATE TABLE IF NOT EXISTS public.oauth_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  state_token TEXT UNIQUE NOT NULL,
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for automatic cleanup
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON public.oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_state_token ON public.oauth_states(state_token);

-- Enable RLS (Row Level Security)
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Service role can manage oauth states" ON public.oauth_states;

-- Policy: Only system can access these states
-- This ensures oauth_states can only be accessed via service role (edge functions)
CREATE POLICY "System access only" ON public.oauth_states
  FOR ALL USING (false);

-- Add comment
COMMENT ON TABLE public.oauth_states IS 'OAuth state tokens for CSRF protection. Only accessible via service role (edge functions).';