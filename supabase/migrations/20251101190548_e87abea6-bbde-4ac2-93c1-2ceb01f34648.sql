-- Add redirect_uri column to oauth_states table
ALTER TABLE public.oauth_states 
ADD COLUMN IF NOT EXISTS redirect_uri TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN public.oauth_states.redirect_uri IS 'The redirect URI used for OAuth flow, sent by the client';