import { useState, useEffect } from 'react';

export interface DeviceDetection {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  hasTouch: boolean;
  screenWidth: number;
  userAgent: string;
}

export function useDeviceDetection(): DeviceDetection {
  const [device, setDevice] = useState<DeviceDetection>(() => {
    // Inicialización inmediata para evitar flickers
    const width = window.innerWidth;
    const ua = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const isTabletUA = /ipad|android(?!.*mobile)|tablet/i.test(ua);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    let isMobile = false;
    let isTablet = false;
    let isDesktop = false;
    
    if (isMobileUA || (width < 768 && hasTouch)) {
      isMobile = true;
    } else if (isTabletUA || (width >= 768 && width <= 1024 && hasTouch)) {
      isTablet = true;
    } else {
      isDesktop = true;
    }
    
    return {
      isMobile,
      isTablet,
      isDesktop,
      hasTouch,
      screenWidth: width,
      userAgent: ua
    };
  });

  useEffect(() => {
    const detectDevice = () => {
      const width = window.innerWidth;
      const ua = navigator.userAgent.toLowerCase();
      
      // Detectar User Agent móvil
      const isMobileUA = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
      const isTabletUA = /ipad|android(?!.*mobile)|tablet/i.test(ua);
      
      // Detectar capacidades touch
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Lógica híbrida de detección
      let isMobile = false;
      let isTablet = false;
      let isDesktop = false;
      
      // Prioridad 1: User Agent móvil siempre es móvil (incluso en landscape)
      if (isMobileUA) {
        isMobile = true;
      }
      // Prioridad 2: User Agent tablet es tablet
      else if (isTabletUA) {
        isTablet = true;
      }
      // Prioridad 3: Ancho + touch para detectar tablets sin UA específico
      else if (width >= 768 && width <= 1024 && hasTouch) {
        isTablet = true;
      }
      // Prioridad 4: Ancho pequeño + touch = móvil
      else if (width < 768 && hasTouch) {
        isMobile = true;
      }
      // Default: Desktop
      else {
        isDesktop = true;
      }
      
      setDevice({
        isMobile,
        isTablet,
        isDesktop,
        hasTouch,
        screenWidth: width,
        userAgent: ua
      });
    };
    
    detectDevice();
    
    window.addEventListener('resize', detectDevice);
    window.addEventListener('orientationchange', detectDevice);
    
    return () => {
      window.removeEventListener('resize', detectDevice);
      window.removeEventListener('orientationchange', detectDevice);
    };
  }, []);

  return device;
}
