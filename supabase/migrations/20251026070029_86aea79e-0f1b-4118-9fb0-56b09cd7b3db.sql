-- ============================================
-- SEPARACIÓN AUTOMÁTICA DE ORGANIZACIONES
-- ============================================

-- Modificar la función handle_new_user para crear organización automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insertar perfil de usuario
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  
  -- Crear organización única para el nuevo usuario
  INSERT INTO public.organizations (owner_id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || '''s Organization'
  );
  
  RETURN NEW;
END;
$$;

-- ============================================
-- VERIFICAR QUE LAS RLS POLICIES ESTÉN CORRECTAS
-- ============================================

-- La policy de organizations ya está correcta:
-- "Users can view their own organizations" USING (auth.uid() = owner_id)
-- "Users can create organizations" WITH CHECK (auth.uid() = owner_id)
-- Etc.

-- Añadir constraint para garantizar que owner_id sea único
-- Esto previene que un usuario tenga múltiples organizaciones
ALTER TABLE public.organizations
DROP CONSTRAINT IF EXISTS unique_owner_id;

ALTER TABLE public.organizations
ADD CONSTRAINT unique_owner_id UNIQUE (owner_id);

-- ============================================
-- MIGRAR USUARIOS EXISTENTES
-- ============================================

-- Para usuarios que ya existen pero no tienen organización, créales una
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT p.id, p.email, p.full_name
    FROM public.profiles p
    LEFT JOIN public.organizations o ON o.owner_id = p.id
    WHERE o.id IS NULL
  LOOP
    INSERT INTO public.organizations (owner_id, name)
    VALUES (
      user_record.id,
      COALESCE(user_record.full_name, user_record.email) || '''s Organization'
    )
    ON CONFLICT (owner_id) DO NOTHING;
  END LOOP;
END $$;