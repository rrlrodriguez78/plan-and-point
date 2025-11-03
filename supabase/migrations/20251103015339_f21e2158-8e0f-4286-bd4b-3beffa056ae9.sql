-- Revertir coordenadas 'u' de Opción 2 y recalcular theta
-- OPCIÓN 1: Volver a datos originales para trabajar con canvas invertido

UPDATE hotspot_navigation_points
SET 
  u = 1 - u,
  theta = -(u - 0.5) * 360
WHERE 
  u IS NOT NULL 
  AND u BETWEEN 0 AND 1;