-- Función para obtener mappings de archivos en la nube por tour
-- Usa SECURITY DEFINER para bypass RLS desde Edge Functions
CREATE OR REPLACE FUNCTION public.get_cloud_file_mappings_for_tour(p_tour_id UUID)
RETURNS TABLE (
  id UUID,
  tour_id UUID,
  photo_id UUID,
  floor_plan_id UUID,
  hotspot_id UUID,
  cloud_file_id TEXT,
  cloud_file_name TEXT,
  cloud_file_path TEXT,
  destination_id UUID,
  local_file_url TEXT,
  local_file_type TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cfm.id,
    cfm.tour_id,
    cfm.photo_id,
    cfm.floor_plan_id,
    cfm.hotspot_id,
    cfm.cloud_file_id,
    cfm.cloud_file_name,
    cfm.cloud_file_path,
    cfm.destination_id,
    cfm.local_file_url,
    cfm.local_file_type
  FROM public.cloud_file_mappings cfm
  WHERE cfm.tour_id = p_tour_id;
END;
$$;

-- Función para eliminar un mapping específico
-- Usa SECURITY DEFINER para bypass RLS desde Edge Functions
CREATE OR REPLACE FUNCTION public.delete_cloud_file_mapping(p_mapping_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.cloud_file_mappings WHERE id = p_mapping_id;
END;
$$;