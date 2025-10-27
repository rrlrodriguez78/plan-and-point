import { useRef, useState, useCallback, useEffect, RefObject } from 'react';
import { useDeviceDetection } from './useDeviceDetection';

const MIN_SCALE = 0.3;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.15;
const MOBILE_INITIAL_SCALE = 2.5; // 250% para móviles - plano grande y legible desde el inicio
const TABLET_INITIAL_SCALE = 0.9; // 90% para tablets - mejor aprovechamiento del espacio
const DESKTOP_INITIAL_SCALE = 1.0; // 100% para desktop

interface Transform {
  scale: number;
  x: number;
  y: number;
}

interface UseZoomPanReturn {
  transform: Transform;
  containerRef: RefObject<HTMLDivElement>;
  contentRef: RefObject<HTMLDivElement>;
  zoomIn: () => void;
  zoomOut: () => void;
  resetTransform: () => void;
}

export const useZoomPan = (): UseZoomPanReturn => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Usar detección híbrida de dispositivos
  const { deviceType, isMobile, isTablet, isDesktop } = useDeviceDetection();
  
  // Determinar escala inicial basada en tipo de dispositivo
  const getInitialScale = useCallback(() => {
    switch (deviceType) {
      case 'mobile':
        return MOBILE_INITIAL_SCALE;
      case 'tablet':
        return TABLET_INITIAL_SCALE;
      case 'desktop':
      default:
        return DESKTOP_INITIAL_SCALE;
    }
  }, [deviceType]);
  
  const [transform, setTransform] = useState<Transform>(() => {
    const scale = getInitialScale();
    return {
      scale,
      x: 0,
      y: 0,
    };
  });

  const isPanningRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const lastTransformRef = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const initialPinchDistanceRef = useRef(0);
  const lastPinchScaleRef = useRef(1);

  // Helper: Constrain scale
  const constrainScale = useCallback((scale: number) => {
    return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);
  }, []);

  // Helper: Get touch distance for pinch
  const getTouchDistance = useCallback((touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Zoom to specific scale
  const setScale = useCallback((newScale: number, centerX?: number, centerY?: number) => {
    const container = containerRef.current;
    if (!container) return;

    const constrainedScale = constrainScale(newScale);
    
    // If center point provided, zoom towards it
    if (centerX !== undefined && centerY !== undefined) {
      const rect = container.getBoundingClientRect();
      const x = centerX - rect.left;
      const y = centerY - rect.top;
      
      const scaleChange = constrainedScale / transform.scale;
      const newX = x - (x - transform.x) * scaleChange;
      const newY = y - (y - transform.y) * scaleChange;
      
      setTransform({ scale: constrainedScale, x: newX, y: newY });
    } else {
      setTransform(prev => ({ ...prev, scale: constrainedScale }));
    }
  }, [transform, constrainScale]);

  // Zoom in
  const zoomIn = useCallback(() => {
    setScale(transform.scale + ZOOM_STEP);
  }, [transform.scale, setScale]);

  // Zoom out
  const zoomOut = useCallback(() => {
    setScale(transform.scale - ZOOM_STEP);
  }, [transform.scale, setScale]);

  // Reset transform con centrado inteligente
  const resetTransform = useCallback(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) {
      setTransform({ scale: getInitialScale(), x: 0, y: 0 });
      return;
    }

    const resetScale = getInitialScale();
    const containerRect = container.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();

    // Para móvil con zoom alto, centramos en el contenido
    if (resetScale > 1.5) {
      const scaledWidth = contentRect.width * resetScale;
      const scaledHeight = contentRect.height * resetScale;
      
      // Centrar el contenido en el viewport
      const centerX = (containerRect.width - scaledWidth) / 2;
      const centerY = (containerRect.height - scaledHeight) / 2;
      
      setTransform({ 
        scale: resetScale, 
        x: Math.max(centerX, 0), 
        y: Math.max(centerY, 0) 
      });
    } else {
      setTransform({ scale: resetScale, x: 0, y: 0 });
    }
  }, [getInitialScale]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newScale = transform.scale + delta;
    setScale(newScale, e.clientX, e.clientY);
  }, [transform.scale, setScale]);

  // Handle mouse/touch start
  const handlePointerDown = useCallback((e: MouseEvent | TouchEvent) => {
    if (e instanceof TouchEvent && e.touches.length === 2) {
      // Pinch start
      initialPinchDistanceRef.current = getTouchDistance(e.touches);
      lastPinchScaleRef.current = transform.scale;
    } else if (e instanceof TouchEvent && e.touches.length === 1) {
      // Pan start (touch)
      isPanningRef.current = true;
      startPosRef.current = {
        x: e.touches[0].clientX - transform.x,
        y: e.touches[0].clientY - transform.y,
      };
      lastTransformRef.current = transform;
    } else if (e instanceof MouseEvent) {
      // Pan start (mouse)
      isPanningRef.current = true;
      startPosRef.current = {
        x: e.clientX - transform.x,
        y: e.clientY - transform.y,
      };
      lastTransformRef.current = transform;
    }
  }, [transform, getTouchDistance]);

  // Handle mouse/touch move
  const handlePointerMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (e instanceof TouchEvent && e.touches.length === 2) {
      // Pinch zoom
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      const scaleChange = currentDistance / initialPinchDistanceRef.current;
      const newScale = lastPinchScaleRef.current * scaleChange;
      
      // Get center point between two touches
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      
      setScale(newScale, centerX, centerY);
    } else if (isPanningRef.current) {
      // Pan
      if (e instanceof TouchEvent && e.touches.length === 1) {
        const newX = e.touches[0].clientX - startPosRef.current.x;
        const newY = e.touches[0].clientY - startPosRef.current.y;
        setTransform(prev => ({ ...prev, x: newX, y: newY }));
      } else if (e instanceof MouseEvent) {
        const newX = e.clientX - startPosRef.current.x;
        const newY = e.clientY - startPosRef.current.y;
        setTransform(prev => ({ ...prev, x: newX, y: newY }));
      }
    }
  }, [getTouchDistance, setScale]);

  // Handle mouse/touch end
  const handlePointerUp = useCallback(() => {
    isPanningRef.current = false;
    initialPinchDistanceRef.current = 0;
  }, []);

  // Setup event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Wheel events
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Mouse events
    container.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    // Touch events
    container.addEventListener('touchstart', handlePointerDown, { passive: false });
    container.addEventListener('touchmove', handlePointerMove, { passive: false });
    container.addEventListener('touchend', handlePointerUp);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      container.removeEventListener('touchstart', handlePointerDown);
      container.removeEventListener('touchmove', handlePointerMove);
      container.removeEventListener('touchend', handlePointerUp);
    };
  }, [handleWheel, handlePointerDown, handlePointerMove, handlePointerUp]);

  // Effect para ajustar zoom inicial y cuando cambia el tipo de dispositivo
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    // Detectar si está en escala por defecto (móvil, tablet o desktop)
    const isAtDefaultScale = 
      Math.abs(transform.scale - MOBILE_INITIAL_SCALE) < 0.01 ||
      Math.abs(transform.scale - TABLET_INITIAL_SCALE) < 0.01 ||
      Math.abs(transform.scale - DESKTOP_INITIAL_SCALE) < 0.01;
    
    // Solo ajustar si el usuario no ha hecho zoom manual
    if (isAtDefaultScale) {
      const newScale = getInitialScale();
      
      // Solo actualizar si realmente cambió la escala
      if (Math.abs(transform.scale - newScale) > 0.01) {
        // Para móvil, centrar el contenido
        if (newScale > 1.5) {
          const containerRect = container.getBoundingClientRect();
          const contentRect = content.getBoundingClientRect();
          const scaledWidth = contentRect.width * newScale;
          const scaledHeight = contentRect.height * newScale;
          
          const centerX = (containerRect.width - scaledWidth) / 2;
          const centerY = (containerRect.height - scaledHeight) / 2;
          
          setTransform({
            scale: newScale,
            x: Math.max(centerX, 0),
            y: Math.max(centerY, 0)
          });
        } else {
          setTransform(prev => ({
            ...prev,
            scale: newScale,
            x: prev.x * (newScale / prev.scale),
            y: prev.y * (newScale / prev.scale)
          }));
        }
      }
    }
  }, [deviceType, getInitialScale]);

  // Effect inicial para centrar el contenido al montar
  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const currentScale = getInitialScale();
    
    // Solo para móvil con zoom alto
    if (currentScale > 1.5) {
      // Esperar a que la imagen cargue
      const img = content.querySelector('img');
      if (img && !img.complete) {
        img.onload = () => {
          const containerRect = container.getBoundingClientRect();
          const contentRect = content.getBoundingClientRect();
          const scaledWidth = contentRect.width * currentScale;
          const scaledHeight = contentRect.height * currentScale;
          
          const centerX = (containerRect.width - scaledWidth) / 2;
          const centerY = (containerRect.height - scaledHeight) / 2;
          
          setTransform(prev => ({
            ...prev,
            x: Math.max(centerX, 0),
            y: Math.max(centerY, 0)
          }));
        };
      } else {
        // Imagen ya cargada o no hay imagen
        setTimeout(() => {
          const containerRect = container.getBoundingClientRect();
          const contentRect = content.getBoundingClientRect();
          const scaledWidth = contentRect.width * currentScale;
          const scaledHeight = contentRect.height * currentScale;
          
          const centerX = (containerRect.width - scaledWidth) / 2;
          const centerY = (containerRect.height - scaledHeight) / 2;
          
          setTransform(prev => ({
            ...prev,
            x: Math.max(centerX, 0),
            y: Math.max(centerY, 0)
          }));
        }, 100);
      }
    }
  }, []); // Solo al montar

  return {
    transform,
    containerRef,
    contentRef,
    zoomIn,
    zoomOut,
    resetTransform,
  };
};
