import { useEffect } from 'react';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, X } from 'lucide-react';
import { useUserSettingsContext } from '@/contexts/UserSettingsContext';

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

  // Show update notification
  useEffect(() => {
    if (needRefresh) {
      const countdownSeconds = countdown ? Math.ceil(countdown / 1000) : null;
      
      toast.info('Nueva versión disponible', {
        description: countdown 
          ? `Actualizando automáticamente en ${countdownSeconds}s`
          : 'Hay una actualización disponible para la aplicación',
        duration: countdown ? countdown : Infinity,
        action: (
          <div className="flex gap-2">
            {countdown && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  cancelAutoUpdate();
                  toast.dismiss();
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                updateNow();
                toast.dismiss();
              }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              {countdown ? 'Actualizar ahora' : 'Recargar'}
            </Button>
          </div>
        ),
        onDismiss: close,
        onAutoClose: close,
      });
    }
  }, [needRefresh, countdown, updateNow, close, cancelAutoUpdate]);

  // Update countdown in existing toast
  useEffect(() => {
    if (countdown !== null && needRefresh) {
      const countdownSeconds = Math.ceil(countdown / 1000);
      const progress = ((settings.pwa_auto_update_delay - countdown) / settings.pwa_auto_update_delay) * 100;
      
      // Update toast description with countdown
      toast.info('Nueva versión disponible', {
        id: 'pwa-update',
        description: (
          <div className="space-y-2">
            <p>Actualizando automáticamente en {countdownSeconds}s</p>
            <Progress value={progress} className="h-1" />
          </div>
        ),
        duration: countdown,
        action: (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                cancelAutoUpdate();
                toast.dismiss('pwa-update');
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                updateNow();
                toast.dismiss('pwa-update');
              }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar ahora
            </Button>
          </div>
        ),
      });
    }
  }, [countdown, needRefresh, updateNow, cancelAutoUpdate, settings.pwa_auto_update_delay]);

  // Show offline ready notification
  useEffect(() => {
    if (offlineReady) {
      toast.success('Aplicación lista para uso offline', {
        description: 'La aplicación está lista para funcionar sin conexión',
        duration: 5000,
      });
    }
  }, [offlineReady]);

  return null;
}
