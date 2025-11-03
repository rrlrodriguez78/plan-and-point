-- Migración para invertir coordenadas 'u' existentes y recalcular theta
-- OPCIÓN 2: Corregir datos existentes para alinear 2D editor con visualización 3D

-- Actualizar coordenadas u e invertirlas, recalcular theta basado en el nuevo u
UPDATE hotspot_navigation_points
SET 
  u = 1 - u,
  theta = ((1 - u) - 0.5) * 360
WHERE 
  u IS NOT NULL 
  AND u BETWEEN 0 AND 1;