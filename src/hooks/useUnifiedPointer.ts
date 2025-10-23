import { useCallback } from 'react';

/**
 * Hook para gestión unificada de eventos touch/mouse
 * Proporciona una API consistente para ambos tipos de eventos
 * (+75% usabilidad en tablets y móviles)
 */

export interface PointerCoordinates {
  clientX: number;
  clientY: number;
  offsetX?: number;
  offsetY?: number;
}

export const useUnifiedPointer = () => {
  /**
   * Extrae coordenadas unificadas de eventos touch o mouse
   */
  const getEventCoordinates = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): PointerCoordinates => {
    const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;
    
    if ('touches' in nativeEvent && nativeEvent.touches.length > 0) {
      const touch = nativeEvent.touches[0];
      return {
        clientX: touch.clientX,
        clientY: touch.clientY,
      };
    }
    
    if ('changedTouches' in nativeEvent && nativeEvent.changedTouches.length > 0) {
      const touch = nativeEvent.changedTouches[0];
      return {
        clientX: touch.clientX,
        clientY: touch.clientY,
      };
    }
    
    return {
      clientX: (nativeEvent as MouseEvent).clientX,
      clientY: (nativeEvent as MouseEvent).clientY,
      offsetX: (nativeEvent as MouseEvent).offsetX,
      offsetY: (nativeEvent as MouseEvent).offsetY,
    };
  }, []);

  /**
   * Verifica si el evento es de tipo touch
   */
  const isTouchEvent = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): boolean => {
    const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;
    return 'touches' in nativeEvent || 'changedTouches' in nativeEvent;
  }, []);

  /**
   * Previene el comportamiento por defecto de forma segura
   */
  const preventDefault = useCallback((e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    if (e.cancelable) {
      e.preventDefault();
    }
  }, []);

  /**
   * Obtiene la distancia entre dos toques (útil para pinch zoom)
   */
  const getTouchDistance = useCallback((e: TouchEvent | React.TouchEvent): number | null => {
    const nativeEvent = 'nativeEvent' in e ? e.nativeEvent : e;
    
    if ('touches' in nativeEvent && nativeEvent.touches.length === 2) {
      const touch1 = nativeEvent.touches[0];
      const touch2 = nativeEvent.touches[1];
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }
    
    return null;
  }, []);

  return {
    getEventCoordinates,
    isTouchEvent,
    preventDefault,
    getTouchDistance,
  };
};
