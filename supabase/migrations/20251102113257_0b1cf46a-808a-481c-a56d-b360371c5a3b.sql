-- Corregir función enqueue_photos_for_sync para resolver ambigüedad de photo_id
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
  v_photo_id UUID;  -- Renombrado para evitar ambigüedad
BEGIN
  -- Insertar fotos en la cola, ignorando duplicados
  FOREACH v_photo_id IN ARRAY p_photo_ids
  LOOP
    BEGIN
      INSERT INTO photo_sync_queue (tenant_id, tour_id, photo_id, status, priority)
      VALUES (p_tenant_id, p_tour_id, v_photo_id, 'pending', 1)
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