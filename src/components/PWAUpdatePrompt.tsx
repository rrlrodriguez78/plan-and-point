import { useEffect } from 'react';
import { useUserSettingsContext } from '@/contexts/UserSettingsContext';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { AutoUpdateBanner } from './PWAUpdatePrompt/AutoUpdateBanner';
import { ToastUpdateNotification } from './PWAUpdatePrompt/ToastUpdateNotification';
import { OfflineReadyToast } from './PWAUpdatePrompt/OfflineReadyToast';

export function PWAUpdatePrompt() {
  const { settings } = useUserSettingsContext();
  const { 
    needRefresh, 
    offlineReady, 
    updateNow, 
    close, 
    countdown,
    cancelAutoUpdate 
  } = usePWAUpdate({
    autoUpdate: settings.pwa_auto_update,
    autoUpdateDelay: settings.pwa_auto_update_delay,
    showBrowserNotification: settings.pwa_browser_notifications,
    checkInterval: settings.pwa_check_interval,
  });

  // Decidir qué UI mostrar
  const showBanner = needRefresh && settings.pwa_auto_update && countdown !== null;
  const showToast = needRefresh && !settings.pwa_auto_update;

  // Add/remove class to body when banner is visible
  useEffect(() => {
    if (showBanner) {
      document.body.classList.add('has-update-banner');
    } else {
      document.body.classList.remove('has-update-banner');
    }
    
    return () => {
      document.body.classList.remove('has-update-banner');
    };
  }, [showBanner]);

  return (
    <>
      {/* Banner prominente para auto-update */}
      {showBanner && (
        <AutoUpdateBanner 
          countdown={countdown}
          autoUpdateDelay={settings.pwa_auto_update_delay}
          onUpdate={updateNow}
          onCancel={() => {
            cancelAutoUpdate();
            close();
          }}
        />
      )}
      
      {/* Toast discreto para manual update */}
      {showToast && (
        <ToastUpdateNotification 
          onUpdate={updateNow}
          onDismiss={close}
        />
      )}
      
      {/* Notificación de offline ready (siempre toast) */}
      {offlineReady && <OfflineReadyToast />}
    </>
  );
}
