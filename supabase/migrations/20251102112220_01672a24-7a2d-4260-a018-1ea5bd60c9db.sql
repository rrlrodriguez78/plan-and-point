-- FASE 1: Tabla de cola para procesamiento en background
CREATE TABLE IF NOT EXISTS photo_sync_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    tour_id UUID NOT NULL,
    photo_id UUID NOT NULL REFERENCES panorama_photos(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    priority INTEGER DEFAULT 1,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT unique_photo_queue UNIQUE (photo_id, tour_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_photo_sync_queue_status ON photo_sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_photo_sync_queue_tour ON photo_sync_queue(tour_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_photo_sync_queue_priority ON photo_sync_queue(priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_photo_sync_queue_pending ON photo_sync_queue(status, attempts) WHERE status = 'pending';

-- RLS policies para photo_sync_queue
ALTER TABLE photo_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage queue"
  ON photo_sync_queue
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can view their tenant queue"
  ON photo_sync_queue
  FOR SELECT
  USING (belongs_to_tenant(auth.uid(), tenant_id));

-- Función para añadir fotos a la cola
CREATE OR REPLACE FUNCTION enqueue_photos_for_sync(
  p_tenant_id UUID,
  p_tour_id UUID,
  p_photo_ids UUID[]
)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  inserted_count INTEGER := 0;
  photo_id UUID;
BEGIN
  -- Insertar fotos en la cola, ignorando duplicados
  FOREACH photo_id IN ARRAY p_photo_ids
  LOOP
    BEGIN
      INSERT INTO photo_sync_queue (tenant_id, tour_id, photo_id, status, priority)
      VALUES (p_tenant_id, p_tour_id, photo_id, 'pending', 1)
      ON CONFLICT (photo_id, tour_id) DO NOTHING;
      
      IF FOUND THEN
        inserted_count := inserted_count + 1;
      END IF;
    EXCEPTION
      WHEN foreign_key_violation THEN
        -- Skip if photo doesn't exist
        CONTINUE;
    END;
  END LOOP;
  
  RETURN inserted_count;
END;
$$;

-- Función para obtener próximas fotos a procesar
CREATE OR REPLACE FUNCTION get_next_photos_to_process(
  p_batch_size INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  tour_id UUID,
  photo_id UUID,
  attempts INTEGER
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    psq.id,
    psq.tenant_id,
    psq.tour_id,
    psq.photo_id,
    psq.attempts
  FROM photo_sync_queue psq
  WHERE psq.status = 'pending'
    AND psq.attempts < psq.max_attempts
  ORDER BY psq.priority DESC, psq.created_at ASC
  LIMIT p_batch_size
  FOR UPDATE SKIP LOCKED; -- Evita race conditions entre workers
END;
$$;

-- Función para actualizar estado de foto en cola
CREATE OR REPLACE FUNCTION update_queue_item_status(
  p_queue_id UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE photo_sync_queue
  SET 
    status = p_status,
    error_message = p_error_message,
    attempts = CASE WHEN p_status = 'failed' THEN attempts + 1 ELSE attempts END,
    processed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_queue_id;
END;
$$;

-- Función para limpiar items viejos de la cola
CREATE OR REPLACE FUNCTION cleanup_old_queue_items()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Eliminar items completados/failed de más de 7 días
  DELETE FROM photo_sync_queue
  WHERE status IN ('completed', 'failed')
    AND processed_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RAISE NOTICE 'Cleaned up % old queue items', deleted_count;
  RETURN deleted_count;
END;
$$;

-- Función para obtener estadísticas de la cola
CREATE OR REPLACE FUNCTION get_queue_stats_by_tour(p_tour_id UUID)
RETURNS TABLE (
  pending_count BIGINT,
  processing_count BIGINT,
  completed_count BIGINT,
  failed_count BIGINT,
  total_count BIGINT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE status = 'processing') as processing_count,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
    COUNT(*) as total_count
  FROM photo_sync_queue
  WHERE tour_id = p_tour_id;
END;
$$;