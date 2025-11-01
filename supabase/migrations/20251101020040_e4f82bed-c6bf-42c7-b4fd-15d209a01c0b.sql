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

-- Disable RLS so edge function can access with service role
ALTER TABLE public.oauth_states DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "System access only" ON public.oauth_states;
DROP POLICY IF EXISTS "Service role can manage oauth states" ON public.oauth_states;

-- Add comment
COMMENT ON TABLE public.oauth_states IS 'OAuth state tokens for CSRF protection. RLS disabled for edge function access via service role.';