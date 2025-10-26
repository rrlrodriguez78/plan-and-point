-- ============================================
-- FIX: Dashboard should show only user's own organization tours
-- Even super_admins should only see their own tours in Dashboard
-- ============================================

-- 1. Drop conflicting policies
DROP POLICY IF EXISTS "Dashboard access" ON public.virtual_tours;
DROP POLICY IF EXISTS "Super admin can update all tours" ON public.virtual_tours;
DROP POLICY IF EXISTS "Super admin can delete all tours" ON public.virtual_tours;

-- 2. CREATE STRICT SELECT POLICY - No super admin bypass for viewing in Dashboard
CREATE POLICY "Users view own organization tours" 
ON public.virtual_tours 
FOR SELECT 
USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE owner_id = auth.uid()
  )
);

-- 3. Keep super admin powers for UPDATE operations
CREATE POLICY "Super admin can update all tours" 
ON public.virtual_tours 
FOR UPDATE 
USING (is_super_admin(auth.uid()));

-- 4. Keep super admin powers for DELETE operations
CREATE POLICY "Super admin can delete all tours" 
ON public.virtual_tours 
FOR DELETE 
USING (is_super_admin(auth.uid()));