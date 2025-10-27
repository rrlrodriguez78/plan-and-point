-- Tabla para guardar backups de configuraciones móviles
CREATE TABLE IF NOT EXISTS public.mobile_settings_backup (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  backup_name TEXT NOT NULL,
  description TEXT,
  settings_snapshot JSONB NOT NULL,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT false,
  
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Índices para mejor rendimiento
CREATE INDEX idx_mobile_backup_user ON public.mobile_settings_backup(user_id);
CREATE INDEX idx_mobile_backup_created ON public.mobile_settings_backup(created_at DESC);
CREATE INDEX idx_mobile_backup_active ON public.mobile_settings_backup(user_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.mobile_settings_backup ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own mobile backups"
  ON public.mobile_settings_backup
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own mobile backups"
  ON public.mobile_settings_backup
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mobile backups"
  ON public.mobile_settings_backup
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mobile backups"
  ON public.mobile_settings_backup
  FOR DELETE
  USING (auth.uid() = user_id);

-- Función para crear backup automático
CREATE OR REPLACE FUNCTION create_mobile_settings_backup(
  p_backup_name TEXT,
  p_description TEXT,
  p_settings_snapshot JSONB,
  p_device_info JSONB
) RETURNS UUID AS $$
DECLARE
  v_backup_id UUID;
BEGIN
  -- Desactivar otros backups activos del usuario
  UPDATE public.mobile_settings_backup
  SET is_active = false
  WHERE user_id = auth.uid() AND is_active = true;
  
  -- Crear nuevo backup
  INSERT INTO public.mobile_settings_backup (
    user_id,
    backup_name,
    description,
    settings_snapshot,
    device_info,
    is_active
  ) VALUES (
    auth.uid(),
    p_backup_name,
    p_description,
    p_settings_snapshot,
    p_device_info,
    true
  ) RETURNING id INTO v_backup_id;
  
  RETURN v_backup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para restaurar backup
CREATE OR REPLACE FUNCTION restore_mobile_settings_backup(p_backup_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_settings JSONB;
BEGIN
  -- Verificar que el backup pertenece al usuario
  SELECT settings_snapshot INTO v_settings
  FROM public.mobile_settings_backup
  WHERE id = p_backup_id AND user_id = auth.uid();
  
  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'Backup not found or access denied';
  END IF;
  
  -- Marcar este backup como activo
  UPDATE public.mobile_settings_backup
  SET is_active = false
  WHERE user_id = auth.uid();
  
  UPDATE public.mobile_settings_backup
  SET is_active = true
  WHERE id = p_backup_id;
  
  RETURN v_settings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;