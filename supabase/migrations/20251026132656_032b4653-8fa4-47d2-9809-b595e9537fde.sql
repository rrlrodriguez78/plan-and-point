-- ============================================
-- MULTI-TENANT SYSTEM COMPLETE MIGRATION
-- ============================================

-- 1. RENOMBRAR organizations a tenants
ALTER TABLE public.organizations RENAME TO tenants;

-- 2. AGREGAR COLUMNAS NECESARIAS A tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise'));

-- 3. CREAR ENUM para roles de tenant
DO $$ BEGIN
  CREATE TYPE tenant_role AS ENUM ('tenant_admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. CREAR TABLA tenant_users (relación muchos a muchos)
CREATE TABLE IF NOT EXISTS public.tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role tenant_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Enable RLS
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- 5. ACTUALIZAR virtual_tours para usar tenant_id
ALTER TABLE public.virtual_tours
RENAME COLUMN organization_id TO tenant_id;

-- 6. AGREGAR tenant_id a floor_plans
ALTER TABLE public.floor_plans
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

-- Poblar tenant_id en floor_plans desde virtual_tours
UPDATE public.floor_plans fp
SET tenant_id = vt.tenant_id
FROM public.virtual_tours vt
WHERE fp.tour_id = vt.id AND fp.tenant_id IS NULL;

-- 7. CREAR FUNCIONES HELPER
-- Función para obtener los tenants de un usuario
CREATE OR REPLACE FUNCTION public.get_user_tenants(_user_id uuid)
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  user_role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    tu.role::text as user_role
  FROM public.tenants t
  INNER JOIN public.tenant_users tu ON t.id = tu.tenant_id
  WHERE tu.user_id = _user_id
  ORDER BY t.created_at ASC;
$$;

-- Función para verificar si un usuario es tenant admin
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role = 'tenant_admin'
  );
$$;

-- Función para verificar si un usuario pertenece a un tenant
CREATE OR REPLACE FUNCTION public.belongs_to_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_users
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
  );
$$;

-- 8. ACTUALIZAR handle_new_user para crear tenant automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- Insertar perfil de usuario
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  
  -- Crear tenant único para el nuevo usuario
  INSERT INTO public.tenants (owner_id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || '''s Organization'
  )
  RETURNING id INTO new_tenant_id;
  
  -- Asignar al usuario como tenant_admin del nuevo tenant
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (
    new_tenant_id,
    NEW.id,
    'tenant_admin'
  );
  
  RETURN NEW;
END;
$$;

-- 9. RLS POLICIES para tenants
DROP POLICY IF EXISTS "Users can view their own organizations" ON public.tenants;
DROP POLICY IF EXISTS "Users can create organizations" ON public.tenants;
DROP POLICY IF EXISTS "Users can update their own organizations" ON public.tenants;
DROP POLICY IF EXISTS "Users can delete their own organizations" ON public.tenants;

CREATE POLICY "Users can view their tenants" ON public.tenants
  FOR SELECT
  USING (
    auth.uid() = owner_id 
    OR EXISTS (
      SELECT 1 FROM public.tenant_users 
      WHERE tenant_id = tenants.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create tenants" ON public.tenants
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Tenant admins can update their tenants" ON public.tenants
  FOR UPDATE
  USING (
    auth.uid() = owner_id 
    OR is_tenant_admin(auth.uid(), id)
  );

CREATE POLICY "Tenant owners can delete their tenants" ON public.tenants
  FOR DELETE
  USING (auth.uid() = owner_id);

-- 10. RLS POLICIES para tenant_users
CREATE POLICY "Users can view tenant members in their tenants" ON public.tenant_users
  FOR SELECT
  USING (
    belongs_to_tenant(auth.uid(), tenant_id)
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Tenant admins can manage members" ON public.tenant_users
  FOR ALL
  USING (
    is_tenant_admin(auth.uid(), tenant_id)
    OR is_super_admin(auth.uid())
  );

-- 11. ACTUALIZAR RLS POLICIES de virtual_tours
DROP POLICY IF EXISTS "Basic access" ON public.virtual_tours;

CREATE POLICY "Users can view tours in their tenants" ON public.virtual_tours
  FOR SELECT
  USING (
    is_published = true
    OR belongs_to_tenant(auth.uid(), tenant_id)
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Tenant members can create tours" ON public.virtual_tours
  FOR INSERT
  WITH CHECK (
    belongs_to_tenant(auth.uid(), tenant_id)
  );

CREATE POLICY "Tenant admins can update tours" ON public.virtual_tours
  FOR UPDATE
  USING (
    is_tenant_admin(auth.uid(), tenant_id)
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Tenant admins can delete tours" ON public.virtual_tours
  FOR DELETE
  USING (
    is_tenant_admin(auth.uid(), tenant_id)
    OR is_super_admin(auth.uid())
  );

-- 12. ACTUALIZAR RLS POLICIES de floor_plans para usar tenant_id
DROP POLICY IF EXISTS "Users can view floor plans of their tours" ON public.floor_plans;
DROP POLICY IF EXISTS "Users can create floor plans for their tours" ON public.floor_plans;
DROP POLICY IF EXISTS "Users can update floor plans of their tours" ON public.floor_plans;
DROP POLICY IF EXISTS "Users can delete floor plans of their tours" ON public.floor_plans;

CREATE POLICY "Users can view floor plans in their tenant" ON public.floor_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_tours vt
      WHERE vt.id = floor_plans.tour_id 
        AND (vt.is_published = true OR belongs_to_tenant(auth.uid(), vt.tenant_id))
    )
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Tenant members can create floor plans" ON public.floor_plans
  FOR INSERT
  WITH CHECK (
    belongs_to_tenant(auth.uid(), tenant_id)
  );

CREATE POLICY "Tenant admins can update floor plans" ON public.floor_plans
  FOR UPDATE
  USING (
    is_tenant_admin(auth.uid(), tenant_id)
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "Tenant admins can delete floor plans" ON public.floor_plans
  FOR DELETE
  USING (
    is_tenant_admin(auth.uid(), tenant_id)
    OR is_super_admin(auth.uid())
  );

-- 13. TRIGGER para updated_at en tenant_users
CREATE TRIGGER update_tenant_users_updated_at
  BEFORE UPDATE ON public.tenant_users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 14. MIGRAR DATOS EXISTENTES
-- Crear tenant_users para todos los owners existentes
INSERT INTO public.tenant_users (tenant_id, user_id, role)
SELECT id, owner_id, 'tenant_admin'::tenant_role
FROM public.tenants
ON CONFLICT (tenant_id, user_id) DO NOTHING;