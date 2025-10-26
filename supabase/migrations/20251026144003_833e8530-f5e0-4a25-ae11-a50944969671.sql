-- Add account_status to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'pending' 
CHECK (account_status IN ('pending', 'approved', 'rejected'));

-- Create user approval requests table
CREATE TABLE IF NOT EXISTS public.user_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  requested_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  reviewed_by uuid REFERENCES public.profiles(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on user_approval_requests
ALTER TABLE public.user_approval_requests ENABLE ROW LEVEL SECURITY;

-- Only super admins can view approval requests
CREATE POLICY "Super admins can view all approval requests"
ON public.user_approval_requests
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Only super admins can update approval requests
CREATE POLICY "Super admins can update approval requests"
ON public.user_approval_requests
FOR UPDATE
USING (is_super_admin(auth.uid()));

-- System can insert approval requests
CREATE POLICY "System can insert approval requests"
ON public.user_approval_requests
FOR INSERT
WITH CHECK (true);

-- Update handle_new_user function to NOT create tenant automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert user profile with pending status
  INSERT INTO public.profiles (id, email, full_name, account_status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'pending'
  );
  
  -- Create approval request
  INSERT INTO public.user_approval_requests (user_id, status)
  VALUES (NEW.id, 'pending');
  
  -- Notify all super admins
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  SELECT 
    ur.user_id,
    'new_user_pending',
    'Nueva solicitud de registro',
    'Un nuevo usuario ha solicitado acceso: ' || COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    jsonb_build_object('pending_user_id', NEW.id, 'email', NEW.email)
  FROM public.user_roles ur
  WHERE ur.role = 'admin';
  
  RETURN NEW;
END;
$$;

-- Create function to approve user
CREATE OR REPLACE FUNCTION public.approve_user(
  _user_id uuid,
  _approved_by uuid,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email text;
  v_user_name text;
  new_tenant_id uuid;
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin(_approved_by) THEN
    RAISE EXCEPTION 'Only super admins can approve users';
  END IF;
  
  -- Get user info
  SELECT email, full_name INTO v_user_email, v_user_name
  FROM public.profiles
  WHERE id = _user_id;
  
  -- Update profile status
  UPDATE public.profiles
  SET account_status = 'approved'
  WHERE id = _user_id;
  
  -- Create tenant for approved user
  INSERT INTO public.tenants (owner_id, name)
  VALUES (
    _user_id,
    COALESCE(v_user_name, v_user_email) || '''s Organization'
  )
  RETURNING id INTO new_tenant_id;
  
  -- Assign user as tenant_admin
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (new_tenant_id, _user_id, 'tenant_admin');
  
  -- Update approval request
  UPDATE public.user_approval_requests
  SET 
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = _approved_by,
    notes = _notes
  WHERE user_id = _user_id;
  
  -- Create notification for approved user
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    _user_id,
    'account_approved',
    '¡Cuenta aprobada!',
    'Tu cuenta ha sido aprobada. Ya puedes acceder a la aplicación.'
  );
END;
$$;

-- Create function to reject user
CREATE OR REPLACE FUNCTION public.reject_user(
  _user_id uuid,
  _rejected_by uuid,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller is super admin
  IF NOT is_super_admin(_rejected_by) THEN
    RAISE EXCEPTION 'Only super admins can reject users';
  END IF;
  
  -- Update profile status
  UPDATE public.profiles
  SET account_status = 'rejected'
  WHERE id = _user_id;
  
  -- Update approval request
  UPDATE public.user_approval_requests
  SET 
    status = 'rejected',
    reviewed_at = now(),
    reviewed_by = _rejected_by,
    notes = _notes
  WHERE user_id = _user_id;
  
  -- Create notification for rejected user
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    _user_id,
    'account_rejected',
    'Solicitud rechazada',
    'Tu solicitud de registro ha sido rechazada. Si crees que esto es un error, contacta al administrador.'
  );
END;
$$;