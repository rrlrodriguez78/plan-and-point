import { useEffect } from 'react';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';

export function PWAUpdatePrompt() {
  const { needRefresh, offlineReady, isOnline, updateNow, close } = usePWAUpdate();

  // Show update notification
  useEffect(() => {
    if (needRefresh) {
      toast.info('Nueva versión disponible', {
        description: 'Hay una actualización disponible para la aplicación',
        duration: Infinity,
        action: (
          <Button
            size="sm"
            onClick={() => {
              updateNow();
              toast.dismiss();
            }}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Recargar
          </Button>
        ),
        onDismiss: close,
        onAutoClose: close,
      });
    }
  }, [needRefresh, updateNow, close]);

  // Show offline ready notification
  useEffect(() => {
    if (offlineReady) {
      toast.success('Aplicación lista para uso offline', {
        description: 'La aplicación está lista para funcionar sin conexión',
        duration: 5000,
      });
    }
  }, [offlineReady]);

  // Show online/offline status changes
  useEffect(() => {
    if (!isOnline) {
      toast.error('Sin conexión', {
        description: 'Estás trabajando en modo offline',
        duration: Infinity,
        id: 'offline-status',
        icon: <WifiOff className="h-5 w-5" />,
      });
    } else {
      // Dismiss offline toast when back online
      toast.dismiss('offline-status');
      toast.success('Conexión restaurada', {
        description: 'La conexión a internet se ha restablecido',
        duration: 3000,
        icon: <Wifi className="h-5 w-5" />,
      });
    }
  }, [isOnline]);

  return null;
}
