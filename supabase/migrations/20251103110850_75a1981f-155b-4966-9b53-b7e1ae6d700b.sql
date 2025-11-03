-- Eliminar la restricción única antigua que no incluye capture_date
DROP INDEX IF EXISTS idx_nav_unique_connection;

-- Crear nueva restricción única que incluye capture_date
-- Esto permite tener la misma conexión (from->to) en fechas diferentes
CREATE UNIQUE INDEX idx_nav_unique_connection_with_date 
ON hotspot_navigation_points(from_hotspot_id, to_hotspot_id, capture_date);