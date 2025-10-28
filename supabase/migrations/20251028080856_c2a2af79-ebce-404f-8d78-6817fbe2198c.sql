-- Agregar columnas para backup real a la tabla existente
ALTER TABLE backup_jobs 
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS file_hash TEXT,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS estimated_size_mb INTEGER;

-- Crear tabla de cola de procesamiento
CREATE TABLE backup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_job_id UUID NOT NULL REFERENCES backup_jobs(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry')),
  priority INTEGER DEFAULT 1,
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único parcial para evitar jobs duplicados activos
CREATE UNIQUE INDEX unique_active_job 
ON backup_queue(backup_job_id) 
WHERE status IN ('pending', 'processing', 'retry');

-- Índices para la cola
CREATE INDEX idx_backup_queue_status ON backup_queue(status, priority DESC, scheduled_at);
CREATE INDEX idx_backup_queue_backup_job ON backup_queue(backup_job_id);
CREATE INDEX idx_backup_queue_scheduled ON backup_queue(scheduled_at) WHERE status = 'pending';

-- RLS para la cola (solo admin/service role debe acceder)
ALTER TABLE backup_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage backup queue" ON backup_queue FOR ALL USING (true);