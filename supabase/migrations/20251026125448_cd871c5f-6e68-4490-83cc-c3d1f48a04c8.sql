-- ============================================
-- CLEANUP: Remove all data and reset RLS policies
-- ============================================

-- ELIMINAR TODOS LOS DATOS
TRUNCATE TABLE user_roles, organizations, virtual_tours, floor_plans, hotspots CASCADE;

-- ELIMINAR TODAS LAS POLÍTICAS RLS EN virtual_tours
DROP POLICY IF EXISTS "Dashboard access" ON virtual_tours;
DROP POLICY IF EXISTS "Public page access" ON virtual_tours;
DROP POLICY IF EXISTS "Anonymous access" ON virtual_tours;
DROP POLICY IF EXISTS "Public can view published tours" ON virtual_tours;
DROP POLICY IF EXISTS "Users view own organization tours" ON virtual_tours;
DROP POLICY IF EXISTS "Users can create tours in their organizations" ON virtual_tours;
DROP POLICY IF EXISTS "Users can update their own tours" ON virtual_tours;
DROP POLICY IF EXISTS "Users can delete their own tours" ON virtual_tours;
DROP POLICY IF EXISTS "Super admin can update all tours" ON virtual_tours;
DROP POLICY IF EXISTS "Super admin can delete all tours" ON virtual_tours;
DROP POLICY IF EXISTS "Authenticated users can view published tours" ON virtual_tours;

-- CREAR POLÍTICA BÁSICA INICIAL (permite a todos ver todos los tours)
CREATE POLICY "Basic access" 
ON virtual_tours 
FOR SELECT 
USING (true);