import { useEffect } from 'react';
import { toast } from 'sonner';

export function OfflineReadyToast() {
  useEffect(() => {
    toast.success('Aplicación lista para uso offline', {
      description: 'La aplicación está lista para funcionar sin conexión',
      duration: 5000,
    });
  }, []);

  return null;
}
