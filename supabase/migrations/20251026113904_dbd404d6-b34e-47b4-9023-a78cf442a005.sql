
-- Actualizar función is_super_admin para usar la tabla user_roles
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT has_role(_user_id, 'admin'::app_role)
$function$;
