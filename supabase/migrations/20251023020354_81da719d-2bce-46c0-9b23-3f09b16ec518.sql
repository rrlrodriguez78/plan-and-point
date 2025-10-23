-- Crear tabla panorama_photos
CREATE TABLE IF NOT EXISTS public.panorama_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotspot_id UUID NOT NULL REFERENCES public.hotspots(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crear índice para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_panorama_hotspot ON public.panorama_photos(hotspot_id);

-- Agregar columnas a la tabla hotspots
ALTER TABLE public.hotspots 
ADD COLUMN IF NOT EXISTS has_panorama BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS panorama_count INTEGER DEFAULT 0;

-- Habilitar RLS en panorama_photos
ALTER TABLE public.panorama_photos ENABLE ROW LEVEL SECURITY;

-- Policy: Lectura pública para tours publicados
CREATE POLICY "Published tour panoramas are viewable by everyone"
ON public.panorama_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.hotspots h
    JOIN public.floor_plans fp ON h.floor_plan_id = fp.id
    JOIN public.virtual_tours vt ON fp.tour_id = vt.id
    WHERE h.id = panorama_photos.hotspot_id
    AND vt.is_published = true
  )
);

-- Policy: Usuarios pueden ver panoramas de sus propios tours
CREATE POLICY "Users can view panoramas of their tours"
ON public.panorama_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.hotspots h
    JOIN public.floor_plans fp ON h.floor_plan_id = fp.id
    JOIN public.virtual_tours vt ON fp.tour_id = vt.id
    JOIN public.organizations o ON vt.organization_id = o.id
    WHERE h.id = panorama_photos.hotspot_id
    AND o.owner_id = auth.uid()
  )
);

-- Policy: Usuarios pueden crear panoramas en sus tours
CREATE POLICY "Users can create panoramas for their tours"
ON public.panorama_photos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.hotspots h
    JOIN public.floor_plans fp ON h.floor_plan_id = fp.id
    JOIN public.virtual_tours vt ON fp.tour_id = vt.id
    JOIN public.organizations o ON vt.organization_id = o.id
    WHERE h.id = panorama_photos.hotspot_id
    AND o.owner_id = auth.uid()
  )
);

-- Policy: Usuarios pueden actualizar panoramas de sus tours
CREATE POLICY "Users can update panoramas of their tours"
ON public.panorama_photos
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.hotspots h
    JOIN public.floor_plans fp ON h.floor_plan_id = fp.id
    JOIN public.virtual_tours vt ON fp.tour_id = vt.id
    JOIN public.organizations o ON vt.organization_id = o.id
    WHERE h.id = panorama_photos.hotspot_id
    AND o.owner_id = auth.uid()
  )
);

-- Policy: Usuarios pueden eliminar panoramas de sus tours
CREATE POLICY "Users can delete panoramas of their tours"
ON public.panorama_photos
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.hotspots h
    JOIN public.floor_plans fp ON h.floor_plan_id = fp.id
    JOIN public.virtual_tours vt ON fp.tour_id = vt.id
    JOIN public.organizations o ON vt.organization_id = o.id
    WHERE h.id = panorama_photos.hotspot_id
    AND o.owner_id = auth.uid()
  )
);

-- Función para actualizar contador de panoramas
CREATE OR REPLACE FUNCTION public.update_hotspot_panorama_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.hotspots
    SET panorama_count = panorama_count + 1,
        has_panorama = true
    WHERE id = NEW.hotspot_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.hotspots
    SET panorama_count = GREATEST(0, panorama_count - 1),
        has_panorama = CASE WHEN panorama_count - 1 > 0 THEN true ELSE false END
    WHERE id = OLD.hotspot_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para mantener actualizado el contador
CREATE TRIGGER update_panorama_count_trigger
AFTER INSERT OR DELETE ON public.panorama_photos
FOR EACH ROW
EXECUTE FUNCTION public.update_hotspot_panorama_count();