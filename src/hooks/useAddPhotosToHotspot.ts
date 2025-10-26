import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createImageVersions } from '@/utils/imageOptimization';

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

      // 3. Subir y crear registros con optimización
      for (let i = 0; i < sortedPhotos.length; i++) {
        const photoData = sortedPhotos[i];
        const timestamp = Date.now() + i;
        const safeFileName = photoData.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

        // Create optimized versions
        const versions = await createImageVersions(photoData.file, [
          { name: 'original', options: { maxWidth: 4000, quality: 0.85, format: 'webp', maxSizeMB: 10 } },
          { name: 'mobile', options: { maxWidth: 1920, quality: 0.85, format: 'webp', maxSizeMB: 10 } },
          { name: 'thumbnail', options: { maxWidth: 400, quality: 0.8, format: 'webp', maxSizeMB: 10 } }
        ]);

        // Upload all versions
        const baseFileName = `panoramas/${params.hotspotId}/${timestamp}_${safeFileName}`;
        const uploadPromises = [
          supabase.storage.from('tour-images').upload(`${baseFileName}.${versions.original.format}`, versions.original.blob),
          supabase.storage.from('tour-images').upload(`${baseFileName}_mobile.${versions.mobile.format}`, versions.mobile.blob),
          supabase.storage.from('tour-images').upload(`${baseFileName}_thumb.${versions.thumbnail.format}`, versions.thumbnail.blob)
        ];

        const uploadResults = await Promise.all(uploadPromises);
        
        if (uploadResults.some(r => r.error)) {
          console.error('Error uploading photo versions');
          continue;
        }

        // Get public URLs
        const { data: { publicUrl: originalUrl } } = supabase.storage
          .from('tour-images')
          .getPublicUrl(uploadResults[0].data!.path);
        const { data: { publicUrl: mobileUrl } } = supabase.storage
          .from('tour-images')
          .getPublicUrl(uploadResults[1].data!.path);
        const { data: { publicUrl: thumbUrl } } = supabase.storage
          .from('tour-images')
          .getPublicUrl(uploadResults[2].data!.path);

        // Crear panorama_photo
        const finalCaptureDate = photoData.captureDate || new Date().toISOString().split('T')[0];
        
        const { error: panoramaError } = await supabase
          .from('panorama_photos')
          .insert({
            hotspot_id: params.hotspotId,
            photo_url: originalUrl,
            photo_url_mobile: mobileUrl,
            photo_url_thumbnail: thumbUrl,
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