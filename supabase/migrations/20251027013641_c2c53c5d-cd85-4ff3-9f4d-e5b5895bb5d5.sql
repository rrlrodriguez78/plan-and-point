-- Actualizar floor_plans existentes para agregar el tenant_id basado en el tour
UPDATE floor_plans fp
SET tenant_id = vt.tenant_id
FROM virtual_tours vt
WHERE fp.tour_id = vt.id AND fp.tenant_id IS NULL;

-- Hacer tenant_id NOT NULL para prevenir futuros problemas
ALTER TABLE floor_plans
ALTER COLUMN tenant_id SET NOT NULL;