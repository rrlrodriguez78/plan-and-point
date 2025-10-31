import { useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface ToastUpdateNotificationProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

export function ToastUpdateNotification({ onUpdate, onDismiss }: ToastUpdateNotificationProps) {
  useEffect(() => {
    toast.info('Nueva versión disponible', {
      description: 'Hay una actualización disponible para la aplicación',
      duration: Infinity,
      action: (
        <Button
          size="sm"
          onClick={() => {
            onUpdate();
            toast.dismiss();
          }}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Recargar
        </Button>
      ),
      onDismiss: onDismiss,
      onAutoClose: onDismiss,
    });

    return () => { toast.dismiss(); };
  }, [onUpdate, onDismiss]);

  return null;
}
