import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ViewerHeader } from '@/components/viewer/ViewerHeader';
import ViewerControls from '@/components/viewer/ViewerControls';
import { ViewerCanvas } from '@/components/viewer/ViewerCanvas';
import { HotspotPoint } from '@/components/viewer/HotspotPoint';
import { HotspotModal } from '@/components/viewer/HotspotModal';
import PanoramaViewer from '@/components/viewer/PanoramaViewer';
import { OrientationWarning } from '@/components/viewer/OrientationWarning';
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation';
import { Tour, FloorPlan, Hotspot, PanoramaPhoto } from '@/types/tour';
import { TourPasswordPrompt } from '@/components/viewer/TourPasswordPrompt';

const Viewer = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { shouldShowOrientationWarning, lockLandscape, isMobile, isStandalone, isLandscape } = useDeviceOrientation();
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
  const [userDismissedWarning, setUserDismissedWarning] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [passwordUpdatedAt, setPasswordUpdatedAt] = useState<string | null>(null);

  // Auto-dismiss warning cuando el usuario rota manualmente a landscape
  useEffect(() => {
    if (isLandscape && !userDismissedWarning && isMobile) {
      console.log('✅ Usuario rotó manualmente a landscape, ocultando warning');
      setUserDismissedWarning(true);
    }
  }, [isLandscape, userDismissedWarning, isMobile]);

  // Handler mejorado para forzar landscape con mejor detección de errores
  const handleForceLandscape = async () => {
    console.log('🔄 Forzando landscape con estrategia Fullscreen First...');
    
    try {
      // PASO 1: Intentar entrar a fullscreen primero
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        console.log('✅ Fullscreen activado');
        
        // Esperar a que fullscreen se active completamente
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      // PASO 2: Intentar lockear la orientación
      const success = await lockLandscape();
      
      if (success) {
        console.log('✅ Landscape bloqueado exitosamente');
        setUserDismissedWarning(true);
        toast.success(t('viewer.landscapeLocked', '¡Orientación horizontal activada!'));
      } else {
        console.log('⚠️ No se pudo lockear la orientación');
        
        // Detectar si auto-rotate está deshabilitado
        const initialAngle = screen.orientation?.angle || 0;
        await new Promise(resolve => setTimeout(resolve, 500));
        const currentAngle = screen.orientation?.angle || 0;
        
        if (initialAngle === currentAngle && initialAngle === 0) {
          // Auto-rotate probablemente deshabilitado
          toast.error(
            t('viewer.enableAutoRotate', 'Habilita la rotación automática en los ajustes de tu dispositivo'),
            { duration: 5000 }
          );
        } else {
          // Otro tipo de error
          toast.error(
            t('viewer.rotateManually', 'Por favor rota tu dispositivo manualmente a posición horizontal'),
            { duration: 4000 }
          );
        }
      }
    } catch (error) {
      console.error('❌ Error en handleForceLandscape:', error);
      
      if (error instanceof Error) {
        if (error.name === 'NotSupportedError') {
          toast.error(t('viewer.rotationNotSupported', 'Tu navegador no soporta bloqueo de orientación'));
        } else if (error.name === 'SecurityError') {
          toast.error(t('viewer.installPwaForRotation', 'Instala la app completa para usar esta función'));
        } else {
          toast.error(t('viewer.rotationError', 'Error al intentar forzar la rotación'));
        }
      }
    }
  };

  // Intentar rotación automática al entrar (solo móviles) - CON RETRASO
  useEffect(() => {
    const tryAutoRotate = async () => {
      if (isMobile && !userDismissedWarning && isStandalone) {
        console.log('🚀 Iniciando intento de rotación automática...');
        
        // Esperar 500ms para asegurar que el DOM esté listo
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
          const success = await lockLandscape();
          if (success) {
            console.log('✅ Rotación automática exitosa');
          } else {
            console.log('⚠️ Rotación automática falló, mostrando warning');
          }
        } catch (error) {
          console.log('❌ Error en rotación automática:', error);
        }
      }
    };
    tryAutoRotate();
  }, [isMobile, isStandalone, userDismissedWarning, lockLandscape]);

  useEffect(() => {
    loadTourData();
  }, [id]);

  // Track tour view for analytics
  useEffect(() => {
    if (!tour || !id) return;

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    // Record initial view
    const recordView = async () => {
      try {
        await supabase.from('tour_views').insert({
          tour_id: id,
          viewer_id: user?.id || null,
          session_id: sessionId,
          ip_address: null, // Could be added via edge function if needed
          user_agent: navigator.userAgent
        });
      } catch (error) {
        console.error('Error recording tour view:', error);
      }
    };

    recordView();

    // Record duration when user leaves
    const handleBeforeUnload = async () => {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      
      // Use sendBeacon for reliable tracking on page unload
      const data = {
        tour_id: id,
        viewer_id: user?.id || null,
        session_id: sessionId,
        duration_seconds: duration,
        user_agent: navigator.userAgent
      };

      // Try to update the existing view record
      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/tour_views?session_id=eq.${sessionId}`,
        JSON.stringify(data)
      );
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also record duration when component unmounts
      const duration = Math.floor((Date.now() - startTime) / 1000);
      supabase.from('tour_views')
        .update({ duration_seconds: duration })
        .eq('session_id', sessionId)
        .then(() => {});
    };
  }, [tour, id, user]);

  const loadTourData = async () => {
    try {
      // Validar que id existe y es un UUID válido
      if (!id || id === ':id' || !id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        console.error('❌ ID de tour inválido:', id);
        setLoading(false);
        return;
      }

      // 1. Cargar tour básico (accesible públicamente si está publicado)
      const { data: tourData, error: tourError } = await supabase
        .from('virtual_tours')
        .select(`
          title, 
          description, 
          is_published,
          organization_id,
          password_protected,
          password_updated_at
        `)
        .eq('id', id)
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

      // 2. Verificar ownership solo si el usuario está autenticado
      let isOwner = false;
      if (user) {
        const { data: orgData } = await supabase
          .from('organizations')
          .select('owner_id')
          .eq('id', tourData.organization_id)
          .single();
        
        isOwner = orgData?.owner_id === user.id;
      }
      
      // 3. Si el tour no está publicado, solo el dueño puede verlo
      if (!tourData.is_published && !isOwner) {
        console.warn('⚠️ Usuario no autorizado para ver este tour');
        setLoading(false);
        return;
      }

      // Si el tour está protegido con contraseña y el usuario NO es el dueño
      if (tourData.password_protected && !isOwner) {
        // Verificar si hay un token válido en localStorage
        const storedToken = localStorage.getItem(`tour_access_${id}`);
        
        if (storedToken) {
          try {
            const tokenData = JSON.parse(storedToken);
            // Verificar si el token es para este tour y si la contraseña no ha cambiado
            if (tokenData.tour_id === id && tokenData.password_updated_at === tourData.password_updated_at) {
              // Token válido, continuar con la carga
              console.log('✅ Token de acceso válido');
            } else {
              // Token inválido o contraseña cambiada, solicitar nueva contraseña
              console.log('⚠️ Token inválido o contraseña cambiada');
              setPasswordProtected(true);
              setPasswordUpdatedAt(tourData.password_updated_at);
              setShowPasswordPrompt(true);
              setTour({ title: tourData.title, description: tourData.description });
              setLoading(false);
              return;
            }
          } catch (error) {
            console.error('Error parsing token:', error);
            setPasswordProtected(true);
            setPasswordUpdatedAt(tourData.password_updated_at);
            setShowPasswordPrompt(true);
            setTour({ title: tourData.title, description: tourData.description });
            setLoading(false);
            return;
          }
        } else {
          // No hay token, solicitar contraseña
          console.log('🔒 Tour protegido con contraseña, solicitando acceso');
          setPasswordProtected(true);
          setPasswordUpdatedAt(tourData.password_updated_at);
          setShowPasswordPrompt(true);
          setTour({ title: tourData.title, description: tourData.description });
          setLoading(false);
          return;
        }
      }

      setTour({ title: tourData.title, description: tourData.description });

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
    } else {
      document.exitFullscreen();
    }
    // El estado se actualizará automáticamente por el listener
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

  // Sincronizar estado de fullscreen automáticamente
  useEffect(() => {
    const handleFullscreenChange = () => {
      const newFullscreenState = !!document.fullscreenElement;
      setIsFullscreen(newFullscreenState);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

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

  // Handler para reintentar rotación
  const handleTryRotate = async () => {
    const success = await lockLandscape();
    if (success) {
      setUserDismissedWarning(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground text-lg">{t('viewer.loadingTour')}</p>
        </div>
      </div>
    );
  }

  if (!tour || (floorPlans.length === 0 && !showPasswordPrompt)) {
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
      {/* Orientation Warning - ACTUALIZADO con onForceLandscape */}
      {shouldShowOrientationWarning && !userDismissedWarning && (
        <OrientationWarning 
          onContinue={() => setUserDismissedWarning(true)}
          onTryRotate={handleTryRotate}
          onForceLandscape={handleForceLandscape} // ← NUEVO PROP
          isStandalone={isStandalone}
        />
      )}
      
      {/* Header */}
      <ViewerHeader
        tourTitle={tour.title}
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* Solo renderizar el contenido del viewer si NO estamos mostrando password prompt */}
      {!showPasswordPrompt && currentFloorPlan && (
        <>
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
                  onClick={(e) => handleHotspotClick(hotspot, e)}
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
              onNext={handleNextHotspot}
              onPrevious={handlePreviousHotspot}
              currentIndex={selectedHotspotIndex}
              totalCount={currentHotspots.length}
              availableHotspots={currentHotspots}
              onHotspotSelect={(hotspot) => {
                const fullHotspot = currentHotspots.find(h => h.id === hotspot.id);
                if (fullHotspot) {
                  setSelectedHotspot(null);
                  setTimeout(() => handleHotspotClick(fullHotspot), 100);
                }
              }}
              floorPlans={floorPlans}
              currentFloorPlan={currentFloorPlan}
              onFloorChange={setCurrentFloorPlanId}
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
              // Guardar la fecha actual ANTES de cambiar de hotspot
              const currentDate = activePanoramaPhoto?.capture_date;
              
              // Cargar fotos del nuevo hotspot ANTES de cambiar el estado
              const photos = await loadPanoramaPhotos(hotspot.id);
              
              if (photos.length === 0) {
                // Si no hay fotos en absoluto, mostrar error y NO cambiar hotspot
                toast.error(t('viewer.noPhotosAvailable'), {
                  description: t('viewer.noPhotosDescription', { name: hotspot.title }),
                });
                return; // Quedarse en el hotspot actual
              }
              
              // Verificar si hay foto para la fecha actual
              if (currentDate) {
                const photoWithSameDate = photos.find(p => p.capture_date === currentDate);
                if (!photoWithSameDate) {
                  // Si no hay foto para la fecha actual, mostrar error y NO cambiar hotspot
                  const formatDate = (dateString: string) => {
                    try {
                      return new Date(dateString).toLocaleDateString(i18n.language, { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      });
                    } catch {
                      return dateString;
                    }
                  };
                  
                  toast.error(t('viewer.noPhotoForDate'), {
                    description: t('viewer.noPhotoForDateDescription', { date: formatDate(currentDate) }),
                  });
                  return; // Quedarse en el hotspot actual
                }
              }
              
              // Si llegamos aquí, hay fotos disponibles para la fecha actual
              setSelectedHotspot(hotspot);
              setPanoramaPhotos(photos);
              
              // Intentar mantener la misma fecha
              let photoToShow = photos[0]; // Fallback: primera foto
              
              if (currentDate) {
                const photoWithSameDate = photos.find(p => p.capture_date === currentDate);
                if (photoWithSameDate) {
                  photoToShow = photoWithSameDate;
                }
              }
              
              setActivePanoramaPhoto(photoToShow);
            }}
            floorPlans={floorPlans}
            currentFloorPlan={currentFloorPlan}
            onFloorChange={(floorPlanId) => {
              setCurrentFloorPlanId(floorPlanId);
              setShowPanoramaViewer(false);
              setSelectedHotspot(null);
            }}
            hotspotsByFloor={hotspotsByFloor}
          />

          {/* Floor Controls */}
          <ViewerControls
            floorPlans={floorPlans}
            activeFloorPlanId={currentFloorPlanId}
            onFloorPlanChange={setCurrentFloorPlanId}
          />
        </>
      )}

      {/* Password Prompt for Protected Tours */}
      {showPasswordPrompt && tour && (
        <TourPasswordPrompt
          open={showPasswordPrompt}
          tourId={id!}
          tourTitle={tour.title}
          onSuccess={(passwordUpdatedAt) => {
            setShowPasswordPrompt(false);
            loadTourData();
          }}
        />
      )}
    </div>
  );
};

export default Viewer;