-- ============================================
-- PASO 1: Modificar RLS Policies de virtual_tours
-- ============================================

-- Eliminar la policy problemática que permite a todos ver tours publicados sin restricción
DROP POLICY IF EXISTS "Published tours are viewable by everyone" ON public.virtual_tours;

-- Crear policy separada para visualización pública (viewer y tours públicos)
-- Esta permite SELECT a CUALQUIERA (incluso no autenticados) para tours publicados
CREATE POLICY "Public can view published tours for viewer"
ON public.virtual_tours
FOR SELECT
USING (is_published = true);

-- La policy "Users can view their own tours" ya existe y está correcta
-- Verifica que solo el owner de la organización pueda ver sus tours
-- Esta se usará en /app/tours

-- Las policies de UPDATE y DELETE ya existen y están correctas
-- Solo permiten al owner de la organización modificar/eliminar

-- ============================================
-- PASO 2: Añadir opción de Super Admin global
-- ============================================

-- Crear policy adicional para que super admin pueda ver TODOS los tours
CREATE POLICY "Super admin can view all tours"
ON public.virtual_tours
FOR SELECT
USING (is_super_admin(auth.uid()));

-- Permitir al super admin actualizar cualquier tour
CREATE POLICY "Super admin can update all tours"
ON public.virtual_tours
FOR UPDATE
USING (is_super_admin(auth.uid()));

-- Permitir al super admin eliminar cualquier tour
CREATE POLICY "Super admin can delete all tours"
ON public.virtual_tours
FOR DELETE
USING (is_super_admin(auth.uid()));

-- ============================================
-- PASO 3: Verificar aislamiento en floor_plans
-- ============================================

-- Las policies actuales de floor_plans ya verifican la organización del tour
-- Solo aseguramos que el super admin también tenga acceso

CREATE POLICY "Super admin can view all floor plans"
ON public.floor_plans
FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can manage all floor plans"
ON public.floor_plans
FOR ALL
USING (is_super_admin(auth.uid()));

-- ============================================
-- PASO 4: Verificar aislamiento en hotspots
-- ============================================

CREATE POLICY "Super admin can view all hotspots"
ON public.hotspots
FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can manage all hotspots"
ON public.hotspots
FOR ALL
USING (is_super_admin(auth.uid()));

-- ============================================
-- PASO 5: Verificar aislamiento en panorama_photos
-- ============================================

CREATE POLICY "Super admin can view all panorama photos"
ON public.panorama_photos
FOR SELECT
USING (is_super_admin(auth.uid()));

CREATE POLICY "Super admin can manage all panorama photos"
ON public.panorama_photos
FOR ALL
USING (is_super_admin(auth.uid()));