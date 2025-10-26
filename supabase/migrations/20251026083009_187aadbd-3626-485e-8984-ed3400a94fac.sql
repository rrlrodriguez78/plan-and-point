-- Eliminar política RESTRICTIVE actual
DROP POLICY IF EXISTS "Users see only their organization tours" ON public.virtual_tours;

-- Crear nueva política RESTRICTIVE que permite ver tours publicados
CREATE POLICY "Users see only their organization tours"
ON public.virtual_tours 
AS RESTRICTIVE
FOR SELECT 
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR is_published = true  -- Permite ver todos los tours publicados
  OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = virtual_tours.organization_id
    AND organizations.owner_id = auth.uid()
  )
);