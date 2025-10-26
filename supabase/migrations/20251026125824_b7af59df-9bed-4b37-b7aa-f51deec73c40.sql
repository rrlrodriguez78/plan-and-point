-- ============================================
-- CLEANUP: Keep only super admin account
-- ============================================

-- Delete all users except KIMG RODRIGO (rrlrodriguez78@gmail.com)
DELETE FROM auth.users 
WHERE email != 'rrlrodriguez78@gmail.com';

-- Ensure KIMG RODRIGO has admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'rrlrodriguez78@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Clean up orphaned data in public tables
DELETE FROM public.profiles WHERE id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.organizations WHERE owner_id NOT IN (SELECT id FROM auth.users);
DELETE FROM public.user_settings WHERE user_id NOT IN (SELECT id FROM auth.users);