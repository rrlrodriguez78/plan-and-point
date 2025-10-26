-- Create tour_backups table
CREATE TABLE public.tour_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Metadata del backup
  backup_name TEXT NOT NULL,
  backup_type TEXT NOT NULL CHECK (backup_type IN ('manual', 'automatic', 'scheduled')),
  backup_status TEXT DEFAULT 'in_progress' CHECK (backup_status IN ('in_progress', 'completed', 'failed')),
  
  -- Contenido del backup (JSON completo)
  backup_data JSONB NOT NULL,
  
  -- Archivos incluidos
  included_files TEXT[],
  total_size_bytes BIGINT DEFAULT 0,
  
  -- Metadata adicional
  tours_count INTEGER DEFAULT 0,
  media_files_count INTEGER DEFAULT 0,
  
  -- Restauración
  can_restore BOOLEAN DEFAULT true,
  restore_expiry TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Notas
  notes TEXT
);

-- Create indexes
CREATE INDEX idx_tour_backups_user ON public.tour_backups(user_id);
CREATE INDEX idx_tour_backups_tenant ON public.tour_backups(tenant_id);
CREATE INDEX idx_tour_backups_status ON public.tour_backups(backup_status);
CREATE INDEX idx_tour_backups_created ON public.tour_backups(created_at DESC);

-- Create backup_logs table
CREATE TABLE public.backup_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_id UUID REFERENCES public.tour_backups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'restored', 'deleted', 'failed')),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_backup_logs_user ON public.backup_logs(user_id);
CREATE INDEX idx_backup_logs_backup ON public.backup_logs(backup_id);

-- Enable RLS
ALTER TABLE public.tour_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tour_backups
CREATE POLICY "Users can view their own backups"
  ON public.tour_backups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create backups"
  ON public.tour_backups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their backups"
  ON public.tour_backups FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their backups"
  ON public.tour_backups FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for backup_logs
CREATE POLICY "Users can view their own backup logs"
  ON public.backup_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert backup logs"
  ON public.backup_logs FOR INSERT
  WITH CHECK (true);

-- Create function to auto-cleanup old backups
CREATE OR REPLACE FUNCTION public.cleanup_old_backups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete backups older than 90 days
  DELETE FROM public.tour_backups
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Delete oldest backups if user has more than 20
  DELETE FROM public.tour_backups
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
      FROM public.tour_backups
    ) sub
    WHERE rn > 20
  );
END;
$$;