-- SOLUCIÓN DEFINITIVA: Separar acceso dashboard vs público
-- Eliminar políticas problemáticas
DROP POLICY IF EXISTS "Authenticated users access" ON public.virtual_tours;
DROP POLICY IF EXISTS "Users can view their own tours" ON public.virtual_tours;
DROP POLICY IF EXISTS "Authenticated users can view public tours" ON public.virtual_tours;
DROP POLICY IF EXISTS "Users can view organization tours" ON public.virtual_tours;

-- 1. Dashboard: Usuarios ven SOLO sus tours
CREATE POLICY "Dashboard access" ON public.virtual_tours
FOR SELECT TO authenticated
USING (
  -- Usuarios ven tours de SU organización
  organization_id IN (
    SELECT id FROM organizations WHERE owner_id = auth.uid()
  )
  OR
  -- Super admin ve todo
  is_super_admin(auth.uid())
);

-- 2. Página pública: Todos ven tours públicos
CREATE POLICY "Public page access" ON public.virtual_tours
FOR SELECT TO authenticated
USING (is_published = true);

-- 3. Anónimos: Ven tours públicos
CREATE POLICY "Anonymous access" ON public.virtual_tours
FOR SELECT TO anon
USING (is_published = true);