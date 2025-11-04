import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { hybridStorage } from '@/utils/hybridStorage';
import { toast } from 'sonner';
import type { Tour, FloorPlan, Hotspot } from '@/types/tour';

interface DownloadProgress {
  tourId: string;
  tourName: string;
  stage: 'metadata' | 'floorplans' | 'photos' | 'complete';
  progress: number; // 0-100
  currentItem: string;
  totalItems: number;
  currentItemNumber: number;
}

export function useOfflineDownload() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  // Compress image blob
  const compressImage = async (blob: Blob): Promise<Blob> => {
    if (blob.size < 500000) return blob; // Skip compression if < 500KB

    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      img.onload = () => {
        const maxSize = 1920;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (compressedBlob) => {
            resolve(compressedBlob || blob);
          },
          'image/jpeg',
          0.8
        );
      };

      img.src = URL.createObjectURL(blob);
    });
  };

  // Download floor plan image
  const downloadFloorPlanImage = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to download image');
      
      const blob = await response.blob();
      const compressedBlob = await compressImage(blob);
      
      // Convert to base64 for storage
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(compressedBlob);
      });
    } catch (error) {
      console.error('Error downloading image:', error);
      throw error;
    }
  };

  // Download all photos for a hotspot
  const downloadHotspotPhotos = async (hotspotId: string): Promise<string[]> => {
    try {
      const { data: photos, error } = await supabase
        .from('hotspot_photos' as any)
        .select('*')
        .eq('hotspot_id', hotspotId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      if (!photos || photos.length === 0) return [];

      const downloadedPhotos: string[] = [];

      for (const photo of photos as any[]) {
        if (photo.photo_url) {
          const base64Image = await downloadFloorPlanImage(photo.photo_url);
          downloadedPhotos.push(base64Image);
        }
      }

      return downloadedPhotos;
    } catch (error) {
      console.error('Error downloading hotspot photos:', error);
      return [];
    }
  };

  // Main download function
  const downloadTourForOffline = useCallback(async (tourId: string, tourName: string) => {
    setIsDownloading(true);
    setDownloadProgress({
      tourId,
      tourName,
      stage: 'metadata',
      progress: 0,
      currentItem: 'Cargando información del tour...',
      totalItems: 1,
      currentItemNumber: 0
    });

    try {
      // 1. Download tour metadata
      const { data: tour, error: tourError } = await supabase
        .from('virtual_tours')
        .select('*')
        .eq('id', tourId)
        .single();

      if (tourError) throw tourError;

      setDownloadProgress(prev => prev ? {
        ...prev,
        progress: 10,
        stage: 'floorplans',
        currentItem: 'Descargando planos...'
      } : null);

      // 2. Download floor plans
      const { data: floorPlans, error: plansError } = await supabase
        .from('floor_plans')
        .select('*')
        .eq('tour_id', tourId)
        .order('created_at', { ascending: true });

      if (plansError) throw plansError;

      const totalFloorPlans = floorPlans?.length || 0;
      const floorPlansWithImages: any[] = [];

      for (let i = 0; i < totalFloorPlans; i++) {
        const plan = floorPlans![i];
        
        setDownloadProgress(prev => prev ? {
          ...prev,
          progress: 10 + (30 * (i / totalFloorPlans)),
          currentItem: `Descargando plano: ${plan.name}`,
          totalItems: totalFloorPlans,
          currentItemNumber: i + 1
        } : null);

        let imageData = plan.image_url;
        if (plan.image_url) {
          imageData = await downloadFloorPlanImage(plan.image_url);
        }

        floorPlansWithImages.push({
          ...plan,
          image_data: imageData
        });
      }

      setDownloadProgress(prev => prev ? {
        ...prev,
        progress: 40,
        stage: 'photos',
        currentItem: 'Descargando puntos de navegación...'
      } : null);

      // 3. Download hotspots
      const { data: hotspots, error: hotspotsError } = await supabase
        .from('hotspots')
        .select('*')
        .in('floor_plan_id', floorPlansWithImages.map(p => p.id))
        .order('created_at', { ascending: true });

      if (hotspotsError) throw hotspotsError;

      const totalHotspots = hotspots?.length || 0;
      const hotspotsWithPhotos: any[] = [];

      for (let i = 0; i < totalHotspots; i++) {
        const hotspot = hotspots![i];
        
        setDownloadProgress(prev => prev ? {
          ...prev,
          progress: 40 + (50 * (i / totalHotspots)),
          currentItem: `Descargando fotos: ${hotspot.title}`,
          totalItems: totalHotspots,
          currentItemNumber: i + 1
        } : null);

        const photos = await downloadHotspotPhotos(hotspot.id);

        hotspotsWithPhotos.push({
          ...hotspot,
          photos
        });
      }

      setDownloadProgress(prev => prev ? {
        ...prev,
        progress: 95,
        currentItem: 'Guardando en almacenamiento local...'
      } : null);

      // 4. Save to hybrid storage
      await hybridStorage.saveTour(
        tourId,
        tourName,
        tour as Tour,
        floorPlansWithImages,
        hotspotsWithPhotos,
        []
      );

      setDownloadProgress(prev => prev ? {
        ...prev,
        progress: 100,
        stage: 'complete',
        currentItem: '¡Descarga completa!'
      } : null);

      toast.success(`✅ "${tourName}" descargado para uso offline`);

      // Reset after 2 seconds
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(null);
      }, 2000);

    } catch (error) {
      console.error('Error downloading tour:', error);
      toast.error('Error al descargar tour para offline');
      setIsDownloading(false);
      setDownloadProgress(null);
      throw error;
    }
  }, []);

  // Check if tour is already downloaded
  const isTourDownloaded = useCallback(async (tourId: string): Promise<boolean> => {
    try {
      const cached = await hybridStorage.loadTour(tourId);
      return !!cached;
    } catch {
      return false;
    }
  }, []);

  // Delete downloaded tour
  const deleteTourOffline = useCallback(async (tourId: string, tourName: string) => {
    try {
      await hybridStorage.deleteTour(tourId);
      toast.success(`"${tourName}" eliminado del almacenamiento offline`);
    } catch (error) {
      console.error('Error deleting tour:', error);
      toast.error('Error al eliminar tour offline');
      throw error;
    }
  }, []);

  return {
    isDownloading,
    downloadProgress,
    downloadTourForOffline,
    isTourDownloaded,
    deleteTourOffline
  };
}
