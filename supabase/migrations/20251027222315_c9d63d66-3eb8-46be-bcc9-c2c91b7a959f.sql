-- Tabla para jobs de backup persistentes que sobreviven a recargas
CREATE TABLE IF NOT EXISTS public.background_backup_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_token TEXT UNIQUE NOT NULL,
  backup_id UUID NOT NULL REFERENCES public.tour_backups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed', 'cancelled')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  total_chunks INTEGER DEFAULT 0,
  processed_chunks INTEGER DEFAULT 0,
  total_images INTEGER DEFAULT 0,
  processed_images INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  estimated_size_mb NUMERIC DEFAULT 0,
  current_operation TEXT,
  error_message TEXT,
  result_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_background_jobs_user_status ON public.background_backup_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_backup ON public.background_backup_jobs(backup_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_token ON public.background_backup_jobs(upload_token);
CREATE INDEX IF NOT EXISTS idx_background_jobs_last_activity ON public.background_backup_jobs(last_activity) WHERE status = 'processing';

-- RLS Policies
ALTER TABLE public.background_backup_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own backup jobs"
  ON public.background_backup_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own backup jobs"
  ON public.background_backup_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own backup jobs"
  ON public.background_backup_jobs FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_background_jobs_updated_at
  BEFORE UPDATE ON public.background_backup_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Función para limpiar jobs antiguos (más de 7 días)
CREATE OR REPLACE FUNCTION public.cleanup_old_backup_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  WITH deleted_jobs AS (
    DELETE FROM public.background_backup_jobs
    WHERE created_at < (NOW() - INTERVAL '7 days')
      AND status IN ('completed', 'failed', 'cancelled')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted_jobs;
  
  RETURN v_deleted_count;
END;
$$;

-- Función para obtener el estado de un job con detalles
CREATE OR REPLACE FUNCTION public.get_backup_job_status(p_upload_token TEXT)
RETURNS TABLE(
  upload_token TEXT,
  backup_id UUID,
  status TEXT,
  progress INTEGER,
  total_chunks INTEGER,
  processed_chunks INTEGER,
  total_images INTEGER,
  processed_images INTEGER,
  started_at TIMESTAMPTZ,
  last_activity TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_size_mb NUMERIC,
  current_operation TEXT,
  error_message TEXT,
  elapsed_seconds INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bbj.upload_token,
    bbj.backup_id,
    bbj.status,
    bbj.progress,
    bbj.total_chunks,
    bbj.processed_chunks,
    bbj.total_images,
    bbj.processed_images,
    bbj.started_at,
    bbj.last_activity,
    bbj.completed_at,
    bbj.estimated_size_mb,
    bbj.current_operation,
    bbj.error_message,
    EXTRACT(EPOCH FROM (NOW() - bbj.started_at))::INTEGER as elapsed_seconds
  FROM public.background_backup_jobs bbj
  WHERE bbj.upload_token = p_upload_token
    AND bbj.user_id = auth.uid();
END;
$$;