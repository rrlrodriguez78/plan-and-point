import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { 
  X, ChevronLeft, ChevronRight, RotateCw, ZoomIn, ZoomOut, 
  Maximize, Minimize, Info, Navigation, MapPin
} from "lucide-react";
import * as THREE from 'three';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PanoramaPhoto {
  id: string;
  hotspot_id: string;
  photo_url: string;
  description?: string;
  display_order: number;
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

  const handleNext = () => {
    const currentIndex = photos.findIndex(p => p.id === activePhoto?.id);
    const nextIndex = (currentIndex + 1) % photos.length;
    setActivePhoto(photos[nextIndex]);
  };

  const handlePrev = () => {
    const currentIndex = photos.findIndex(p => p.id === activePhoto?.id);
    const prevIndex = (currentIndex - 1 + photos.length) % photos.length;
    setActivePhoto(photos[prevIndex]);
  };

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
                      {photos.length > 1 && activePhoto && (
                        <p className="text-sm text-slate-300">
                          Foto {photos.findIndex(p => p.id === activePhoto.id) + 1} de {photos.length}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                       <Button variant="ghost" size="icon" onClick={() => setShowInfo(!showInfo)} className="text-white hover:bg-white/20 rounded-full"><Info className="w-5 h-5" /></Button>
                       <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/20 rounded-full">{isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}</Button>
                       <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20 rounded-full"><X className="w-6 h-6" /></Button>
                    </div>
                  </div>
                </motion.div>

                {photos.length > 1 && (
                  <>
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="absolute top-1/2 left-4 -translate-y-1/2">
                       <Button variant="ghost" size="icon" onClick={handlePrev} className="text-white hover:bg-white/20 rounded-full w-12 h-12"><ChevronLeft className="w-8 h-8" /></Button>
                    </motion.div>
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute top-1/2 right-4 -translate-y-1/2">
                       <Button variant="ghost" size="icon" onClick={handleNext} className="text-white hover:bg-white/20 rounded-full w-12 h-12"><ChevronRight className="w-8 h-8" /></Button>
                    </motion.div>
                  </>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none"
                >
                  <div className="bg-black/50 backdrop-blur-sm rounded-xl p-4 mx-auto max-w-md pointer-events-auto">
                    <div className="flex items-center justify-center gap-4">
                       <Button variant="ghost" size="icon" onClick={() => zoomInOut(5)} className="text-white hover:bg-white/20 rounded-full" disabled={currentZoom >= 120}><ZoomOut className="w-5 h-5" /></Button>
                       <span className="text-white text-sm font-medium min-w-16 text-center">{Math.round(100 - (currentZoom - 30) / (120 - 30) * 100)}%</span>
                       <Button variant="ghost" size="icon" onClick={() => zoomInOut(-5)} className="text-white hover:bg-white/20 rounded-full" disabled={currentZoom <= 30}><ZoomIn className="w-5 h-5" /></Button>
                       <div className="w-px h-6 bg-white/30 mx-2" />
                       <Button variant="ghost" size="icon" onClick={resetView} className="text-white hover:bg-white/20 rounded-full"><RotateCw className="w-5 h-5" /></Button>
                       <div className="w-px h-6 bg-white/30 mx-2" />
                       <Button variant="ghost" size="icon" onClick={() => setShowNavList(!showNavList)} className="text-white hover:bg-white/20 rounded-full"><Navigation className="w-5 h-5" /></Button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showNavList && !loadingError && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="absolute bottom-24 bg-black/70 backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl w-80 pointer-events-auto z-40"
              >
                <div className="p-3 border-b border-white/20 flex justify-between items-center">
                  <h3 className="font-semibold text-white">Navegar a...</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowNavList(false)} className="text-white hover:bg-white/20 h-7 w-7 rounded-full"><X className="w-4 h-4" /></Button>
                </div>
                <ScrollArea className="h-64">
                  <div className="p-2 space-y-1">
                    {allHotspotsOnFloor && allHotspotsOnFloor.filter(h => h.id !== activePhoto?.hotspot_id).map(hotspot => (
                      <button
                        key={hotspot.id}
                        onClick={() => handleNavClick(hotspot)}
                        className="w-full text-left p-2 rounded-md hover:bg-white/10 transition-colors flex items-center gap-3 text-white"
                      >
                        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="flex-grow">{hotspot.title}</span>
                      </button>
                    ))}
                    {(!allHotspotsOnFloor || allHotspotsOnFloor.filter(h => h.id !== activePhoto?.hotspot_id).length === 0) && (
                        <p className="p-2 text-sm text-slate-400">No hay otros puntos de interés para navegar en este piso.</p>
                    )}
                  </div>
                </ScrollArea>
              </motion.div>
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