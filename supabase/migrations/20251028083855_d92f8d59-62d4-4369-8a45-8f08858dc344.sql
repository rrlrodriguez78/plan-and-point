-- Trigger para procesar automáticamente cuando se agrega a la cola
CREATE OR REPLACE FUNCTION trigger_process_backup_queue()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Programar procesamiento en 10 segundos para dar tiempo a agrupar trabajos
    PERFORM pg_notify('backup_queue_updated', 
        json_build_object(
            'action', 'process_queue', 
            'queue_id', NEW.id,
            'timestamp', extract(epoch from now())
        )::text
    );
    
    RETURN NEW;
END;
$$;

-- Crear trigger para nuevas inserciones en la cola
DROP TRIGGER IF EXISTS on_backup_queue_insert ON backup_queue;

CREATE TRIGGER on_backup_queue_insert
    AFTER INSERT ON backup_queue
    FOR EACH ROW
    EXECUTE FUNCTION trigger_process_backup_queue();