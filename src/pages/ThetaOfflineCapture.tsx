import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff, Camera, CheckCircle2, Loader2, Battery, RefreshCw, MapPin, Map, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useThetaCamera } from '@/hooks/useThetaCamera';
import { offlineStorage } from '@/utils/offlineStorage';
import { SyncStatusIndicator } from '@/components/shared/SyncStatusIndicator';
import { OfflineQuickGuide } from '@/components/shared/OfflineQuickGuide';
import { OfflineTutorialDialog } from '@/components/shared/OfflineTutorialDialog';
import { useIntelligentSync } from '@/hooks/useIntelligentSync';
import { useThetaWiFiDetector } from '@/hooks/useThetaWiFiDetector';
import { hybridStorage } from '@/utils/hybridStorage';
import type { Tour, FloorPlan, Hotspot } from '@/types/tour';
import { toast } from 'sonner';

export default function ThetaOfflineCapture() {
  const {
    isConnected,
    isConnecting,
    isCapturing,
    batteryLevel,
    error: cameraError,
    connect,
    disconnect,
    capturePhoto,
  } = useThetaCamera();

  const { 
    isOnline, 
    isSyncing: syncInProgress,
    syncProgress,
    currentOperation,
    pendingPhotosCount: pendingCount,
    syncPhotos: syncNow, 
    refreshCounts: refreshCount 
  } = useIntelligentSync({ autoSync: true });

  const { isThetaWiFi, hasRealInternet, currentSSID } = useThetaWiFiDetector();
  
  const [captureCount, setCaptureCount] = useState(0);
  const [lastPhotoPreview, setLastPhotoPreview] = useState<string | null>(null);
  
  // Tour offline selection
  const [cachedTours, setCachedTours] = useState<Array<{ tour: Tour; floorPlans: FloorPlan[]; hotspots: Hotspot[] }>>([]);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [selectedFloorPlan, setSelectedFloorPlan] = useState<FloorPlan | null>(null);
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [availableHotspots, setAvailableHotspots] = useState<Hotspot[]>([]);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // Load cached tours on mount
  useEffect(() => {
    const loadCachedTours = async () => {
      try {
        const toursList = await hybridStorage.listTours();
        
        // Load full tour data for each
        const toursData = await Promise.all(
          toursList.map(async (t) => {
            const fullTour = await hybridStorage.loadTour(t.id);
            if (!fullTour) return null;
            return {
              tour: fullTour.data,
              floorPlans: fullTour.floorPlans,
              hotspots: fullTour.hotspots
            };
          })
        );
        
        const validTours = toursData.filter((t): t is NonNullable<typeof t> => t !== null);
        setCachedTours(validTours);
        
        if (validTours.length > 0) {
          setSelectedTour(validTours[0].tour);
          if (validTours[0].floorPlans.length > 0) {
            setSelectedFloorPlan(validTours[0].floorPlans[0]);
          }
        }
      } catch (error) {
        console.error('Error loading cached tours:', error);
        toast.error('Error al cargar tours en caché');
      }
    };
    
    loadCachedTours();
  }, []);
  
  // Update available hotspots when floor plan changes
  useEffect(() => {
    if (selectedFloorPlan) {
      const selectedTourData = cachedTours.find(t => t.tour.id === selectedTour?.id);
      if (selectedTourData) {
        const hotspots = selectedTourData.hotspots.filter(
          h => h.floor_plan_id === selectedFloorPlan.id
        );
        setAvailableHotspots(hotspots);
        if (hotspots.length > 0) {
          setSelectedHotspot(hotspots[0]);
        } else {
          setSelectedHotspot(null);
        }
      }
    }
  }, [selectedFloorPlan, cachedTours, selectedTour]);

  // Actualizar contador de fotos capturadas
  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  // Detectar cuando vuelve internet y preguntar si sincronizar
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncInProgress) {
      toast.info('Internet detectado', {
        description: `Tienes ${pendingCount} fotos pendientes. ¿Sincronizar ahora?`,
        action: {
          label: 'Sincronizar',
          onClick: handleSync
        },
        duration: 10000
      });
    }
  }, [isOnline, pendingCount, syncInProgress]);

  const handleConnect = async () => {
    // Verificar que estamos en WiFi de Theta antes de intentar conectar
    if (!isThetaWiFi && hasRealInternet) {
      toast.error('No estás conectado al WiFi de la cámara', {
        description: 'Conéctate a la red WiFi THETAXXXXX.OSC de tu cámara primero',
        duration: 5000
      });
      return;
    }

    try {
      await connect();
      toast.success('Theta Z1 conectada exitosamente');
    } catch (error) {
      toast.error('Error al conectar con Theta Z1');
    }
  };

  const handleCapture = async () => {
    if (!selectedTour || !selectedHotspot) {
      toast.error('Selecciona un tour y hotspot primero');
      return;
    }

    try {
      const photoBlob = await capturePhoto();
      
      // Guardar en IndexedDB con tour y hotspot asignado
      const photoId = await offlineStorage.savePendingPhoto({
        hotspotId: selectedHotspot.id,
        tourId: selectedTour.id,
        tenantId: selectedTour.tenant_id,
        blob: photoBlob,
        captureDate: new Date(),
        filename: `theta_${selectedHotspot.title}_${Date.now()}.jpg`,
      });

      // Crear preview
      const previewUrl = URL.createObjectURL(photoBlob);
      setLastPhotoPreview(previewUrl);
      setCaptureCount(prev => prev + 1);

      await refreshCount();
      
      toast.success(`Foto capturada para "${selectedHotspot.title}"`, {
        description: `Tour: ${selectedTour.title}`
      });
    } catch (error) {
      toast.error('Error al capturar foto');
    }
  };

  const handleSync = async () => {
    if (!isOnline) {
      toast.error('No hay conexión a internet');
      return;
    }

    try {
      await syncNow();
      toast.success('Fotos sincronizadas exitosamente');
      await refreshCount();
    } catch (error) {
      toast.error('Error al sincronizar fotos');
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header con estado de conexión */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Modo Offline - Theta Z1</CardTitle>
            </div>
            <CardDescription>
              Captura fotos 360° sin conexión a internet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SyncStatusIndicator 
              isOnline={hasRealInternet}
              isSyncing={syncInProgress}
              syncProgress={syncProgress}
              currentOperation={currentOperation}
              pendingCount={pendingCount}
              variant="detailed"
            />
            
            {/* Estado de WiFi de Theta */}
            {isThetaWiFi && (
              <Alert>
                <Wifi className="w-4 h-4" />
                <AlertDescription>
                  ✅ Conectado al WiFi de la Theta Z1{currentSSID && ` (${currentSSID})`}
                </AlertDescription>
              </Alert>
            )}
            
            {!isThetaWiFi && !hasRealInternet && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  ⚠️ No estás conectado al WiFi de la Theta ni a internet. Conéctate a la red THETAXXXXX.OSC de tu cámara.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Quick Guide */}
        <OfflineQuickGuide variant="card" onOpenTutorial={() => setTutorialOpen(true)} />

        {/* Tour Selection */}
        {cachedTours.length === 0 ? (
          <Alert variant="destructive">
            <AlertDescription>
              No hay tours disponibles offline. Prepara un tour primero desde el Editor cuando tengas internet.
            </AlertDescription>
          </Alert>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Map className="w-5 h-5" />
                Seleccionar Tour y Punto
              </CardTitle>
              <CardDescription>
                Selecciona dónde se guardarán las fotos capturadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tour selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tour</label>
                <Select
                  value={selectedTour?.id}
                  onValueChange={(tourId) => {
                    const tourData = cachedTours.find(t => t.tour.id === tourId);
                    if (tourData) {
                      setSelectedTour(tourData.tour);
                      if (tourData.floorPlans.length > 0) {
                        setSelectedFloorPlan(tourData.floorPlans[0]);
                      } else {
                        setSelectedFloorPlan(null);
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cachedTours.map(({ tour }) => (
                      <SelectItem key={tour.id} value={tour.id}>
                        {tour.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Floor plan selector */}
              {selectedTour && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plano</label>
                  <Select
                    value={selectedFloorPlan?.id}
                    onValueChange={(fpId) => {
                      const tourData = cachedTours.find(t => t.tour.id === selectedTour.id);
                      if (tourData) {
                        const fp = tourData.floorPlans.find(f => f.id === fpId);
                        if (fp) setSelectedFloorPlan(fp);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {cachedTours
                        .find(t => t.tour.id === selectedTour.id)
                        ?.floorPlans.map((fp) => (
                          <SelectItem key={fp.id} value={fp.id}>
                            {fp.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Hotspot selector */}
              {selectedFloorPlan && availableHotspots.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Punto de Interés</label>
                  <Select
                    value={selectedHotspot?.id}
                    onValueChange={(hotspotId) => {
                      const hotspot = availableHotspots.find(h => h.id === hotspotId);
                      if (hotspot) setSelectedHotspot(hotspot);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableHotspots.map((hotspot) => (
                        <SelectItem key={hotspot.id} value={hotspot.id}>
                          <span className="flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            {hotspot.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedFloorPlan && availableHotspots.length === 0 && (
                <Alert>
                  <AlertDescription>
                    Este plano no tiene puntos de interés. Crea puntos en el Editor primero.
                  </AlertDescription>
                </Alert>
              )}

              {selectedTour && selectedFloorPlan && selectedHotspot && (
                <div className="p-3 bg-secondary rounded-lg">
                  <div className="text-sm font-medium mb-1">Capturando para:</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedTour.title} → {selectedFloorPlan.name} → {selectedHotspot.title}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instrucciones */}
        <Alert>
          <AlertDescription>
            <ol className="list-decimal list-inside space-y-2">
              <li>Selecciona el tour y punto donde guardar las fotos</li>
              <li><strong>Conecta tu dispositivo al WiFi de la Theta Z1</strong> (THETAXXXXX.OSC)</li>
              <li>Espera a que aparezca "✅ Conectado al WiFi de la Theta Z1"</li>
              <li>Presiona "Conectar Theta Z1"</li>
              <li>Captura todas las fotos que necesites</li>
              <li>Cuando tengas internet, sincroniza las fotos</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Estado de la cámara */}
        <Card>
          <CardHeader>
            <CardTitle>Cámara Theta Z1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Botones de conexión */}
            {!isConnected ? (
              <Button 
                onClick={handleConnect} 
                disabled={isConnecting}
                className="w-full"
                size="lg"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Conectar Theta Z1
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                  <span className="flex items-center text-sm">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                    Cámara conectada
                  </span>
                  {batteryLevel !== null && (
                    <span className="flex items-center text-sm">
                      <Battery className="w-4 h-4 mr-1" />
                      {batteryLevel}%
                    </span>
                  )}
                </div>

                <Button 
                  onClick={handleCapture} 
                  disabled={isCapturing || !selectedHotspot}
                  className="w-full"
                  size="lg"
                >
                  {isCapturing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Capturando...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 mr-2" />
                      {selectedHotspot ? `Capturar para "${selectedHotspot.title}"` : 'Selecciona un punto primero'}
                    </>
                  )}
                </Button>

                <Button 
                  onClick={disconnect} 
                  variant="outline"
                  className="w-full"
                >
                  Desconectar
                </Button>
              </div>
            )}

            {cameraError && (
              <Alert variant="destructive">
                <AlertDescription>{cameraError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Estadísticas y sincronización */}
        <Card>
          <CardHeader>
            <CardTitle>Fotos Capturadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary rounded-lg text-center">
                <div className="text-2xl font-bold">{captureCount}</div>
                <div className="text-sm text-muted-foreground">En esta sesión</div>
              </div>
              <div className="p-4 bg-secondary rounded-lg text-center">
                <div className="text-2xl font-bold">{pendingCount}</div>
                <div className="text-sm text-muted-foreground">Pendientes de sincronizar</div>
              </div>
            </div>

            {pendingCount > 0 && (
              <Button 
                onClick={handleSync}
                disabled={!isOnline || syncInProgress}
                className="w-full"
                variant="default"
              >
                {syncInProgress ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {currentOperation || 'Sincronizando...'} ({syncProgress}%)
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sincronizar {pendingCount} fotos
                  </>
                )}
              </Button>
            )}

            {!isOnline && pendingCount > 0 && (
              <Alert>
                <AlertDescription>
                  Las fotos se sincronizarán automáticamente cuando vuelvas a tener internet
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Preview de última foto */}
        {lastPhotoPreview && (
          <Card>
            <CardHeader>
              <CardTitle>Última Foto Capturada</CardTitle>
            </CardHeader>
            <CardContent>
              <img 
                src={lastPhotoPreview} 
                alt="Preview" 
                className="w-full rounded-lg"
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tutorial Dialog */}
      <OfflineTutorialDialog open={tutorialOpen} onOpenChange={setTutorialOpen} />
    </div>
  );
}
