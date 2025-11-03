-- Fix 1: Remove redundant RLS policies from oauth_states table
DROP POLICY IF EXISTS "Deny all user access" ON public.oauth_states;
DROP POLICY IF EXISTS "Deny public access" ON public.oauth_states;

-- Add cleanup function for expired OAuth states
CREATE OR REPLACE FUNCTION public.cleanup_expired_oauth_states()
RETURNS void AS $$
  DELETE FROM public.oauth_states WHERE expires_at < NOW();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Fix 2: Update is_super_admin to use user_roles table instead of hardcoded email
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.is_super_admin IS 'Checks if user has admin role in user_roles table';