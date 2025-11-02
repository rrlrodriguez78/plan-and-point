import { useState, useEffect, useCallback } from 'react';
import { Workbox } from 'workbox-window';

interface PWAUpdateOptions {
  autoUpdate: boolean;
  autoUpdateDelay: number;
  showBrowserNotification: boolean;
  checkInterval: number;
}

export function usePWAUpdate(options?: Partial<PWAUpdateOptions>) {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [wb, setWb] = useState<Workbox | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [countdownInterval, setCountdownInterval] = useState<NodeJS.Timeout | null>(null);

  const defaultOptions: PWAUpdateOptions = {
    autoUpdate: options?.autoUpdate ?? false,
    autoUpdateDelay: options?.autoUpdateDelay ?? 30000,
    showBrowserNotification: options?.showBrowserNotification ?? false,
    checkInterval: options?.checkInterval ?? 3600000,
  };

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return Notification.permission === 'granted';
  }, []);

  // Show browser notification
  const showUpdateNotification = useCallback((autoUpdate: boolean, delay: number) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('¡Nueva versión disponible!', {
        body: autoUpdate 
          ? `La app se actualizará en ${delay / 1000} segundos`
          : 'Haz clic para actualizar',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        requireInteraction: !autoUpdate,
        tag: 'pwa-update',
      });

      notification.onclick = () => {
        if (!autoUpdate) {
          updateNow();
        }
        notification.close();
      };
    }
  }, []);

  // Start auto-update countdown
  const startAutoUpdateCountdown = useCallback((delay: number) => {
    setCountdown(delay);
    
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1000) {
          clearInterval(interval);
          // Trigger update
          if (wb) {
            wb.addEventListener('controlling', () => {
              window.location.reload();
            });
            wb.messageSkipWaiting();
          }
          return null;
        }
        return prev - 1000;
      });
    }, 1000);

    setCountdownInterval(interval);
    return interval;
  }, [wb]);

  // Cancel auto-update
  const cancelAutoUpdate = useCallback(() => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      setCountdownInterval(null);
      setCountdown(null);
    }
  }, [countdownInterval]);

  // Initialize Workbox
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      const swPath = import.meta.env.MODE === 'production' ? '/sw.js' : '/dev-sw.js?dev-sw';
      const workbox = new Workbox(swPath, { 
        scope: '/',
        type: 'module' 
      });

      workbox.addEventListener('installed', async (event) => {
        if (event.isUpdate) {
          console.log('🔄 New service worker installed, update available');
          setNeedRefresh(true);

          // Request notification permission if enabled
          if (defaultOptions.showBrowserNotification) {
            const granted = await requestNotificationPermission();
            if (granted) {
              showUpdateNotification(defaultOptions.autoUpdate, defaultOptions.autoUpdateDelay);
            }
          }

          // Start auto-update countdown if enabled
          if (defaultOptions.autoUpdate) {
            if (defaultOptions.autoUpdateDelay === 0) {
              // Immediate silent update without countdown or banner
              console.log('[PWA] Auto-update enabled with 0 delay, updating immediately');
              setTimeout(() => updateNow(), 100); // Small delay to ensure SW is ready
            } else {
              startAutoUpdateCountdown(defaultOptions.autoUpdateDelay);
            }
          }
        } else {
          console.log('✅ Service worker installed for the first time');
          setOfflineReady(true);
        }
      });

      workbox.addEventListener('activated', () => {
        console.log('✅ Service worker activated');
      });

      workbox.addEventListener('waiting', () => {
        console.log('⏳ New service worker waiting');
        setNeedRefresh(true);
      });

      workbox.register().catch((error) => {
        console.error('❌ Service worker registration failed:', error);
        if (error.message && error.message.includes('MIME')) {
          console.warn('⚠️ Service Worker MIME type issue - this is expected in dev mode');
        }
      });

      setWb(workbox);

      // Check for updates periodically
      const interval = setInterval(() => {
        workbox.update();
      }, defaultOptions.checkInterval);

      return () => {
        clearInterval(interval);
        if (countdownInterval) {
          clearInterval(countdownInterval);
        }
      };
    }
  }, []);

  const close = useCallback(() => {
    setOfflineReady(false);
    setNeedRefresh(false);
    cancelAutoUpdate();
  }, [cancelAutoUpdate]);

  const updateNow = useCallback(async () => {
    cancelAutoUpdate();
    if (wb) {
      // Tell the waiting service worker to skip waiting and activate
      wb.addEventListener('controlling', () => {
        window.location.reload();
      });
      
      // Send skip waiting message
      wb.messageSkipWaiting();
    }
  }, [wb, cancelAutoUpdate]);

  return {
    needRefresh,
    offlineReady,
    updateNow,
    close,
    countdown,
    cancelAutoUpdate,
  };
}
