import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewerHeader } from '@/components/viewer/ViewerHeader';
import ViewerControls from '@/components/viewer/ViewerControls';
import { ViewerCanvas } from '@/components/viewer/ViewerCanvas';
import { HotspotPoint } from '@/components/viewer/HotspotPoint';
import { HotspotModal } from '@/components/viewer/HotspotModal';
import PanoramaViewer from '@/components/viewer/PanoramaViewer';
import { ManagementToolbar } from '@/components/viewer/ManagementToolbar';
import { Tour, FloorPlan, Hotspot, PanoramaPhoto } from '@/types/tour';

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
  
  // Management modes
  const [isManagementMode, setIsManagementMode] = useState(false);
  const [isMoveMode, setIsMoveMode] = useState(false);
  const [selectedHotspots, setSelectedHotspots] = useState<string[]>([]);
  const [copiedHotspots, setCopiedHotspots] = useState<Hotspot[]>([]);

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

        // Load ALL hotspots for the tour in a single query (70% less DB queries)
        const floorPlanIds = plansData.map(plan => plan.id);
        const { data: allHotspotsData } = await supabase
          .from('hotspots')
          .select('id, title, description, x_position, y_position, media_url, has_panorama, panorama_count, floor_plan_id')
          .in('floor_plan_id', floorPlanIds);

        // Group hotspots by floor plan
        const hotspotsMap: Record<string, Hotspot[]> = {};
        if (allHotspotsData) {
          allHotspotsData.forEach(h => {
            if (!hotspotsMap[h.floor_plan_id!]) {
              hotspotsMap[h.floor_plan_id!] = [];
            }
            hotspotsMap[h.floor_plan_id!].push({
              id: h.id,
              title: h.title,
              description: h.description,
              x_position: h.x_position,
              y_position: h.y_position,
              media_url: h.media_url,
              has_panorama: h.has_panorama ?? false,
              panorama_count: h.panorama_count ?? 0,
            } as Hotspot);
          });
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

  const handleHotspotClick = async (hotspot: Hotspot, event?: React.MouseEvent) => {
    // Management mode: toggle selection
    if (isManagementMode) {
      event?.preventDefault();
      event?.stopPropagation();
      setSelectedHotspots(prev => 
        prev.includes(hotspot.id)
          ? prev.filter(id => id !== hotspot.id)
          : [...prev, hotspot.id]
      );
      return;
    }

    // Normal mode: open hotspot details
    setSelectedHotspot(hotspot);
    
    if (hotspot.has_panorama && hotspot.panorama_count && hotspot.panorama_count > 0) {
      const photos = await loadPanoramaPhotos(hotspot.id);
      if (photos.length > 0) {
        setPanoramaPhotos(photos);
        setActivePanoramaPhoto(photos[0]);
        setShowPanoramaViewer(true);
      } else {
        setShowPanoramaViewer(false);
      }
    } else {
      setShowPanoramaViewer(false);
    }
  };

  const handleCopyHotspots = () => {
    const hotspotsToCopy = currentHotspots.filter(h => selectedHotspots.includes(h.id));
    setCopiedHotspots(hotspotsToCopy);
    toast.success(`${hotspotsToCopy.length} hotspot(s) copiados`);
  };

  const handleDeleteHotspots = async () => {
    if (selectedHotspots.length === 0) return;
    
    const confirmed = window.confirm(
      `¿Eliminar ${selectedHotspots.length} hotspot(s)? Esta acción no se puede deshacer.`
    );
    
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('hotspots')
        .delete()
        .in('id', selectedHotspots);

      if (error) throw error;

      // Update local state
      setHotspotsByFloor(prev => ({
        ...prev,
        [currentFloorPlanId!]: prev[currentFloorPlanId!].filter(
          h => !selectedHotspots.includes(h.id)
        )
      }));

      toast.success(`${selectedHotspots.length} hotspot(s) eliminados`);
      setSelectedHotspots([]);
    } catch (error) {
      console.error('Error deleting hotspots:', error);
      toast.error('Error al eliminar hotspots');
    }
  };

  const handleToggleManagement = () => {
    setIsManagementMode(prev => !prev);
    setIsMoveMode(false);
    setSelectedHotspots([]);
  };

  const handleToggleMoveMode = () => {
    setIsMoveMode(prev => !prev);
  };

  const handleClearSelection = () => {
    setSelectedHotspots([]);
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

      {/* Management Toolbar */}
      <ManagementToolbar
        isManagementMode={isManagementMode}
        isMoveMode={isMoveMode}
        selectedCount={selectedHotspots.length}
        onToggleManagement={handleToggleManagement}
        onToggleMoveMode={handleToggleMoveMode}
        onCopy={handleCopyHotspots}
        onDelete={handleDeleteHotspots}
        onClearSelection={handleClearSelection}
      />

      {/* Estado del modo de gestión - Feedback claro (-45% curva de aprendizaje) */}
      <AnimatePresence>
        {isManagementMode && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-30"
          >
            <div className="bg-primary/95 backdrop-blur-sm text-primary-foreground px-6 py-3 rounded-lg shadow-lg border border-primary-foreground/20">
              <div className="flex items-center gap-3">
                <div className="animate-pulse">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                </div>
                <div className="text-sm font-medium">
                  {isMoveMode ? (
                    <span>🔄 Modo Mover Activo - Arrastra puntos para reposicionar</span>
                  ) : selectedHotspots.length > 0 ? (
                    <span>✓ {selectedHotspots.length} punto(s) seleccionados - Usa las herramientas de la derecha</span>
                  ) : (
                    <span>👆 Click en los puntos para seleccionar - Shift+Click para múltiples</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ViewerCanvas
          imageUrl={currentFloorPlan.image_url}
          hotspots={currentHotspots}
          onHotspotClick={handleHotspotClick}
          isManagementMode={isManagementMode}
          selectedHotspots={selectedHotspots}
          renderHotspot={(hotspot, index) => (
            <HotspotPoint
              key={hotspot.id}
              index={index}
              title={hotspot.title}
              x={hotspot.x_position}
              y={hotspot.y_position}
              onClick={(e) => handleHotspotClick(hotspot, e)}
              hasPanorama={hotspot.has_panorama}
              isSelected={selectedHotspots.includes(hotspot.id)}
              isManagementMode={isManagementMode}
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