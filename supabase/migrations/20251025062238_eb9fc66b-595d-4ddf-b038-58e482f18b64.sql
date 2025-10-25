-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Security definer function to check if user is super admin by email
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _user_id
      AND email = 'rrlRodriguez78@gmail.com'
  )
$$;

-- RLS Policies for user_roles table
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Super admin can manage all roles"
  ON public.user_roles
  FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- Drop existing pages policies
DROP POLICY IF EXISTS "Authenticated users can delete pages" ON public.pages;
DROP POLICY IF EXISTS "Authenticated users can insert pages" ON public.pages;
DROP POLICY IF EXISTS "Authenticated users can update pages" ON public.pages;
DROP POLICY IF EXISTS "Authenticated users can view pages" ON public.pages;

-- New pages policies with super admin control
CREATE POLICY "Users can view non-locked pages"
  ON public.pages
  FOR SELECT
  USING (
    (auth.role() = 'authenticated' AND is_locked = false)
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Only super admin can insert pages"
  ON public.pages
  FOR INSERT
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Only super admin can update pages"
  ON public.pages
  FOR UPDATE
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Only super admin can delete pages"
  ON public.pages
  FOR DELETE
  USING (public.is_super_admin(auth.uid()));

-- Insert super admin role for rrlRodriguez78@gmail.com
-- This will only work if the user already exists in auth.users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'rrlRodriguez78@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;