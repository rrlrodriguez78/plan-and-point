-- Fix search_path security issue in cleanup_old_exports function
CREATE OR REPLACE FUNCTION cleanup_old_exports()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  WITH deleted_exports AS (
    DELETE FROM tour_exports
    WHERE expires_at < NOW()
    RETURNING *
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted_exports;
  
  RETURN v_deleted_count;
END;
$$;