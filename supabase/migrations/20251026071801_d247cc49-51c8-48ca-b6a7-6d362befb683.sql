-- Arreglar policy RESTRICTIVE para permitir ver tours públicos
-- El problema: usuarios autenticados no pueden ver tours públicos de otras organizaciones

-- Eliminar la policy restrictiva actual
DROP POLICY IF EXISTS "Authenticated users see own org tours" ON public.virtual_tours;

-- Recrear policy RESTRICTIVE con condición adicional para tours publicados
CREATE POLICY "Authenticated users see own org tours"
ON public.virtual_tours
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  -- Super admin ve todos los tours
  is_super_admin(auth.uid())
  OR
  -- Usuario normal ve tours de su organización
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = virtual_tours.organization_id
    AND organizations.owner_id = auth.uid()
  )
  OR
  -- Usuarios autenticados pueden ver tours publicados (para /app/tours-publicos)
  is_published = true
);