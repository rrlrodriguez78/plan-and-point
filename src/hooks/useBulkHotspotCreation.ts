import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CreateHotspotParams {
  name: string;
  photo: File;
  position: { x: number; y: number };
  displayOrder: number;
}

export const useBulkHotspotCreation = (floorPlanId: string, tourId: string) => {
  const [isCreating, setIsCreating] = useState(false);

  const createHotspot = async (params: CreateHotspotParams) => {
    setIsCreating(true);
    
    try {
      // 1. Subir foto a Storage
      const fileName = `${tourId}/${floorPlanId}/${params.name}-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tour-images')
        .upload(fileName, params.photo, {
          contentType: 'image/jpeg',
          upsert: false
        });
      
      if (uploadError) throw uploadError;
      
      // 2. Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('tour-images')
        .getPublicUrl(fileName);
      
      // 3. Crear hotspot
      const { data: hotspot, error: hotspotError } = await supabase
        .from('hotspots')
        .insert({
          floor_plan_id: floorPlanId,
          title: params.name,
          x_position: params.position.x,
          y_position: params.position.y,
          display_order: params.displayOrder,
          has_panorama: true,
          panorama_count: 1
        })
        .select()
        .single();
      
      if (hotspotError) throw hotspotError;
      
      // 4. Crear panorama_photo asociada
      const { error: panoramaError } = await supabase
        .from('panorama_photos')
        .insert({
          hotspot_id: hotspot.id,
          photo_url: publicUrl,
          display_order: 0,
          description: `Foto panorámica de ${params.name}`
        });
      
      if (panoramaError) throw panoramaError;
      
      return hotspot;
    } finally {
      setIsCreating(false);
    }
  };
  
  return {
    createHotspot,
    isCreating
  };
};
