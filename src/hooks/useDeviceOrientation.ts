import { useState, useEffect } from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  shouldShowOrientationWarning: boolean;
  lockLandscape: () => Promise<boolean>;
  unlockOrientation: () => void;
  orientation: string | null;
}

export function useDeviceOrientation(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isPortrait: false,
    isLandscape: true,
    shouldShowOrientationWarning: false,
    lockLandscape: async () => false,
    unlockOrientation: () => {},
    orientation: null
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
      
      // Determinar si mostrar advertencia - EXCLUIR tablets
      const shouldShowOrientationWarning = isMobile && isPortrait;
      
      // Obtener orientación actual del navegador
      const orientation = (screen.orientation?.type || 'unknown') as string;
      
      // Función para bloquear en landscape
      const lockLandscape = async (): Promise<boolean> => {
        try {
          if (screen.orientation && 'lock' in screen.orientation) {
            await (screen.orientation as any).lock('landscape');
            console.log('✅ Orientación bloqueada en landscape');
            return true;
          } else {
            console.log('⚠️ Screen Orientation API no soportada');
            return false;
          }
        } catch (error) {
          console.log('⚠️ No se pudo bloquear orientación:', error);
          return false;
        }
      };
      
      // Función para desbloquear orientación
      const unlockOrientation = () => {
        try {
          if (screen.orientation && 'unlock' in screen.orientation) {
            (screen.orientation as any).unlock();
            console.log('✅ Orientación desbloqueada');
          }
        } catch (error) {
          console.log('⚠️ Error al desbloquear orientación:', error);
        }
      };
      
      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        isPortrait,
        isLandscape,
        shouldShowOrientationWarning,
        lockLandscape,
        unlockOrientation,
        orientation
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
