-- Agregar columna display_order a hotspots para orden secuencial
ALTER TABLE hotspots 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Crear índice para optimizar queries ordenadas por floor_plan y orden
CREATE INDEX IF NOT EXISTS idx_hotspots_display_order 
ON hotspots(floor_plan_id, display_order);

-- Actualizar hotspots existentes con orden basado en fecha de creación
UPDATE hotspots 
SET display_order = subquery.row_num
FROM (
  SELECT id, 
         ROW_NUMBER() OVER (
           PARTITION BY floor_plan_id 
           ORDER BY created_at
         ) as row_num
  FROM hotspots
) AS subquery
WHERE hotspots.id = subquery.id
  AND hotspots.display_order = 0;

-- Comentario de documentación
COMMENT ON COLUMN hotspots.display_order IS 
  'Orden de visualización del hotspot en tours secuenciales. 1 = primero, 2 = segundo, etc.';