import { useEffect } from 'react';
import { usePWAUpdate } from '@/hooks/usePWAUpdate';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function PWAUpdatePrompt() {
  const { needRefresh, offlineReady, updateNow, close } = usePWAUpdate();

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

  // Online/offline status tracking disabled to avoid intrusive notifications

  return null;
}
