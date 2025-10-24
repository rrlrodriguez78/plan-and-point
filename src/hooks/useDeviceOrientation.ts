import { useState, useEffect } from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  shouldShowOrientationWarning: boolean;
}

export function useDeviceOrientation(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isPortrait: false,
    isLandscape: true,
    shouldShowOrientationWarning: false
  });

  useEffect(() => {
    const checkDeviceAndOrientation = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Detectar tipo de dispositivo
      const isMobile = width < 768;
      const isTablet = width >= 768 && width <= 1024;
      const isDesktop = width > 1024;
      
      // Detectar orientación
      const isPortrait = height > width;
      const isLandscape = width > height;
      
      // Determinar si mostrar advertencia
      const shouldShowOrientationWarning = (isMobile || isTablet) && isPortrait;
      
      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        isPortrait,
        isLandscape,
        shouldShowOrientationWarning
      });
    };
    
    // Ejecutar al montar
    checkDeviceAndOrientation();
    
    // Escuchar cambios de tamaño y orientación
    window.addEventListener('resize', checkDeviceAndOrientation);
    window.addEventListener('orientationchange', checkDeviceAndOrientation);
    
    return () => {
      window.removeEventListener('resize', checkDeviceAndOrientation);
      window.removeEventListener('orientationchange', checkDeviceAndOrientation);
    };
  }, []);

  return deviceInfo;
}
