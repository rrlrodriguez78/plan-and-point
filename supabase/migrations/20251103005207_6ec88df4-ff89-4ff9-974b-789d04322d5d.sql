-- Migración: Recalcular theta basado en valores u con la fórmula invertida
-- Esto unifica las coordenadas para que coincidan entre 2D, 3D editor y visor

UPDATE hotspot_navigation_points
SET theta = -(u - 0.5) * 360
WHERE u IS NOT NULL 
  AND u BETWEEN 0 AND 1
  AND theta IS NOT NULL;

-- Log de registros actualizados
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Actualizados % puntos de navegación con theta recalculado desde u', updated_count;
END $$;