-- ELIMINAR TODAS LAS POLÍTICAS ACTUALES DE virtual_tours
DROP POLICY IF EXISTS "Authenticated users see own org tours" ON public.virtual_tours;
DROP POLICY IF EXISTS "Authenticated users can view public tours" ON public.virtual_tours;
DROP POLICY IF EXISTS "Users see only their organization tours" ON public.virtual_tours;
DROP POLICY IF EXISTS "Super admin can view all tours" ON public.virtual_tours;
DROP POLICY IF EXISTS "Public can view published tours for viewer" ON public.virtual_tours;
DROP POLICY IF EXISTS "Anonymous can view published tours" ON public.virtual_tours;

-- CREAR POLÍTICAS NUEVAS Y CORRECTAS
-- 1. Anónimos pueden ver tours públicos
CREATE POLICY "Anonymous can view published tours" ON public.virtual_tours
FOR SELECT TO anon USING (is_published = true);

-- 2. Usuarios autenticados ven SOLO sus tours + tours públicos
CREATE POLICY "Authenticated users access" ON public.virtual_tours
FOR SELECT TO authenticated USING (
  is_super_admin(auth.uid()) OR
  organization_id IN (SELECT id FROM organizations WHERE owner_id = auth.uid()) OR
  is_published = true
);