-- ============================================================
-- SISTEMA DE BACKUP SIMPLIFICADO - Nueva Tabla
-- ============================================================

-- Crear tabla backup_jobs con soporte multi-tenant
CREATE TABLE public.backup_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tour_id UUID NOT NULL REFERENCES public.virtual_tours(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('full_backup', 'media_only')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  file_url TEXT,
  file_size BIGINT,
  error_message TEXT,
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Comentarios para documentación
COMMENT ON TABLE public.backup_jobs IS 'Gestión de trabajos de backup para tours virtuales con soporte multi-tenant';
COMMENT ON COLUMN public.backup_jobs.job_type IS 'Tipo: full_backup (JSON + imágenes) o media_only (solo imágenes)';
COMMENT ON COLUMN public.backup_jobs.status IS 'Estado: pending, processing, completed, failed, cancelled';
COMMENT ON COLUMN public.backup_jobs.metadata IS 'Metadata adicional: detalles del backup, configuración, logs';

-- Índices para optimizar consultas
CREATE INDEX idx_backup_jobs_user_id ON public.backup_jobs(user_id);
CREATE INDEX idx_backup_jobs_tenant_id ON public.backup_jobs(tenant_id);
CREATE INDEX idx_backup_jobs_tour_id ON public.backup_jobs(tour_id);
CREATE INDEX idx_backup_jobs_status ON public.backup_jobs(status);
CREATE INDEX idx_backup_jobs_job_type ON public.backup_jobs(job_type);
CREATE INDEX idx_backup_jobs_created_at ON public.backup_jobs(created_at DESC);
CREATE INDEX idx_backup_jobs_status_created ON public.backup_jobs(status, created_at DESC);

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_backup_jobs_updated_at
  BEFORE UPDATE ON public.backup_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - SIN RECURSIÓN
-- ============================================================

ALTER TABLE public.backup_jobs ENABLE ROW LEVEL SECURITY;

-- Política 1: Los usuarios pueden ver sus propios backup jobs
CREATE POLICY "Users can view their own backup jobs"
  ON public.backup_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Política 2: Los usuarios pueden ver backup jobs de su tenant
CREATE POLICY "Users can view backup jobs in their tenant"
  ON public.backup_jobs
  FOR SELECT
  USING (belongs_to_tenant(auth.uid(), tenant_id));

-- Política 3: Los usuarios pueden crear backup jobs para tours de su tenant
CREATE POLICY "Users can create backup jobs"
  ON public.backup_jobs
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND belongs_to_tenant(auth.uid(), tenant_id)
  );

-- Política 4: Los usuarios pueden actualizar sus propios backup jobs
CREATE POLICY "Users can update their own backup jobs"
  ON public.backup_jobs
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Política 5: Los usuarios pueden cancelar sus propios backup jobs
CREATE POLICY "Users can delete their own backup jobs"
  ON public.backup_jobs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Política 6: Super admins tienen acceso completo
CREATE POLICY "Super admins can manage all backup jobs"
  ON public.backup_jobs
  FOR ALL
  USING (is_super_admin(auth.uid()));

-- ============================================================
-- FUNCIÓN DE LIMPIEZA AUTOMÁTICA
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_backup_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER := 0;
BEGIN
  -- Eliminar jobs completados o fallidos mayores a 30 días
  WITH deleted_jobs AS (
    DELETE FROM public.backup_jobs
    WHERE status IN ('completed', 'failed', 'cancelled')
      AND created_at < (NOW() - INTERVAL '30 days')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted_jobs;
  
  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_backup_jobs() IS 'Elimina backup jobs antiguos (>30 días) que están completados, fallidos o cancelados';