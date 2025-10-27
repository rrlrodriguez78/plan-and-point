import { useState, useEffect, useCallback } from 'react';
import { Workbox } from 'workbox-window';

export function usePWAUpdate() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [wb, setWb] = useState<Workbox | null>(null);

  // Initialize Workbox
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      const workbox = new Workbox('/sw.js', { scope: '/' });

      workbox.addEventListener('installed', (event) => {
        if (event.isUpdate) {
          console.log('🔄 New service worker installed, update available');
          setNeedRefresh(true);
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
      });

      setWb(workbox);

      // Check for updates periodically
      const interval = setInterval(() => {
        workbox.update();
      }, 60 * 60 * 1000); // Check every hour

      return () => {
        clearInterval(interval);
      };
    }
  }, []);

  // Online/Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('🌐 Connection restored');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      console.log('📴 Connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const close = useCallback(() => {
    setOfflineReady(false);
    setNeedRefresh(false);
  }, []);

  const updateNow = useCallback(async () => {
    if (wb) {
      // Tell the waiting service worker to skip waiting and activate
      wb.addEventListener('controlling', () => {
        window.location.reload();
      });
      
      // Send skip waiting message
      wb.messageSkipWaiting();
    }
  }, [wb]);

  return {
    needRefresh,
    offlineReady,
    isOnline,
    updateNow,
    close,
  };
}
