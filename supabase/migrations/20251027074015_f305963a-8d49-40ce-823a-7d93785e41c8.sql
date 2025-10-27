-- Función para obtener dashboard de métricas
CREATE OR REPLACE FUNCTION public.get_backup_dashboard()
RETURNS TABLE(
  total_uploads BIGINT,
  successful_uploads BIGINT,
  average_upload_size BIGINT,
  average_upload_time INTERVAL,
  total_storage_used BIGINT,
  last_upload_date TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_uploads,
    COUNT(*) FILTER (WHERE status = 'completed') as successful_uploads,
    AVG(total_size)::BIGINT as average_upload_size,
    AVG(completed_at - created_at) as average_upload_time,
    COALESCE(SUM(total_size), 0) as total_storage_used,
    MAX(created_at) as last_upload_date
  FROM public.large_backup_upload
  WHERE user_id = auth.uid();
END;
$$;