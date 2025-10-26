-- ============================================
-- ADD: Policy for authenticated users to view published tours
-- This allows authenticated users to see all published tours in /app/tours-publicos
-- ============================================

-- Create policy for authenticated users to view published tours
CREATE POLICY "Authenticated users can view published tours" 
ON public.virtual_tours 
FOR SELECT 
TO authenticated
USING (is_published = true);

-- ============================================
-- EXPECTED BEHAVIOR AFTER THIS MIGRATION:
-- ============================================
-- 1. /app/tours (Dashboard):
--    - Users only see tours from their own organization
--    - Frontend filters with .eq('organization_id', org.id)
--    - RLS allows: own tours + published tours
--    - Result: only own tours (frontend filtered)
--
-- 2. /app/tours-publicos (Public Catalog):
--    - Anonymous users: see all published tours (via "Public can view published tours")
--    - Authenticated users: see all published tours (via this new policy)
--    - Frontend filters with .eq('is_published', true)
--
-- 3. /viewer/:id (Tour Viewer):
--    - Anonymous users: can view published tours
--    - Authenticated users: can view published tours (via this policy)
-- ============================================