-- Tabla para tracking de uploads grandes
CREATE TABLE IF NOT EXISTS public.large_backup_upload (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  upload_token TEXT NOT NULL UNIQUE,
  total_chunks INTEGER NOT NULL,
  chunk_size INTEGER NOT NULL,
  total_size BIGINT NOT NULL,
  backup_name TEXT NOT NULL,
  description TEXT,
  device_info JSONB,
  current_chunk INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Tabla para almacenar chunks individuales
CREATE TABLE IF NOT EXISTS public.backup_chunks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID NOT NULL,
  user_id UUID NOT NULL,
  chunk_number INTEGER NOT NULL,
  chunk_data TEXT NOT NULL,
  chunk_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT fk_upload FOREIGN KEY (upload_id) REFERENCES public.large_backup_upload(id) ON DELETE CASCADE,
  UNIQUE(upload_id, chunk_number)
);

-- Índices para mejor rendimiento
CREATE INDEX idx_large_upload_user ON public.large_backup_upload(user_id);
CREATE INDEX idx_large_upload_token ON public.large_backup_upload(upload_token);
CREATE INDEX idx_large_upload_status ON public.large_backup_upload(status);
CREATE INDEX idx_backup_chunks_upload ON public.backup_chunks(upload_id);
CREATE INDEX idx_backup_chunks_user ON public.backup_chunks(user_id);
CREATE INDEX idx_backup_chunks_number ON public.backup_chunks(upload_id, chunk_number);

-- Enable RLS
ALTER TABLE public.large_backup_upload ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_chunks ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can manage their own large uploads"
  ON public.large_backup_upload
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own backup chunks"
  ON public.backup_chunks
  FOR ALL
  USING (auth.uid() = user_id);

-- Función para iniciar un upload grande
CREATE OR REPLACE FUNCTION start_large_backup_upload(
  p_upload_token TEXT,
  p_total_chunks INTEGER,
  p_chunk_size INTEGER,
  p_total_size BIGINT,
  p_backup_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_device_info JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_upload_id UUID;
BEGIN
  SELECT id INTO v_upload_id
  FROM public.large_backup_upload
  WHERE upload_token = p_upload_token AND user_id = auth.uid();
  
  IF v_upload_id IS NOT NULL THEN
    UPDATE public.large_backup_upload
    SET status = 'uploading',
        completed_at = NULL
    WHERE id = v_upload_id;
    
    RETURN v_upload_id;
  END IF;
  
  INSERT INTO public.large_backup_upload (
    user_id,
    upload_token,
    total_chunks,
    chunk_size,
    total_size,
    backup_name,
    description,
    device_info
  ) VALUES (
    auth.uid(),
    p_upload_token,
    p_total_chunks,
    p_chunk_size,
    p_total_size,
    p_backup_name,
    p_description,
    p_device_info
  ) RETURNING id INTO v_upload_id;
  
  RETURN v_upload_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función para subir un chunk individual
CREATE OR REPLACE FUNCTION upload_backup_chunk(
  p_upload_token TEXT,
  p_chunk_number INTEGER,
  p_chunk_data TEXT,
  p_chunk_hash TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_upload_id UUID;
  v_user_id UUID;
  v_total_chunks INTEGER;
BEGIN
  SELECT id, user_id, total_chunks INTO v_upload_id, v_user_id, v_total_chunks
  FROM public.large_backup_upload
  WHERE upload_token = p_upload_token AND status = 'uploading';
  
  IF v_upload_id IS NULL THEN
    RAISE EXCEPTION 'Upload not found or not in uploading status';
  END IF;
  
  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  IF p_chunk_number < 1 OR p_chunk_number > v_total_chunks THEN
    RAISE EXCEPTION 'Invalid chunk number';
  END IF;
  
  INSERT INTO public.backup_chunks (
    upload_id,
    user_id,
    chunk_number,
    chunk_data,
    chunk_hash
  ) VALUES (
    v_upload_id,
    v_user_id,
    p_chunk_number,
    p_chunk_data,
    p_chunk_hash
  ) ON CONFLICT (upload_id, chunk_number) 
  DO UPDATE SET 
    chunk_data = EXCLUDED.chunk_data,
    chunk_hash = EXCLUDED.chunk_hash,
    created_at = NOW();
  
  UPDATE public.large_backup_upload
  SET current_chunk = GREATEST(current_chunk, p_chunk_number)
  WHERE id = v_upload_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función para completar el upload y reconstruir datos
CREATE OR REPLACE FUNCTION complete_large_backup_upload(
  p_upload_token TEXT
) RETURNS JSONB AS $$
DECLARE
  v_upload_id UUID;
  v_user_id UUID;
  v_total_chunks INTEGER;
  v_received_chunks INTEGER;
  v_complete_data TEXT;
BEGIN
  SELECT 
    lub.id, 
    lub.user_id, 
    lub.total_chunks
  INTO v_upload_id, v_user_id, v_total_chunks
  FROM public.large_backup_upload lub
  WHERE lub.upload_token = p_upload_token AND lub.status = 'uploading';
  
  IF v_upload_id IS NULL THEN
    RAISE EXCEPTION 'Upload not found or not in uploading status';
  END IF;
  
  IF v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  SELECT COUNT(*) INTO v_received_chunks
  FROM public.backup_chunks
  WHERE upload_id = v_upload_id;
  
  IF v_received_chunks != v_total_chunks THEN
    RAISE EXCEPTION 'Missing chunks. Received: %, Expected: %', v_received_chunks, v_total_chunks;
  END IF;
  
  SELECT string_agg(chunk_data, '' ORDER BY chunk_number) INTO v_complete_data
  FROM public.backup_chunks
  WHERE upload_id = v_upload_id;
  
  UPDATE public.large_backup_upload
  SET status = 'completed',
      completed_at = NOW()
  WHERE id = v_upload_id;
  
  RETURN v_complete_data::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función para verificar progreso de upload
CREATE OR REPLACE FUNCTION get_upload_progress(p_upload_token TEXT)
RETURNS TABLE(
  upload_id UUID,
  total_chunks INTEGER,
  uploaded_chunks INTEGER,
  progress_percentage INTEGER,
  status TEXT,
  current_chunk INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    lub.id as upload_id,
    lub.total_chunks,
    COALESCE(chunk_count.uploaded_chunks, 0)::INTEGER as uploaded_chunks,
    CASE 
      WHEN lub.total_chunks > 0 THEN 
        ((COALESCE(chunk_count.uploaded_chunks, 0) * 100) / lub.total_chunks)::INTEGER
      ELSE 0
    END as progress_percentage,
    lub.status,
    lub.current_chunk
  FROM public.large_backup_upload lub
  LEFT JOIN (
    SELECT upload_id, COUNT(*) as uploaded_chunks
    FROM public.backup_chunks
    GROUP BY upload_id
  ) chunk_count ON chunk_count.upload_id = lub.id
  WHERE lub.upload_token = p_upload_token AND lub.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función para cancelar upload
CREATE OR REPLACE FUNCTION cancel_backup_upload(p_upload_token TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.large_backup_upload
  SET status = 'cancelled'
  WHERE upload_token = p_upload_token AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Función de limpieza para uploads antiguos
CREATE OR REPLACE FUNCTION cleanup_failed_uploads()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  WITH deleted_uploads AS (
    DELETE FROM public.large_backup_upload
    WHERE status IN ('failed', 'cancelled') 
      AND created_at < (NOW() - INTERVAL '24 hours')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted_uploads;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;