-- Add UV coordinates to hotspot_navigation_points table
-- UV system eliminates inversion problems and is camera-rotation independent

ALTER TABLE hotspot_navigation_points
ADD COLUMN u NUMERIC,
ADD COLUMN v NUMERIC;

-- Add check constraints for UV range [0, 1]
ALTER TABLE hotspot_navigation_points
ADD CONSTRAINT check_u_range CHECK (u IS NULL OR (u >= 0 AND u <= 1)),
ADD CONSTRAINT check_v_range CHECK (v IS NULL OR (v >= 0 AND v <= 1));

COMMENT ON COLUMN hotspot_navigation_points.u IS 'Horizontal UV coordinate (0=left, 1=right) - independent of camera rotation';
COMMENT ON COLUMN hotspot_navigation_points.v IS 'Vertical UV coordinate (0=top, 1=bottom) - independent of camera rotation';