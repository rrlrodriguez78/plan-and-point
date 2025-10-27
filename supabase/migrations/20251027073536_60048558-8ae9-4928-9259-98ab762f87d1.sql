-- Tabla para métricas y analytics de backups
CREATE TABLE IF NOT EXISTS public.backup_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  upload_id UUID,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('chunk_upload', 'upload_complete', 'upload_failed', 'download_start', 'download_complete', 'download_failed')),
  chunk_size INTEGER,
  upload_duration INTERVAL,
  total_size BIGINT,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT fk_backup_metrics_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT fk_backup_metrics_upload FOREIGN KEY (upload_id) REFERENCES public.large_backup_upload(id) ON DELETE SET NULL
);

-- Índices para mejor rendimiento
CREATE INDEX idx_backup_metrics_user ON public.backup_metrics(user_id);
CREATE INDEX idx_backup_metrics_upload ON public.backup_metrics(upload_id);
CREATE INDEX idx_backup_metrics_operation ON public.backup_metrics(operation_type);
CREATE INDEX idx_backup_metrics_created ON public.backup_metrics(created_at DESC);

-- Enable RLS
ALTER TABLE public.backup_metrics ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own backup metrics"
  ON public.backup_metrics
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert backup metrics"
  ON public.backup_metrics
  FOR INSERT
  WITH CHECK (true);

-- Función para registrar métricas (parámetros reordenados)
CREATE OR REPLACE FUNCTION log_backup_metric(
  p_operation_type TEXT,
  p_success BOOLEAN,
  p_upload_id UUID DEFAULT NULL,
  p_chunk_size INTEGER DEFAULT NULL,
  p_upload_duration INTERVAL DEFAULT NULL,
  p_total_size BIGINT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.backup_metrics (
    user_id,
    upload_id,
    operation_type,
    chunk_size,
    upload_duration,
    total_size,
    success,
    error_message
  ) VALUES (
    auth.uid(),
    p_upload_id,
    p_operation_type,
    p_chunk_size,
    p_upload_duration,
    p_total_size,
    p_success,
    p_error_message
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para obtener estadísticas de métricas
CREATE OR REPLACE FUNCTION get_backup_metrics_stats(p_days INTEGER DEFAULT 30)
RETURNS TABLE(
  total_uploads INTEGER,
  successful_uploads INTEGER,
  failed_uploads INTEGER,
  avg_upload_duration INTERVAL,
  total_data_uploaded BIGINT,
  avg_chunk_size INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT upload_id)::INTEGER as total_uploads,
    COUNT(DISTINCT CASE WHEN success AND operation_type = 'upload_complete' THEN upload_id END)::INTEGER as successful_uploads,
    COUNT(DISTINCT CASE WHEN NOT success AND operation_type = 'upload_failed' THEN upload_id END)::INTEGER as failed_uploads,
    AVG(upload_duration) as avg_upload_duration,
    SUM(total_size) as total_data_uploaded,
    AVG(chunk_size)::INTEGER as avg_chunk_size
  FROM public.backup_metrics
  WHERE user_id = auth.uid() 
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;