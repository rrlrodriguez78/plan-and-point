-- FIX: Remove problematic policies and create correct ones
-- Remove policies that allow cross-organization viewing
DROP POLICY IF EXISTS "Authenticated users access" ON public.virtual_tours;
DROP POLICY IF EXISTS "Users can view their own tours" ON public.virtual_tours;

-- Create correct policies for organization isolation
-- Users can only view tours from their own organization in dashboard
CREATE POLICY "Users can view organization tours" ON public.virtual_tours
FOR SELECT TO authenticated
USING (
  -- Users can view tours from their own organization
  organization_id IN (
    SELECT id FROM organizations WHERE owner_id = auth.uid()
  )
  OR
  -- Super admin can view all tours
  is_super_admin(auth.uid())
);

-- Keep public access for anonymous users (for /viewer and /tours-publicos)
CREATE POLICY "Anonymous can view published tours" ON public.virtual_tours
FOR SELECT TO anon
USING (is_published = true);
La clave es: ❌ QUITAR OR is_published = true de la política de usuarios autenticados.

¿Puedes reemplazar el contenido de la migración con mi código corregido?
