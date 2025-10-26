-- ============================================
-- FIX: Separate RLS policies by page context
-- Dashboard (/app/tours) should show only own organization tours
-- Public catalog (/app/tours-publicos) should show all published tours
-- ============================================

-- 1. Drop conflicting policies that allow authenticated users to see all published tours
DROP POLICY IF EXISTS "Public page access" ON public.virtual_tours;
DROP POLICY IF EXISTS "Anonymous can view published tours" ON public.virtual_tours;

-- 2. Create policy for anonymous users to view published tours
-- This is used in /app/tours-publicos and /viewer/:id
CREATE POLICY "Public can view published tours" 
ON public.virtual_tours 
FOR SELECT 
TO anon
USING (is_published = true);

-- 3. Create policy for authenticated users
-- Allows viewing published tours OR own organization tours
-- Dashboard code already filters by organization_id to show only own tours
CREATE POLICY "Authenticated can view published tours" 
ON public.virtual_tours 
FOR SELECT 
TO authenticated
USING (
  is_published = true 
  OR organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
);