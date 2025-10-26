import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createImageVersions } from '@/utils/imageOptimization';

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

      // 4. Subir todas las fotos de este hotspot con optimización
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
        const baseFileName = `panoramas/${hotspot.id}/${timestamp}_${safeFileName}`;
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
            hotspot_id: hotspot.id,
            photo_url: originalUrl,
            photo_url_mobile: mobileUrl,
            photo_url_thumbnail: thumbUrl,
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
