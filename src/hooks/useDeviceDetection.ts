import { useState, useEffect } from 'react';

export interface DeviceDetection {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
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
    const isTabletUA = /ipad|tablet|playbook|silk/i.test(ua);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    let isMobile = false;
    let isTablet = false;
    let isDesktop = false;
    let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
    
    // Lógica priorizada de detección
    if (isMobileUA && !isTabletUA) {
      // Claramente móvil por User Agent
      isMobile = true;
      deviceType = 'mobile';
    } else if (isTabletUA) {
      // Tablet por User Agent (iPad, Android tablets)
      isTablet = true;
      deviceType = 'tablet';
    } else if (width < 768 && hasTouch) {
      // Pantalla pequeña con touch = móvil
      isMobile = true;
      deviceType = 'mobile';
    } else if (width >= 768 && width <= 1024 && hasTouch) {
      // Tamaño tablet con touch
      isTablet = true;
      deviceType = 'tablet';
    } else if (width < 768) {
      // Pantalla pequeña sin touch confirmado
      isMobile = true;
      deviceType = 'mobile';
    } else if (width <= 1024) {
      // Tamaño tablet sin touch confirmado
      isTablet = true;
      deviceType = 'tablet';
    } else {
      // Desktop
      isDesktop = true;
      deviceType = 'desktop';
    }
    
    return {
      isMobile,
      isTablet,
      isDesktop,
      deviceType,
      hasTouch,
      screenWidth: width,
      userAgent: ua
    };
  });

  useEffect(() => {
    const detectDevice = () => {
      const width = window.innerWidth;
      const ua = navigator.userAgent.toLowerCase();
      
      // Detectar User Agent
      const isMobileUA = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
      const isTabletUA = /ipad|tablet|playbook|silk/i.test(ua);
      
      // Detectar capacidades touch
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      // Lógica híbrida de detección con prioridades
      let isMobile = false;
      let isTablet = false;
      let isDesktop = false;
      let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
      
      // Prioridad 1: User Agent móvil (sin ser tablet) siempre es móvil
      if (isMobileUA && !isTabletUA) {
        isMobile = true;
        deviceType = 'mobile';
      }
      // Prioridad 2: User Agent tablet es tablet (iPad, Android tablets)
      else if (isTabletUA) {
        isTablet = true;
        deviceType = 'tablet';
      }
      // Prioridad 3: Ancho pequeño + touch = móvil
      else if (width < 768 && hasTouch) {
        isMobile = true;
        deviceType = 'mobile';
      }
      // Prioridad 4: Ancho medio + touch = tablet
      else if (width >= 768 && width <= 1024 && hasTouch) {
        isTablet = true;
        deviceType = 'tablet';
      }
      // Prioridad 5: Solo por ancho (fallback sin touch)
      else if (width < 768) {
        isMobile = true;
        deviceType = 'mobile';
      }
      else if (width <= 1024) {
        isTablet = true;
        deviceType = 'tablet';
      }
      // Default: Desktop
      else {
        isDesktop = true;
        deviceType = 'desktop';
      }
      
      setDevice({
        isMobile,
        isTablet,
        isDesktop,
        deviceType,
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
