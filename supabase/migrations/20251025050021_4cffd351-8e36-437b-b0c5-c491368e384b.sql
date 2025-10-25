-- Agregar columnas para protección con contraseña en tours públicos
ALTER TABLE public.virtual_tours
ADD COLUMN password_protected BOOLEAN DEFAULT FALSE,
ADD COLUMN password_hash TEXT NULL,
ADD COLUMN password_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Comentarios para documentación
COMMENT ON COLUMN public.virtual_tours.password_protected IS 'Indica si el tour requiere contraseña para acceso público';
COMMENT ON COLUMN public.virtual_tours.password_hash IS 'Hash bcrypt de la contraseña (nunca almacenar contraseñas en texto plano)';
COMMENT ON COLUMN public.virtual_tours.password_updated_at IS 'Timestamp de última actualización de contraseña, usado para invalidar tokens antiguos';

-- Crear trigger para actualizar password_updated_at cuando cambia password_hash
CREATE OR REPLACE FUNCTION public.update_password_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.password_updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tour_password_timestamp
BEFORE UPDATE ON public.virtual_tours
FOR EACH ROW
EXECUTE FUNCTION public.update_password_timestamp();