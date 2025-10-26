import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CreateHotspotParams {
  name: string;
  photos: Array<{
    file: File;
    captureDate: string | null;
  }>;
  position: { x: number; y: number };
  displayOrder: number;
}

export const useBulkHotspotCreation = (floorPlanId: string, tourId: string) => {
  const [isCreating, setIsCreating] = useState(false);

  const createHotspot = async (params: CreateHotspotParams) => {
    setIsCreating(true);
    
    try {
      // 1. Crear el hotspot primero
      const { data: hotspot, error: hotspotError } = await supabase
        .from('hotspots')
        .insert({
          floor_plan_id: floorPlanId,
          title: params.name,
          x_position: params.position.x,
          y_position: params.position.y,
          display_order: params.displayOrder,
          has_panorama: params.photos.length > 0,
          panorama_count: params.photos.length
        })
        .select()
        .single();
      
      if (hotspotError) throw hotspotError;

      // 2. Ordenar fotos por fecha antes de subir
      const sortedPhotos = [...params.photos].sort((a, b) => {
        if (!a.captureDate) return 1;
        if (!b.captureDate) return -1;
        return a.captureDate.localeCompare(b.captureDate);
      });

      // 3. Subir todas las fotos de este hotspot
      for (let i = 0; i < sortedPhotos.length; i++) {
        const photoData = sortedPhotos[i];
        const fileName = `${tourId}/${floorPlanId}/${params.name}-${i}-${Date.now()}.jpg`;

        // Subir foto
        const { error: uploadError } = await supabase.storage
          .from('tour-images')
          .upload(fileName, photoData.file, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Obtener URL pública
        const {
          data: { publicUrl },
        } = supabase.storage.from('tour-images').getPublicUrl(fileName);

        // Crear panorama_photo
        const finalCaptureDate = photoData.captureDate || new Date().toISOString().split('T')[0];
        
        const { error: panoramaError } = await supabase
          .from('panorama_photos')
          .insert({
            hotspot_id: hotspot.id,
            photo_url: publicUrl,
            display_order: i,
            original_filename: photoData.file.name,
            capture_date: finalCaptureDate,
            description: `Foto panorámica de ${params.name}`,
          });

        if (panoramaError) throw panoramaError;
      }
      
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
