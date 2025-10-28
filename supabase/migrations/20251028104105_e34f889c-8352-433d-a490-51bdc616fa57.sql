-- Crear tabla para rastrear las partes de los backups
CREATE TABLE IF NOT EXISTS public.backup_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_job_id UUID NOT NULL REFERENCES public.backup_jobs(id) ON DELETE CASCADE,
  part_number INTEGER NOT NULL,
  file_url TEXT,
  storage_path TEXT,
  file_size BIGINT,
  file_hash TEXT,
  items_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(backup_job_id, part_number)
);

-- Index para búsquedas rápidas
CREATE INDEX idx_backup_parts_job_id ON public.backup_parts(backup_job_id);
CREATE INDEX idx_backup_parts_status ON public.backup_parts(status);

-- RLS policies
ALTER TABLE public.backup_parts ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver las partes de sus propios backups
CREATE POLICY "Users can view their backup parts"
  ON public.backup_parts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.backup_jobs
      WHERE backup_jobs.id = backup_parts.backup_job_id
      AND backup_jobs.user_id = auth.uid()
    )
  );

-- El sistema puede gestionar todas las partes
CREATE POLICY "Service role can manage all backup parts"
  ON public.backup_parts
  FOR ALL
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.backup_parts IS 'Stores individual parts of multi-part backups';
COMMENT ON COLUMN public.backup_parts.part_number IS '1-indexed part number (part1, part2, etc)';
COMMENT ON COLUMN public.backup_parts.items_count IS 'Number of images in this part';