import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ViewerHeader } from '@/components/viewer/ViewerHeader';
import { FloorNavigator } from '@/components/viewer/FloorNavigator';
import { ViewerCanvas } from '@/components/viewer/ViewerCanvas';
import { HotspotPoint } from '@/components/viewer/HotspotPoint';
import { HotspotModal } from '@/components/viewer/HotspotModal';

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
  style?: {
    icon?: string;
    color?: string;
    size?: number;
  };
}

const Viewer = () => {
  const { id } = useParams();
  const [tour, setTour] = useState<Tour | null>(null);
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [currentFloorIndex, setCurrentFloorIndex] = useState(0);
  const [hotspotsByFloor, setHotspotsByFloor] = useState<Record<string, Hotspot[]>>({});
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    loadTourData();
  }, [id]);

  const loadTourData = async () => {
    try {
      const { data: tourData } = await supabase
        .from('virtual_tours')
        .select('title, description')
        .eq('id', id)
        .eq('is_published', true)
        .single();

      if (tourData) {
        setTour(tourData);

        const { data: plansData } = await supabase
          .from('floor_plans')
          .select('id, name, image_url')
          .eq('tour_id', id)
          .order('created_at', { ascending: true });

        if (plansData && plansData.length > 0) {
          setFloorPlans(plansData);

          // Load hotspots for all floor plans
          const hotspotsMap: Record<string, Hotspot[]> = {};
          for (const plan of plansData) {
            const { data: hotspotsData } = await supabase
              .from('hotspots')
              .select('*')
              .eq('floor_plan_id', plan.id);

            if (hotspotsData) {
              hotspotsMap[plan.id] = hotspotsData;
            }
          }
          setHotspotsByFloor(hotspotsMap);
        }
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

  const currentFloorPlan = floorPlans[currentFloorIndex];
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
        <p className="text-muted-foreground">Cargando tour...</p>
      </div>
    );
  }

  if (!tour || floorPlans.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-12 text-center max-w-md">
          <h1 className="text-2xl font-bold mb-2">Tour no encontrado</h1>
          <p className="text-muted-foreground">
            Este tour no existe o no está publicado
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

      {/* Floor Navigator */}
      <FloorNavigator
        floorPlans={floorPlans}
        currentFloorIndex={currentFloorIndex}
        onFloorChange={setCurrentFloorIndex}
        hotspotCounts={hotspotCounts}
      />

      {/* Canvas */}
      <div className="flex-1 relative">
        <ViewerCanvas
          imageUrl={currentFloorPlan.image_url}
          hotspots={currentHotspots}
          onHotspotClick={setSelectedHotspot}
          renderHotspot={(hotspot, index) => (
            <HotspotPoint
              key={hotspot.id}
              index={index}
              title={hotspot.title}
              x={hotspot.x_position}
              y={hotspot.y_position}
              onClick={() => setSelectedHotspot(hotspot)}
              style={hotspot.style}
            />
          )}
        />
      </div>

      {/* Hotspot Modal */}
      <HotspotModal
        hotspot={selectedHotspot}
        onClose={() => setSelectedHotspot(null)}
        onNext={selectedHotspotIndex < currentHotspots.length - 1 ? handleNextHotspot : undefined}
        onPrevious={selectedHotspotIndex > 0 ? handlePreviousHotspot : undefined}
        currentIndex={selectedHotspotIndex}
        totalCount={currentHotspots.length}
      />
    </div>
  );
};

export default Viewer;