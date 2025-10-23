import { useRef, useState, useCallback, useEffect, RefObject } from 'react';

const MIN_SCALE = 0.3;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.15;

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
  
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    x: 0,
    y: 0,
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

  // Reset transform
  const resetTransform = useCallback(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, []);

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

  return {
    transform,
    containerRef,
    contentRef,
    zoomIn,
    zoomOut,
    resetTransform,
  };
};
