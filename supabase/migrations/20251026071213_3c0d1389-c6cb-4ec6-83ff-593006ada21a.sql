-- ============================================
-- AISLAR /app/tours DE /app/tours-publicos
-- ============================================

-- PASO 1: Eliminar la policy pública actual que causa el problema
DROP POLICY IF EXISTS "Public can view published tours for viewer" ON public.virtual_tours;

-- PASO 2: Crear policy pública SOLO para usuarios NO autenticados (anon)
-- Esto permite que /viewer/:id funcione sin autenticación
CREATE POLICY "Anonymous can view published tours"
ON public.virtual_tours 
AS PERMISSIVE
FOR SELECT
TO anon
USING (is_published = true);

-- PASO 3: Crear policy RESTRICTIVE para usuarios autenticados
-- Esta policy se combina con AND con las demás policies existentes
-- Esto asegura que usuarios autenticados SOLO vean tours de su organización en /app/tours
CREATE POLICY "Authenticated users see own org tours"
ON public.virtual_tours
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  -- Super admin ve todos los tours
  is_super_admin(auth.uid())
  OR
  -- Usuario normal solo ve tours de su organización
  EXISTS (
    SELECT 1 FROM public.organizations
    WHERE organizations.id = virtual_tours.organization_id
    AND organizations.owner_id = auth.uid()
  )
);