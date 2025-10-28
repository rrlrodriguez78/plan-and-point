-- Función mejorada para detectar y limpiar trabajos trabados automáticamente
CREATE OR REPLACE FUNCTION public.cleanup_stuck_backup_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cleaned_count INTEGER := 0;
  v_stuck_count INTEGER := 0;
  v_old_count INTEGER := 0;
BEGIN
  -- 1. Marcar como fallidos trabajos trabados en fase de procesamiento de imágenes (>5 minutos sin actividad)
  WITH stuck_image_jobs AS (
    UPDATE public.background_backup_jobs
    SET 
      status = 'failed',
      error_message = 'Job timed out during image processing (5+ min inactive). Use "Exportación Estructurada" for large backups.'
    WHERE status = 'processing'
      AND progress BETWEEN 20 AND 70  -- Típicamente donde se traba procesando imágenes
      AND last_activity < (NOW() - INTERVAL '5 minutes')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_stuck_count FROM stuck_image_jobs;
  
  -- 2. Marcar como fallidos trabajos muy antiguos (>30 minutos sin actividad)
  WITH old_jobs AS (
    UPDATE public.background_backup_jobs
    SET 
      status = 'failed',
      error_message = 'Job timed out - no activity for 30 minutes'
    WHERE status = 'processing'
      AND last_activity < (NOW() - INTERVAL '30 minutes')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_old_count FROM old_jobs;
  
  v_cleaned_count := v_stuck_count + v_old_count;
  
  -- 3. Eliminar registros completados/fallidos antiguos (>7 días)
  DELETE FROM public.background_backup_jobs
  WHERE status IN ('completed', 'failed', 'cancelled')
    AND created_at < (NOW() - INTERVAL '7 days');
  
  -- Log resultado
  IF v_cleaned_count > 0 THEN
    RAISE NOTICE 'Cleaned % stuck jobs (% image phase, % old)', v_cleaned_count, v_stuck_count, v_old_count;
  END IF;
  
  RETURN v_cleaned_count;
END;
$$;