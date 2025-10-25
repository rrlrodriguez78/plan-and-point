import { useState, useEffect, useCallback } from 'react';

interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isPortrait: boolean;
  isLandscape: boolean;
  shouldShowOrientationWarning: boolean;
  isStandalone: boolean;
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
    isStandalone: false,
    lockLandscape: async () => false,
    unlockOrientation: () => {},
    orientation: null
  });

  // Función para bloquear en landscape (estabilizada con useCallback)
  const lockLandscape = useCallback(async (): Promise<boolean> => {
    console.log('🔄 Intentando bloquear orientación...');
    console.log('   - isStandalone:', deviceInfo.isStandalone);
    console.log('   - screen.orientation:', screen.orientation);
    
    if (!deviceInfo.isStandalone) {
      console.log('⚠️ No es PWA instalada, no se puede bloquear orientación');
      return false;
    }
    
    // Verificar si la API está disponible
    if (!screen.orientation || !('lock' in screen.orientation)) {
      console.log('⚠️ Screen Orientation API no disponible');
      return false;
    }
    
    try {
      // Intentar lock con 'landscape'
      await (screen.orientation as any).lock('landscape');
      console.log('✅ Orientación bloqueada en landscape');
      return true;
    } catch (error) {
      console.log('❌ Error al bloquear orientación:', error);
      if (error instanceof Error) {
        console.log('   Error name:', error.name);
        console.log('   Error message:', error.message);
      }
      return false;
    }
  }, [deviceInfo.isStandalone]);
  
  // Función para desbloquear orientación (estabilizada con useCallback)
  const unlockOrientation = useCallback(() => {
    try {
      if (screen.orientation && 'unlock' in screen.orientation) {
        (screen.orientation as any).unlock();
        console.log('✅ Orientación desbloqueada');
      }
    } catch (error) {
      console.log('⚠️ Error al desbloquear orientación:', error);
    }
  }, []);

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
      
      // Detección mejorada de standalone para Android
      const isStandalone = 
        // Método estándar
        window.matchMedia('(display-mode: standalone)').matches ||
        // iOS Safari
        (window.navigator as any).standalone === true ||
        // Android WebAPK (más confiable)
        document.referrer.includes('android-app://') ||
        // Android Chrome PWA (detectar si no hay barra de direcciones)
        window.matchMedia('(display-mode: fullscreen)').matches ||
        // Verificar si el user agent indica WebAPK
        /Android.*wv/.test(navigator.userAgent);
      
      // Logs para diagnóstico
      console.log('🔍 Detección de modo:', {
        isStandalone,
        displayMode: window.matchMedia('(display-mode: standalone)').matches,
        fullscreen: window.matchMedia('(display-mode: fullscreen)').matches,
        iosStandalone: (window.navigator as any).standalone,
        referrer: document.referrer,
        userAgent: navigator.userAgent.substring(0, 50)
      });
      
      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        isPortrait,
        isLandscape,
        shouldShowOrientationWarning,
        isStandalone,
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
  }, [lockLandscape, unlockOrientation]);

  return deviceInfo;
}
