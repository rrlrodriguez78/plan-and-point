import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { ViewerHeader } from '@/components/viewer/ViewerHeader';
import ViewerControls from '@/components/viewer/ViewerControls';
import { ViewerCanvas } from '@/components/viewer/ViewerCanvas';
import { HotspotPoint } from '@/components/viewer/HotspotPoint';
import { HotspotModal } from '@/components/viewer/HotspotModal';
import PanoramaViewer from '@/components/viewer/PanoramaViewer';

interface Tour {
  title: string;
  description: string;
}

interface FloorPlan {
  id: string;
  name: string;
  image_url: string;
}

interface Hotspot {
  id: string;
  title: string;
  description?: string;
  x_position: number;
  y_position: number;
  media_url?: string;
  has_panorama?: boolean;
  panorama_count?: number;
  style?: {
    icon?: string;
    color?: string;
    size?: number;
  };
}

interface PanoramaPhoto {
  id: string;
  hotspot_id: string;
  photo_url: string;
  description?: string;
  display_order: number;
}

const Viewer = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const [tour, setTour] = useState<Tour | null>(null);
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [currentFloorPlanId, setCurrentFloorPlanId] = useState<string | null>(null);
  const [hotspotsByFloor, setHotspotsByFloor] = useState<Record<string, Hotspot[]>>({});
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panoramaPhotos, setPanoramaPhotos] = useState<PanoramaPhoto[]>([]);
  const [showPanoramaViewer, setShowPanoramaViewer] = useState(false);
  const [activePanoramaPhoto, setActivePanoramaPhoto] = useState<PanoramaPhoto | null>(null);

  useEffect(() => {
    loadTourData();
  }, [id]);

  const loadTourData = async () => {
    try {
      // Validar que id existe y es un UUID válido
      if (!id || id === ':id' || !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.error('❌ ID de tour inválido:', id);
        setLoading(false);
        return;
      }

      const { data: tourData, error: tourError } = await supabase
        .from('virtual_tours')
        .select('title, description')
        .eq('id', id)
        .eq('is_published', true)
        .maybeSingle();

      if (tourError) {
        console.error('Error al cargar tour:', tourError);
        throw tourError;
      }

      if (!tourData) {
        console.warn('⚠️ No se encontró el tour con ID:', id);
        setLoading(false);
        return;
      }

      setTour(tourData);

      const { data: plansData } = await supabase
        .from('floor_plans')
        .select('id, name, image_url')
        .eq('tour_id', id)
        .order('created_at', { ascending: true });

      if (plansData && plansData.length > 0) {
        setFloorPlans(plansData);
        setCurrentFloorPlanId(plansData[0].id);

        // Load hotspots for all floor plans
        const hotspotsMap: Record<string, Hotspot[]> = {};
        for (const plan of plansData) {
          const { data: hotspotsData } = await supabase
            .from('hotspots')
            .select('id, title, description, x_position, y_position, media_url, has_panorama, panorama_count')
            .eq('floor_plan_id', plan.id);

          if (hotspotsData) {
            hotspotsMap[plan.id] = hotspotsData.map(h => ({
              id: h.id,
              title: h.title,
              description: h.description,
              x_position: h.x_position,
              y_position: h.y_position,
              media_url: h.media_url,
              has_panorama: h.has_panorama ?? false,
              panorama_count: h.panorama_count ?? 0,
            } as Hotspot));
          }
        }
        setHotspotsByFloor(hotspotsMap);
      }
    } catch (error) {
      console.error('Error loading tour:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const loadPanoramaPhotos = async (hotspotId: string) => {
    try {
      const { data, error } = await supabase
        .from('panorama_photos')
        .select('id, hotspot_id, photo_url, description, display_order, capture_date')
        .eq('hotspot_id', hotspotId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading panorama photos:', error);
      return [];
    }
  };

  const handleHotspotClick = async (hotspot: Hotspot) => {
    setSelectedHotspot(hotspot);
    
    if (hotspot.has_panorama && hotspot.panorama_count && hotspot.panorama_count > 0) {
      const photos = await loadPanoramaPhotos(hotspot.id);
      if (photos.length > 0) {
        setPanoramaPhotos(photos);
        setActivePanoramaPhoto(photos[0]);
        setShowPanoramaViewer(true);
      } else {
        // If has_panorama is true but no photos found, show regular modal
        setShowPanoramaViewer(false);
      }
    } else {
      setShowPanoramaViewer(false);
    }
  };

  const currentFloorPlan = floorPlans.find(fp => fp.id === currentFloorPlanId);
  const currentHotspots = currentFloorPlan ? hotspotsByFloor[currentFloorPlan.id] || [] : [];

  const handleNextHotspot = useCallback(() => {
    if (!selectedHotspot) return;
    const currentIdx = currentHotspots.findIndex(h => h.id === selectedHotspot.id);
    if (currentIdx < currentHotspots.length - 1) {
      setSelectedHotspot(currentHotspots[currentIdx + 1]);
    }
  }, [selectedHotspot, currentHotspots]);

  const handlePreviousHotspot = useCallback(() => {
    if (!selectedHotspot) return;
    const currentIdx = currentHotspots.findIndex(h => h.id === selectedHotspot.id);
    if (currentIdx > 0) {
      setSelectedHotspot(currentHotspots[currentIdx - 1]);
    }
  }, [selectedHotspot, currentHotspots]);

  const hotspotCounts = Object.keys(hotspotsByFloor).reduce((acc, floorId) => {
    acc[floorId] = hotspotsByFloor[floorId].length;
    return acc;
  }, {} as Record<string, number>);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedHotspot) {
        setSelectedHotspot(null);
      }
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
      if (e.key === 'ArrowRight' && selectedHotspot) {
        handleNextHotspot();
      }
      if (e.key === 'ArrowLeft' && selectedHotspot) {
        handlePreviousHotspot();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedHotspot, toggleFullscreen, handleNextHotspot, handlePreviousHotspot]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t('viewer.loadingTour')}</p>
      </div>
    );
  }

  if (!tour || floorPlans.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-12 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">{t('viewer.tourNotFound')}</h1>
          <p className="text-muted-foreground">
            {t('viewer.tourNotFoundDesc')}
          </p>
        </Card>
      </div>
    );
  }

  const selectedHotspotIndex = selectedHotspot 
    ? currentHotspots.findIndex(h => h.id === selectedHotspot.id)
    : -1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <ViewerHeader 
        tourTitle={tour.title}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* Canvas */}
      <div className="flex-1 relative">
        <ViewerCanvas
          imageUrl={currentFloorPlan.image_url}
          hotspots={currentHotspots}
          onHotspotClick={handleHotspotClick}
          renderHotspot={(hotspot, index) => (
            <HotspotPoint
              key={hotspot.id}
              index={index}
              title={hotspot.title}
              x={hotspot.x_position}
              y={hotspot.y_position}
              onClick={() => handleHotspotClick(hotspot)}
              hasPanorama={hotspot.has_panorama}
            />
          )}
        />
      </div>

      {/* Hotspot Modal (for regular hotspots) */}
      {!showPanoramaViewer && (
        <HotspotModal
          hotspot={selectedHotspot}
          onClose={() => setSelectedHotspot(null)}
          onNext={selectedHotspotIndex < currentHotspots.length - 1 ? handleNextHotspot : undefined}
          onPrevious={selectedHotspotIndex > 0 ? handlePreviousHotspot : undefined}
          currentIndex={selectedHotspotIndex}
          totalCount={currentHotspots.length}
        />
      )}

      {/* Panorama Viewer (for 360° photos) */}
      <PanoramaViewer
        isVisible={showPanoramaViewer}
        onClose={() => {
          setShowPanoramaViewer(false);
          setSelectedHotspot(null);
        }}
        photos={panoramaPhotos}
        activePhoto={activePanoramaPhoto}
        setActivePhoto={setActivePanoramaPhoto}
        hotspotName={selectedHotspot?.title || ''}
        allHotspotsOnFloor={currentHotspots}
        onNavigate={async (hotspot) => {
          // Navegar a otro hotspot sin salir del visor de panoramas
          setSelectedHotspot(hotspot);
          const photos = await loadPanoramaPhotos(hotspot.id);
          if (photos.length > 0) {
            setPanoramaPhotos(photos);
            setActivePanoramaPhoto(photos[0]);
          }
        }}
      />

      {/* Floor Controls */}
      <ViewerControls
        floorPlans={floorPlans}
        activeFloorPlanId={currentFloorPlanId}
        onFloorPlanChange={setCurrentFloorPlanId}
      />
    </div>
  );
};

export default Viewer;