-- Agregar columna capture_date a hotspot_navigation_points
ALTER TABLE hotspot_navigation_points 
ADD COLUMN capture_date DATE;

-- Crear índice para mejorar performance en queries por fecha
CREATE INDEX idx_navigation_points_capture_date 
ON hotspot_navigation_points(capture_date);

-- Migrar datos existentes: asignar la fecha más antigua de cada hotspot
UPDATE hotspot_navigation_points np
SET capture_date = (
  SELECT MIN(pp.capture_date)
  FROM panorama_photos pp
  WHERE pp.hotspot_id = np.from_hotspot_id
)
WHERE np.capture_date IS NULL;