-- Tabla para puntos de navegación 3D en panorámicas
CREATE TABLE IF NOT EXISTS hotspot_navigation_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_hotspot_id UUID NOT NULL REFERENCES hotspots(id) ON DELETE CASCADE,
  to_hotspot_id UUID NOT NULL REFERENCES hotspots(id) ON DELETE CASCADE,
  
  -- Coordenadas esféricas para posicionar la flecha en el 360°
  -- theta: ángulo horizontal (-180 a 180 grados, 0 = frente)
  -- phi: ángulo vertical (0 a 180 grados, 90 = horizonte)
  theta DECIMAL(6, 2) NOT NULL, 
  phi DECIMAL(6, 2) NOT NULL DEFAULT 90,
  
  -- Altura de la flecha en la escena (opcional, para ajustes finos)
  height_offset DECIMAL(5, 2) DEFAULT 0,
  
  -- Estilo visual del punto (color, tamaño, icono)
  style JSONB DEFAULT '{"color": "#4F46E5", "size": 1.0, "icon": "arrow"}'::jsonb,
  
  -- Metadatos
  label TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE hotspot_navigation_points ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (acceso basado en tenant del tour)
CREATE POLICY "Users can view navigation points from their tenant tours"
  ON hotspot_navigation_points FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM hotspots h
      JOIN floor_plans fp ON h.floor_plan_id = fp.id
      JOIN virtual_tours vt ON fp.tour_id = vt.id
      JOIN tenant_users tu ON vt.tenant_id = tu.tenant_id
      WHERE h.id = hotspot_navigation_points.from_hotspot_id
        AND tu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage navigation points from their tenant tours"
  ON hotspot_navigation_points FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM hotspots h
      JOIN floor_plans fp ON h.floor_plan_id = fp.id
      JOIN virtual_tours vt ON fp.tour_id = vt.id
      JOIN tenant_users tu ON vt.tenant_id = tu.tenant_id
      WHERE h.id = hotspot_navigation_points.from_hotspot_id
        AND tu.user_id = auth.uid()
    )
  );

-- Índices para optimizar queries
CREATE INDEX idx_nav_from_hotspot ON hotspot_navigation_points(from_hotspot_id);
CREATE INDEX idx_nav_to_hotspot ON hotspot_navigation_points(to_hotspot_id);
CREATE INDEX idx_nav_active ON hotspot_navigation_points(is_active);

-- Constraint para evitar conexiones duplicadas
CREATE UNIQUE INDEX idx_nav_unique_connection 
  ON hotspot_navigation_points(from_hotspot_id, to_hotspot_id);

-- Función helper para auto-detectar conexiones basadas en proximidad
CREATE OR REPLACE FUNCTION suggest_hotspot_connections(
  p_floor_plan_id UUID,
  p_max_distance DECIMAL DEFAULT 30.0
)
RETURNS TABLE(
  from_id UUID,
  to_id UUID,
  distance DECIMAL,
  suggested_theta DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h1.id as from_id,
    h2.id as to_id,
    SQRT(POWER(h2.x_position - h1.x_position, 2) + POWER(h2.y_position - h1.y_position, 2)) as distance,
    DEGREES(ATAN2(h2.y_position - h1.y_position, h2.x_position - h1.x_position)) as suggested_theta
  FROM hotspots h1
  CROSS JOIN hotspots h2
  WHERE h1.floor_plan_id = p_floor_plan_id
    AND h2.floor_plan_id = p_floor_plan_id
    AND h1.id != h2.id
    AND h1.has_panorama = true
    AND h2.has_panorama = true
    AND SQRT(POWER(h2.x_position - h1.x_position, 2) + POWER(h2.y_position - h1.y_position, 2)) <= p_max_distance
  ORDER BY h1.id, distance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;