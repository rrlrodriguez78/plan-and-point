import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AddPhotosParams {
  hotspotId: string;
  photos: Array<{
    file: File;
    captureDate: string | null;
    groupName: string;
  }>;
  tourId: string;
  floorPlanId: string;
  hotspotTitle: string;
}

export const useAddPhotosToHotspot = () => {
  const [isAdding, setIsAdding] = useState(false);

  const addPhotos = async (params: AddPhotosParams) => {
    setIsAdding(true);
    
    try {
      // 1. Obtener el display_order máximo actual
      const { data: existingPhotos } = await supabase
        .from('panorama_photos')
        .select('display_order')
        .eq('hotspot_id', params.hotspotId)
        .order('display_order', { ascending: false })
        .limit(1);
      
      const startOrder = existingPhotos?.[0]?.display_order ?? -1;
      
      // 2. Ordenar fotos por fecha
      const sortedPhotos = [...params.photos].sort((a, b) => {
        if (!a.captureDate) return 1;
        if (!b.captureDate) return -1;
        return a.captureDate.localeCompare(b.captureDate);
      });

      // 3. Subir y crear registros
      for (let i = 0; i < sortedPhotos.length; i++) {
        const photoData = sortedPhotos[i];
        const fileName = `${params.tourId}/${params.floorPlanId}/${params.hotspotTitle}-${Date.now()}-${i}.jpg`;

        // Subir foto
        const { error: uploadError } = await supabase.storage
          .from('tour-images')
          .upload(fileName, photoData.file, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        // Obtener URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('tour-images')
          .getPublicUrl(fileName);

        // Crear panorama_photo
        const finalCaptureDate = photoData.captureDate || new Date().toISOString().split('T')[0];
        
        const { error: panoramaError } = await supabase
          .from('panorama_photos')
          .insert({
            hotspot_id: params.hotspotId,
            photo_url: publicUrl,
            display_order: startOrder + i + 1,
            original_filename: photoData.file.name,
            capture_date: finalCaptureDate,
            description: `${photoData.groupName} - ${params.hotspotTitle}`,
          });

        if (panoramaError) throw panoramaError;
      }
      
      // 4. Actualizar contador de panoramas en el hotspot
      const { data: totalPhotos } = await supabase
        .from('panorama_photos')
        .select('id', { count: 'exact' })
        .eq('hotspot_id', params.hotspotId);
      
      await supabase
        .from('hotspots')
        .update({
          has_panorama: true,
          panorama_count: totalPhotos?.length || 0
        })
        .eq('id', params.hotspotId);
      
      return { success: true, photosAdded: sortedPhotos.length };
    } catch (error) {
      console.error('Error adding photos:', error);
      throw error;
    } finally {
      setIsAdding(false);
    }
  };
  
  return {
    addPhotos,
    isAdding
  };
};