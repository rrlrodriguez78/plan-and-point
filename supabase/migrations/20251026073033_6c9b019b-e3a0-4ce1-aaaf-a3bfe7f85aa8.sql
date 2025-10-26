
-- Eliminar la política RESTRICTIVE problemática
DROP POLICY IF EXISTS "Authenticated users see own org tours" ON public.virtual_tours;

-- Crear nueva política PERMISSIVE (no restrictiva) que permite:
-- 1. Super admin ve todo
-- 2. Usuarios ven tours de su organización
-- 3. TODOS los usuarios autenticados ven tours publicados
CREATE POLICY "Authenticated users see own org tours"
ON public.virtual_tours
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = virtual_tours.organization_id
    AND organizations.owner_id = auth.uid()
  )
  OR
  is_published = true
);
