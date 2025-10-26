-- Remove problematic policies that allow cross-organization viewing
DROP POLICY IF EXISTS "Authenticated users access" ON public.virtual_tours;
DROP POLICY IF EXISTS "Users can view their own tours" ON public.virtual_tours;

-- Create correct policy for organization isolation
-- Authenticated users can only view tours from their own organization
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
-- This policy already exists but we ensure it's correct
DROP POLICY IF EXISTS "Anonymous can view published tours" ON public.virtual_tours;
CREATE POLICY "Anonymous can view published tours" ON public.virtual_tours
FOR SELECT TO anon
USING (is_published = true);