-- Paso 1: Sincronizar comments_count con la cantidad real de comentarios
UPDATE tour_analytics ta
SET comments_count = (
  SELECT COUNT(*)
  FROM tour_comments tc
  WHERE tc.tour_id = ta.tour_id
)
WHERE EXISTS (
  SELECT 1 FROM tour_comments tc WHERE tc.tour_id = ta.tour_id
);

-- Paso 2: Crear función para actualizar comments_count automáticamente
CREATE OR REPLACE FUNCTION update_comments_count()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Incrementar contador
    INSERT INTO tour_analytics (tour_id, comments_count)
    VALUES (NEW.tour_id, 1)
    ON CONFLICT (tour_id) 
    DO UPDATE SET comments_count = tour_analytics.comments_count + 1;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrementar contador
    UPDATE tour_analytics
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE tour_id = OLD.tour_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Paso 3: Crear trigger
DROP TRIGGER IF EXISTS trigger_update_comments_count ON tour_comments;
CREATE TRIGGER trigger_update_comments_count
  AFTER INSERT OR DELETE ON tour_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comments_count();