import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  X, ChevronLeft, ChevronRight, RotateCw, ZoomIn, ZoomOut, 
  Maximize, Minimize, Info, Navigation, MapPin, Calendar
} from "lucide-react";
import * as THREE from 'three';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PanoramaPhoto {
  id: string;
  hotspot_id: string;
  photo_url: string;
  description?: string;
  display_order: number;
  capture_date?: string;
}

interface Hotspot {
  id: string;
  title: string;
  x_position: number;
  y_position: number;
}

interface PanoramaViewerProps {
  isVisible: boolean;
  onClose: () => void;
  photos: PanoramaPhoto[];
  activePhoto: PanoramaPhoto | null;
  setActivePhoto: (photo: PanoramaPhoto) => void;
  hotspotName: string;
  allHotspotsOnFloor: Hotspot[];
  onNavigate: (hotspot: Hotspot) => void;
}

export default function PanoramaViewer({ 
  isVisible, 
  onClose, 
  photos, 
  activePhoto, 
  setActivePhoto, 
  hotspotName,
  allHotspotsOnFloor,
  onNavigate
}: PanoramaViewerProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);

  // Silenciar advertencias de Three.js sobre características no soportadas
  useEffect(() => {
    const originalWarn = console.warn;
    console.warn = (...args) => {
      const message = args[0]?.toString?.() || '';
      if (
        message.includes('Unrecognized feature') ||
        message.includes('vr') ||
        message.includes('ambient-light-sensor') ||
        message.includes('battery')
      ) {
        return;
      }
      originalWarn(...args);
    };

    return () => {
      console.warn = originalWarn;
    };
  }, []);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const isUserInteracting = useRef(false);
  const onPointerDownMouseX = useRef(0);
  const onPointerDownMouseY = useRef(0);
  const lon = useRef(0);
  const onPointerDownLon = useRef(0);
  const lat = useRef(0);
  const onPointerDownLat = useRef(0);
  const phi = useRef(0);
  const theta = useRef(0);
  const [showControls, setShowControls] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(120);
  const [showNavList, setShowNavList] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Obtener fechas únicas de las fotos
  const uniqueDates = useMemo(() => {
    const dates = photos
      .map(p => p.capture_date)
      .filter((date): date is string => !!date)
      .filter((date, index, self) => self.indexOf(date) === index)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return dates;
  }, [photos]);

  // Filtrar fotos por fecha seleccionada
  const filteredPhotos = useMemo(() => {
    if (!selectedDate) return photos;
    return photos.filter(p => p.capture_date === selectedDate);
  }, [photos, selectedDate]);

  // Hotspots con fotos en la fecha seleccionada (ordenados por creación)
  const hotspotsWithPhotosInSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    const hotspotIds = new Set(
      photos
        .filter(p => p.capture_date === selectedDate)
        .map(p => p.hotspot_id)
    );
    return allHotspotsOnFloor.filter(h => hotspotIds.has(h.id));
  }, [selectedDate, photos, allHotspotsOnFloor]);

  // Determinar modo de navegación: siempre hotspots (puntos)
  const navigationMode = 'hotspots';

  // Ajustar activePhoto si no está en las fotos filtradas
  useEffect(() => {
    if (selectedDate && activePhoto && !filteredPhotos.find(p => p.id === activePhoto.id)) {
      if (filteredPhotos.length > 0) {
        setActivePhoto(filteredPhotos[0]);
      }
    }
  }, [selectedDate, activePhoto, filteredPhotos, setActivePhoto]);

  const animate = useCallback(() => {
    if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return;
    requestAnimationFrame(animate);

    lat.current = Math.max(-85, Math.min(85, lat.current));
    phi.current = THREE.MathUtils.degToRad(90 - lat.current);
    theta.current = THREE.MathUtils.degToRad(lon.current);

    const x = 500 * Math.sin(phi.current) * Math.cos(theta.current);
    const y = 500 * Math.cos(phi.current);
    const z = 500 * Math.sin(phi.current) * Math.sin(theta.current);

    cameraRef.current.lookAt(x, y, z);
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, []);

  const onPointerMove = useCallback((event: MouseEvent | TouchEvent) => {
    if (isUserInteracting.current === true) {
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
      lon.current = (onPointerDownMouseX.current - clientX) * 0.1 + onPointerDownLon.current;
      lat.current = (clientY - onPointerDownMouseY.current) * 0.1 + onPointerDownLat.current;
    }
  }, []);

  const onPointerUp = useCallback(() => {
    isUserInteracting.current = false;
    document.removeEventListener('mousemove', onPointerMove as any);
    document.removeEventListener('touchmove', onPointerMove as any);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchend', onPointerUp);
  }, [onPointerMove]);

  const onPointerDown = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    isUserInteracting.current = true;
    const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
    const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
    onPointerDownMouseX.current = clientX;
    onPointerDownMouseY.current = clientY;
    onPointerDownLon.current = lon.current;
    onPointerDownLat.current = lat.current;

    document.addEventListener('mousemove', onPointerMove as any);
    document.addEventListener('touchmove', onPointerMove as any, { passive: false });
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);
  }, [onPointerMove, onPointerUp]);

  const onDocumentWheel = useCallback((event: WheelEvent) => {
    if (!cameraRef.current) return;
    const newFov = cameraRef.current.fov + event.deltaY * 0.05;
    cameraRef.current.fov = THREE.MathUtils.clamp(newFov, 30, 120);
    cameraRef.current.updateProjectionMatrix();
    setCurrentZoom(cameraRef.current.fov);
  }, []);
  
  const handleResize = useCallback(() => {
    if (cameraRef.current && rendererRef.current && mountRef.current) {
      cameraRef.current.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    }
  }, []);

  useEffect(() => {
    if (!isVisible || !activePhoto || !mountRef.current) {
      const mountNode = mountRef.current;
      if (mountNode) {
        window.removeEventListener('resize', handleResize);
        mountNode.removeEventListener('mousedown', onPointerDown as any);
        mountNode.removeEventListener('touchstart', onPointerDown as any);
        mountNode.removeEventListener('wheel', onDocumentWheel);
        if (rendererRef.current && rendererRef.current.domElement && mountNode.contains(rendererRef.current.domElement)) {
          mountNode.removeChild(rendererRef.current.domElement);
        }
      }
      
      if (meshRef.current) {
        sceneRef.current?.remove(meshRef.current);
        if (meshRef.current.geometry) meshRef.current.geometry.dispose();
        if (meshRef.current.material) {
            if (Array.isArray(meshRef.current.material)) {
                meshRef.current.material.forEach((m: any) => {
                    if (m.map) m.map.dispose();
                    m.dispose();
                });
            } else {
                const mat = meshRef.current.material as any;
                if (mat.map) mat.map.dispose();
                mat.dispose();
            }
        }
        meshRef.current = null;
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      sceneRef.current = null; 
      cameraRef.current = null;
      setLoadingError(null);
      return;
    }

    const mountNode = mountRef.current;
    setLoadingError(null);

    if (!rendererRef.current) {
      cameraRef.current = new THREE.PerspectiveCamera(120, mountNode.clientWidth / mountNode.clientHeight, 1, 1100);
      sceneRef.current = new THREE.Scene();
      rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
      rendererRef.current.setPixelRatio(window.devicePixelRatio);
      rendererRef.current.setSize(mountNode.clientWidth, mountNode.clientHeight);
      mountNode.appendChild(rendererRef.current.domElement);
      
      mountNode.style.touchAction = 'none';
      mountNode.addEventListener('mousedown', onPointerDown as any);
      mountNode.addEventListener('touchstart', onPointerDown as any, { passive: false });
      mountNode.addEventListener('wheel', onDocumentWheel);
      window.addEventListener('resize', handleResize);
      
      animate();
    }

    if (!activePhoto.photo_url || typeof activePhoto.photo_url !== 'string') {
      setLoadingError('URL de imagen inválida');
      return;
    }

    const sphereGeometry = new THREE.SphereGeometry(500, 60, 40);
    sphereGeometry.scale(-1, 1, 1);
    
    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load(
      activePhoto.photo_url,
      (texture) => {
        if (!sceneRef.current) {
            texture.dispose();
            sphereGeometry.dispose();
            return; 
        }

        if (meshRef.current) {
          sceneRef.current.remove(meshRef.current);
          if (meshRef.current.geometry) meshRef.current.geometry.dispose();
          if (meshRef.current.material) {
              if (Array.isArray(meshRef.current.material)) {
                  meshRef.current.material.forEach((m: any) => {
                      if (m.map) m.map.dispose();
                      m.dispose();
                  });
              } else {
                  const mat = meshRef.current.material as any;
                  if (mat.map) mat.map.dispose();
                  mat.dispose();
              }
          }
          meshRef.current = null;
        }
        
        const material = new THREE.MeshBasicMaterial({ map: texture });
        const mesh = new THREE.Mesh(sphereGeometry, material);
        sceneRef.current.add(mesh);
        meshRef.current = mesh;
        
        sphereGeometry.dispose();
        
        if (cameraRef.current) {
            cameraRef.current.fov = 120;
            cameraRef.current.updateProjectionMatrix();
            setCurrentZoom(120);
            lon.current = 0;
            lat.current = 0;
        }

        setLoadingError(null);
      },
      undefined,
      (error) => {
        console.error("Failed to load panorama texture:", error);
        sphereGeometry.dispose();
        
        let errorMessage = 'Error desconocido al cargar la imagen.';
        if (error instanceof Error && error.message) {
            errorMessage = `Error al cargar la imagen: ${error.message}`;
        } else {
            errorMessage = 'Error de red al cargar la imagen 360°. Por favor, verifica tu conexión.';
        }
        setLoadingError(errorMessage);
      }
    );

  }, [isVisible, activePhoto, animate, onPointerDown, onDocumentWheel, handleResize]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showControls) {
      timer = setTimeout(() => setShowControls(false), 3000);
    }
    return () => clearTimeout(timer);
  }, [showControls, currentZoom]);

  // Navegación por HOTSPOTS (con o sin fecha seleccionada)
  const handleNextHotspot = useCallback(() => {
    if (!activePhoto) return;
    const hotspotList = hotspotsWithPhotosInSelectedDate.length > 0 
      ? hotspotsWithPhotosInSelectedDate 
      : allHotspotsOnFloor;
    const currentHotspotIndex = hotspotList.findIndex(h => h.id === activePhoto.hotspot_id);
    if (currentHotspotIndex < hotspotList.length - 1) {
      const nextHotspot = hotspotList[currentHotspotIndex + 1];
      onNavigate(nextHotspot);
    }
  }, [activePhoto, hotspotsWithPhotosInSelectedDate, allHotspotsOnFloor, onNavigate]);

  const handlePrevHotspot = useCallback(() => {
    if (!activePhoto) return;
    const hotspotList = hotspotsWithPhotosInSelectedDate.length > 0 
      ? hotspotsWithPhotosInSelectedDate 
      : allHotspotsOnFloor;
    const currentHotspotIndex = hotspotList.findIndex(h => h.id === activePhoto.hotspot_id);
    if (currentHotspotIndex > 0) {
      const prevHotspot = hotspotList[currentHotspotIndex - 1];
      onNavigate(prevHotspot);
    }
  }, [activePhoto, hotspotsWithPhotosInSelectedDate, allHotspotsOnFloor, onNavigate]);

  // Función principal de navegación (siempre por hotspots)
  const handleNext = useCallback(() => {
    handleNextHotspot();
  }, [handleNextHotspot]);

  const handlePrev = useCallback(() => {
    handlePrevHotspot();
  }, [handlePrevHotspot]);

  const handleDateFilter = (date: string | null) => {
    setSelectedDate(date);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "d 'de' MMMM, yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  // Calcular etiquetas para flechas de navegación
  const prevLabel = useMemo(() => {
    if (!activePhoto) return null;
    const hotspotList = hotspotsWithPhotosInSelectedDate.length > 0 
      ? hotspotsWithPhotosInSelectedDate 
      : allHotspotsOnFloor;
    const currentIndex = hotspotList.findIndex(h => h.id === activePhoto.hotspot_id);
    
    console.log('🔍 PrevLabel Debug:', {
      activePhotoId: activePhoto.hotspot_id,
      hotspotListLength: hotspotList.length,
      hotspotListIds: hotspotList.map(h => h.id),
      currentIndex,
      hasPrev: currentIndex > 0
    });
    
    // Si no encontramos el hotspot o estamos en el primero, no hay anterior
    if (currentIndex <= 0) return null;
    return hotspotList[currentIndex - 1].title;
  }, [activePhoto, hotspotsWithPhotosInSelectedDate, allHotspotsOnFloor]);

  const nextLabel = useMemo(() => {
    if (!activePhoto) return null;
    const hotspotList = hotspotsWithPhotosInSelectedDate.length > 0 
      ? hotspotsWithPhotosInSelectedDate 
      : allHotspotsOnFloor;
    const currentIndex = hotspotList.findIndex(h => h.id === activePhoto.hotspot_id);
    
    console.log('🔍 NextLabel Debug:', {
      activePhotoId: activePhoto.hotspot_id,
      hotspotListLength: hotspotList.length,
      hotspotListIds: hotspotList.map(h => h.id),
      currentIndex,
      hasNext: currentIndex >= 0 && currentIndex < hotspotList.length - 1
    });
    
    // Si no encontramos el hotspot o estamos en el último, no hay siguiente
    if (currentIndex === -1 || currentIndex >= hotspotList.length - 1) return null;
    return hotspotList[currentIndex + 1].title;
  }, [activePhoto, hotspotsWithPhotosInSelectedDate, allHotspotsOnFloor]);

  const resetView = () => {
    lon.current = 0;
    lat.current = 0;
    if (cameraRef.current) {
        cameraRef.current.fov = 120;
        cameraRef.current.updateProjectionMatrix();
    }
    setCurrentZoom(120);
  };
  
  const zoomInOut = (amount: number) => {
    if (!cameraRef.current) return;
    const newFov = cameraRef.current.fov + amount;
    cameraRef.current.fov = THREE.MathUtils.clamp(newFov, 30, 120);
    cameraRef.current.updateProjectionMatrix();
    setCurrentZoom(cameraRef.current.fov);
  };

  const toggleFullscreen = () => {
     const elem = document.querySelector('.fullscreen-container');
    if (!document.fullscreenElement) {
      elem?.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => console.error("Error entering fullscreen:", err));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(err => console.error("Error exiting fullscreen:", err));
    }
  };

  const handleNavClick = (hotspot: Hotspot) => {
    setShowNavList(false);
    onNavigate(hotspot);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fullscreen-container fixed inset-0 z-30 bg-black flex items-center justify-center overflow-hidden select-none"
          onMouseMove={() => setShowControls(true)}
          onMouseEnter={() => setShowControls(true)}
        >
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
          
          {loadingError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
              <div className="bg-red-600/90 backdrop-blur-sm rounded-lg p-6 mx-4 max-w-md text-center">
                <div className="text-white text-xl mb-2">❌</div>
                <h3 className="text-white font-semibold mb-2">Error al Cargar Imagen</h3>
                <p className="text-white/90 text-sm mb-4">{loadingError}</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => {
                      setLoadingError(null);
                      if (activePhoto) setActivePhoto({...activePhoto});
                    }}
                    className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded text-sm"
                  >
                    Reintentar
                  </button>
                  <button
                    onClick={onClose}
                    className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded text-sm"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

          <AnimatePresence>
            {showControls && !loadingError && (
              <>
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent pointer-events-none"
                >
                  <div className="flex justify-between items-center pointer-events-auto">
                    <div className="text-white">
                      <h2 className="text-xl font-bold">{hotspotName}</h2>
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        {photos.length > 1 && activePhoto && (
                          <span>
                            Foto {(selectedDate ? filteredPhotos : photos).findIndex(p => p.id === activePhoto.id) + 1} de {selectedDate ? filteredPhotos.length : photos.length}
                          </span>
                        )}
                        {activePhoto?.capture_date && (
                          <>
                            <span className="text-slate-500">•</span>
                            <span>{formatDate(activePhoto.capture_date)}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="ghost" size="icon" onClick={() => setShowInfo(!showInfo)} className="text-white hover:bg-white/20 rounded-full"><Info className="w-5 h-5" /></Button>
                       <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/20 rounded-full">{isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}</Button>
                       <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 rounded-full"><X className="w-6 h-6" /></Button>
                    </div>
                  </div>
                </motion.div>

                {/* Flechas de navegación con nombres */}
                {prevLabel && (
                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onClick={handlePrev}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 
                               bg-black/60 backdrop-blur-sm hover:bg-black/80 
                               text-white rounded-lg px-4 py-6 
                               flex items-center gap-3 group
                               transition-all duration-200 hover:px-5"
                  >
                    <ChevronLeft className="w-6 h-6 group-hover:scale-110 transition-transform" />
                     <div className="flex flex-col items-start">
                      <span className="text-xs text-slate-400 uppercase tracking-wider">
                        Punto anterior
                      </span>
                      <span className="text-sm font-medium max-w-[120px] truncate">
                        {prevLabel}
                      </span>
                    </div>
                  </motion.button>
                )}

                {nextLabel && (
                  <motion.button
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onClick={handleNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 
                               bg-black/60 backdrop-blur-sm hover:bg-black/80 
                               text-white rounded-lg px-4 py-6 
                               flex items-center gap-3 group
                               transition-all duration-200 hover:px-5"
                  >
                     <div className="flex flex-col items-end">
                      <span className="text-xs text-slate-400 uppercase tracking-wider">
                        Punto siguiente
                      </span>
                      <span className="text-sm font-medium max-w-[120px] truncate">
                        {nextLabel}
                      </span>
                    </div>
                    <ChevronRight className="w-6 h-6 group-hover:scale-110 transition-transform" />
                  </motion.button>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none"
                >
                  <div className="bg-black/50 backdrop-blur-sm rounded-xl p-4 mx-auto max-w-3xl pointer-events-auto">
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                       {/* Indicador de modo de navegación */}
                       {allHotspotsOnFloor.length > 1 && (
                         <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
                           <Navigation className="w-4 h-4 text-white" />
                           <span className="text-xs font-medium text-white">
                             {selectedDate 
                               ? `Navegando entre ${hotspotsWithPhotosInSelectedDate.length} puntos (${formatDate(selectedDate)})`
                               : `Navegando entre ${allHotspotsOnFloor.length} puntos`}
                           </span>
                         </div>
                       )}
                       <div className="w-px h-6 bg-white/30" />
                       <Button variant="ghost" size="icon" onClick={() => zoomInOut(5)} className="text-white hover:bg-white/20 rounded-full" disabled={currentZoom >= 120}><ZoomOut className="w-5 h-5" /></Button>
                       <span className="text-white text-sm font-medium min-w-16 text-center">{Math.round(100 - (currentZoom - 30) / (120 - 30) * 100)}%</span>
                       <Button variant="ghost" size="icon" onClick={() => zoomInOut(-5)} className="text-white hover:bg-white/20 rounded-full" disabled={currentZoom <= 30}><ZoomIn className="w-5 h-5" /></Button>
                       <div className="w-px h-6 bg-white/30 mx-2" />
                       <Button variant="ghost" size="icon" onClick={resetView} className="text-white hover:bg-white/20 rounded-full"><RotateCw className="w-5 h-5" /></Button>
                       <div className="w-px h-6 bg-white/30 mx-2" />
                       
                       {/* Menú de Navegación entre Puntos */}
                       <DropdownMenu>
                         <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full">
                             <MapPin className="w-5 h-5" />
                           </Button>
                         </DropdownMenuTrigger>
                         <DropdownMenuContent className="w-64 bg-black/90 backdrop-blur-lg border-white/20 text-white">
                           <div className="px-2 py-1.5 text-sm font-semibold">Navegar a otro punto</div>
                           <DropdownMenuSeparator className="bg-white/20" />
                           <ScrollArea className="h-64">
                             {allHotspotsOnFloor && allHotspotsOnFloor.filter(h => h.id !== activePhoto?.hotspot_id).map(hotspot => (
                               <DropdownMenuItem
                                 key={hotspot.id}
                                 onClick={() => handleNavClick(hotspot)}
                                 className="cursor-pointer hover:bg-white/10 focus:bg-white/10 focus:text-white"
                               >
                                 <MapPin className="w-4 h-4 mr-2" />
                                 {hotspot.title}
                               </DropdownMenuItem>
                             ))}
                             {(!allHotspotsOnFloor || allHotspotsOnFloor.filter(h => h.id !== activePhoto?.hotspot_id).length === 0) && (
                               <div className="px-2 py-4 text-sm text-slate-400 text-center">
                                 No hay otros puntos disponibles
                               </div>
                             )}
                           </ScrollArea>
                         </DropdownMenuContent>
                       </DropdownMenu>

                       {/* Menú de Fechas */}
                       {uniqueDates.length > 1 && (
                         <>
                           <div className="w-px h-6 bg-white/30 mx-2" />
                           <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                               <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full">
                                 <Calendar className="w-5 h-5" />
                               </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent className="w-64 bg-black/90 backdrop-blur-lg border-white/20 text-white">
                               <div className="px-2 py-1.5 text-sm font-semibold">Filtrar por fecha</div>
                               <DropdownMenuSeparator className="bg-white/20" />
                               <DropdownMenuItem
                                 onClick={() => handleDateFilter(null)}
                                 className={`cursor-pointer hover:bg-white/10 focus:bg-white/10 focus:text-white ${!selectedDate ? 'bg-white/20' : ''}`}
                               >
                                 <Calendar className="w-4 h-4 mr-2" />
                                 Todas las fechas ({photos.length})
                               </DropdownMenuItem>
                               <DropdownMenuSeparator className="bg-white/20" />
                               {uniqueDates.map(date => (
                                 <DropdownMenuItem
                                   key={date}
                                   onClick={() => handleDateFilter(date)}
                                   className={`cursor-pointer hover:bg-white/10 focus:bg-white/10 focus:text-white ${selectedDate === date ? 'bg-white/20' : ''}`}
                                 >
                                   <Calendar className="w-4 h-4 mr-2" />
                                   {formatDate(date)} ({photos.filter(p => p.capture_date === date).length})
                                 </DropdownMenuItem>
                               ))}
                             </DropdownMenuContent>
                           </DropdownMenu>
                         </>
                       )}
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>


          <AnimatePresence>
            {showInfo && activePhoto?.description && !loadingError && (
              <motion.div initial={{ opacity: 0, x: 300 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 300 }} className="absolute top-20 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white max-w-sm pointer-events-auto z-40">
                <h3 className="font-semibold mb-2">Información</h3>
                <p className="text-sm text-slate-300">{activePhoto.description}</p>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      )}
    </AnimatePresence>
  );
}