import { useState, useEffect } from 'react';

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
      
      // Función para forzar landscape con CSS (fallback)
      const forceLandscapeWithCSS = (): boolean => {
        if (!isMobile) return false;
        
        try {
          // Aplicar transformación CSS para simular landscape
          const root = document.documentElement;
          root.style.transform = 'rotate(90deg)';
          root.style.transformOrigin = 'center center';
          root.style.width = '100vh';
          root.style.height = '100vw';
          root.style.overflow = 'hidden';
          root.style.position = 'fixed';
          root.style.top = '0';
          root.style.left = '0';
          
          console.log('🔄 Orientación forzada con CSS');
          return true;
        } catch (error) {
          console.error('❌ Error aplicando CSS fallback:', error);
          return false;
        }
      };
      
      // Función para bloquear en landscape con múltiples estrategias
      const lockLandscape = async (): Promise<boolean> => {
        console.log('🔄 Intentando bloquear orientación...');
        console.log('   - isStandalone:', isStandalone);
        console.log('   - screen.orientation:', screen.orientation);
        
        // Si NO es standalone, no intentar bloquear
        if (!isStandalone) {
          console.log('⚠️ No es PWA instalada, no se puede bloquear orientación');
          return false;
        }
        
        try {
          // Estrategia 1: Lock directo con 'landscape'
          if (screen.orientation && 'lock' in screen.orientation) {
            await (screen.orientation as any).lock('landscape');
            console.log('✅ Orientación bloqueada en landscape (API nativa)');
            return true;
          }
        } catch (error) {
          console.log('❌ API nativa falló, intentando fallback CSS:', error);
          // Imprimir detalles del error
          if (error instanceof Error) {
            console.log('   Error name:', error.name);
            console.log('   Error message:', error.message);
          }
        }
        
        try {
          // Estrategia 2: Intentar con landscape-primary
          if (screen.orientation && 'lock' in screen.orientation) {
            await (screen.orientation as any).lock('landscape-primary');
            console.log('✅ Orientación bloqueada en landscape-primary (API nativa)');
            return true;
          }
        } catch (error) {
          console.log('❌ landscape-primary también falló:', error);
        }
        
        // Estrategia 3: Fallback con CSS
        console.log('⚠️ Screen Orientation API no funcionó, usando CSS fallback');
        return forceLandscapeWithCSS();
      };
      
      // Función para desbloquear orientación
      const unlockOrientation = () => {
        try {
          // Revertir transformación CSS si existe
          const root = document.documentElement;
          if (root.style.transform) {
            root.style.transform = '';
            root.style.transformOrigin = '';
            root.style.width = '';
            root.style.height = '';
            root.style.overflow = '';
            root.style.position = '';
            root.style.top = '';
            root.style.left = '';
            console.log('✅ CSS transform revertido');
          }
          
          // Desbloquear API nativa si está disponible
          if (screen.orientation && 'unlock' in screen.orientation) {
            (screen.orientation as any).unlock();
            console.log('✅ Orientación desbloqueada (API nativa)');
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
  }, []);

  return deviceInfo;
}
