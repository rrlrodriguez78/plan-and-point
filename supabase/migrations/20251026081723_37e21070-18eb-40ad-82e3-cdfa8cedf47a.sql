-- Eliminar política problemática que permite ver todos los tours publicados
DROP POLICY IF EXISTS "Authenticated users see own org tours" ON public.virtual_tours;

-- Crear política RESTRICTIVE que limita estrictamente el acceso
-- RESTRICTIVE actúa como filtro adicional junto con políticas PERMISSIVE existentes
CREATE POLICY "Users see only their organization tours"
ON public.virtual_tours 
AS RESTRICTIVE
FOR SELECT 
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = virtual_tours.organization_id
    AND organizations.owner_id = auth.uid()
  )
);