-- Create table for OAuth state tokens
CREATE TABLE public.oauth_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  state_token TEXT NOT NULL UNIQUE,
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create index for fast state token lookup
CREATE INDEX idx_oauth_states_state_token ON public.oauth_states(state_token);
CREATE INDEX idx_oauth_states_expires_at ON public.oauth_states(expires_at);

-- Enable RLS
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

-- Service role can manage all oauth states
CREATE POLICY "Service role can manage oauth states"
ON public.oauth_states
FOR ALL
USING (true)
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.oauth_states IS 'Stores temporary OAuth state tokens for CSRF protection. Tokens expire after 10 minutes.';