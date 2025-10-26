-- ============================================
-- FIX: Remove conflicting RLS policy that allows authenticated users 
-- to see ALL published tours in /app/tours dashboard
-- ============================================

-- Drop the conflicting policy
-- This policy was causing authenticated users to see all published tours
-- The existing "Users view own organization tours" policy is sufficient
DROP POLICY IF EXISTS "Authenticated can view published tours" ON public.virtual_tours;

-- ============================================
-- EXPECTED BEHAVIOR AFTER THIS MIGRATION:
-- ============================================
-- 1. /app/tours (Dashboard):
--    - Users only see tours from their own organization
--    - Enforced by "Users view own organization tours" policy
--
-- 2. /app/tours-publicos (Public Catalog):
--    - Anonymous users see all published tours (via "Public can view published tours" policy)
--    - Authenticated users must explicitly filter by is_published=true in frontend
--
-- 3. /viewer/:id (Tour Viewer):
--    - Anonymous users can view published tours
--    - Authenticated users can view their own tours + published tours
--    - Frontend already handles is_published filter in loadTourData()
-- ============================================