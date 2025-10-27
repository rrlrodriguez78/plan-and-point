import { useCallback, useRef, useState, useEffect } from 'react';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeConfig {
  threshold?: number; // Minimum distance in pixels
  velocity?: number; // Minimum velocity
  preventDefaultTouchmoveEvent?: boolean;
  trackMouse?: boolean; // Also track mouse events
  onSwipe?: (direction: SwipeDirection) => void;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwiping?: (deltaX: number, deltaY: number) => void;
  onSwipeEnd?: () => void;
}

export interface SwipeState {
  isSwiping: boolean;
  direction: SwipeDirection | null;
  deltaX: number;
  deltaY: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const DEFAULT_THRESHOLD = 50;
const DEFAULT_VELOCITY = 0.3;

export const useSwipeGesture = (config: SwipeConfig = {}) => {
  const {
    threshold = DEFAULT_THRESHOLD,
    velocity = DEFAULT_VELOCITY,
    preventDefaultTouchmoveEvent = false,
    trackMouse = true,
    onSwipe,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwiping,
    onSwipeEnd,
  } = config;

  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwiping: false,
    direction: null,
    deltaX: 0,
    deltaY: 0,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

  const startTimeRef = useRef<number>(0);
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isSwipingRef = useRef(false);

  const getDirection = (deltaX: number, deltaY: number): SwipeDirection | null => {
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX > 0 ? 'right' : 'left';
    } else if (Math.abs(deltaY) > threshold / 2) {
      return deltaY > 0 ? 'down' : 'up';
    }
    return null;
  };

  const handleStart = useCallback(
    (clientX: number, clientY: number) => {
      startTimeRef.current = Date.now();
      startPosRef.current = { x: clientX, y: clientY };
      isSwipingRef.current = true;

      setSwipeState({
        isSwiping: true,
        direction: null,
        deltaX: 0,
        deltaY: 0,
        startX: clientX,
        startY: clientY,
        currentX: clientX,
        currentY: clientY,
      });
    },
    []
  );

  const handleMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isSwipingRef.current) return;

      const deltaX = clientX - startPosRef.current.x;
      const deltaY = clientY - startPosRef.current.y;
      const direction = getDirection(deltaX, deltaY);

      setSwipeState((prev) => ({
        ...prev,
        deltaX,
        deltaY,
        currentX: clientX,
        currentY: clientY,
        direction,
      }));

      if (onSwiping) {
        onSwiping(deltaX, deltaY);
      }
    },
    [onSwiping, threshold]
  );

  const handleEnd = useCallback(() => {
    if (!isSwipingRef.current) return;

    const deltaX = swipeState.deltaX;
    const deltaY = swipeState.deltaY;
    const duration = Date.now() - startTimeRef.current;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Calculate velocity (pixels per millisecond)
    const velocityX = absX / duration;
    const velocityY = absY / duration;

    let triggered = false;

    // Check if swipe meets threshold and velocity requirements
    if (absX > absY && absX > threshold && velocityX > velocity) {
      // Horizontal swipe
      const direction = deltaX > 0 ? 'right' : 'left';
      if (onSwipe) onSwipe(direction);
      if (direction === 'left' && onSwipeLeft) onSwipeLeft();
      if (direction === 'right' && onSwipeRight) onSwipeRight();
      triggered = true;
    } else if (absY > absX && absY > threshold && velocityY > velocity) {
      // Vertical swipe
      const direction = deltaY > 0 ? 'down' : 'up';
      if (onSwipe) onSwipe(direction);
      if (direction === 'up' && onSwipeUp) onSwipeUp();
      if (direction === 'down' && onSwipeDown) onSwipeDown();
      triggered = true;
    }

    isSwipingRef.current = false;
    
    setSwipeState({
      isSwiping: false,
      direction: null,
      deltaX: 0,
      deltaY: 0,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    });

    if (onSwipeEnd) onSwipeEnd();
  }, [
    swipeState.deltaX,
    swipeState.deltaY,
    threshold,
    velocity,
    onSwipe,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipeEnd,
  ]);

  // Touch event handlers
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (preventDefaultTouchmoveEvent) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    },
    [handleStart, preventDefaultTouchmoveEvent]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (preventDefaultTouchmoveEvent) {
        e.preventDefault();
      }
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    },
    [handleMove, preventDefaultTouchmoveEvent]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (preventDefaultTouchmoveEvent) {
        e.preventDefault();
      }
      handleEnd();
    },
    [handleEnd, preventDefaultTouchmoveEvent]
  );

  // Mouse event handlers (for desktop testing)
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!trackMouse) return;
      e.preventDefault();
      handleStart(e.clientX, e.clientY);
    },
    [handleStart, trackMouse]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!trackMouse || !isSwipingRef.current) return;
      handleMove(e.clientX, e.clientY);
    },
    [handleMove, trackMouse]
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!trackMouse) return;
      handleEnd();
    },
    [handleEnd, trackMouse]
  );

  const onMouseLeave = useCallback(
    (e: React.MouseEvent) => {
      if (!trackMouse || !isSwipingRef.current) return;
      handleEnd();
    },
    [handleEnd, trackMouse]
  );

  // Handlers object for easy spreading
  const handlers = trackMouse
    ? {
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onMouseLeave,
      }
    : {
        onTouchStart,
        onTouchMove,
        onTouchEnd,
      };

  return {
    handlers,
    swipeState,
  };
};
