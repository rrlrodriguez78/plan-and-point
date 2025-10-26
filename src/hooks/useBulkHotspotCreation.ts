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
      // 1. Check if hotspot already exists
      const { data: existing, error: checkError } = await supabase
        .from('hotspots')
        .select('id, panorama_count')
        .eq('floor_plan_id', floorPlanId)
        .eq('title', params.name)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      let hotspot;
      
      if (existing) {
        // Hotspot exists, we'll add photos to it
        hotspot = existing;
      } else {
        // Create new hotspot
        const { data: newHotspot, error: hotspotError } = await supabase
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
        hotspot = newHotspot;
      }

      // 2. Ordenar fotos por fecha antes de subir
      const sortedPhotos = [...params.photos].sort((a, b) => {
        if (!a.captureDate) return 1;
        if (!b.captureDate) return -1;
        return a.captureDate.localeCompare(b.captureDate);
      });

      // 3. Get current photo count for proper ordering
      const startOrder = existing ? existing.panorama_count : 0;

      // 4. Subir todas las fotos de este hotspot
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
            display_order: startOrder + i,
            original_filename: photoData.file.name,
            capture_date: finalCaptureDate,
            description: `Panoramic photo of ${params.name}`,
          });

        if (panoramaError) throw panoramaError;
      }
      
      // 5. Update hotspot panorama count
      const { error: updateError } = await supabase
        .from('hotspots')
        .update({
          panorama_count: startOrder + sortedPhotos.length,
          has_panorama: true
        })
        .eq('id', hotspot.id);
      
      if (updateError) throw updateError;
      
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
