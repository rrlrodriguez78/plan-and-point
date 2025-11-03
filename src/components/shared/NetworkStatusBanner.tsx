import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, Wifi, Loader2, CheckCircle2 } from 'lucide-react';
import { useOfflineSync } from '@/hooks/useOfflineSync';

export const NetworkStatusBanner = () => {
  const { isOnline, isSyncing, pendingCount } = useOfflineSync();
  const [showBanner, setShowBanner] = useState(false);
  const [bannerType, setBannerType] = useState<'offline' | 'syncing' | 'online'>('online');

  useEffect(() => {
    if (!isOnline) {
      setBannerType('offline');
      setShowBanner(true);
    } else if (isSyncing && pendingCount > 0) {
      setBannerType('syncing');
      setShowBanner(true);
    } else if (pendingCount === 0 && bannerType === 'syncing') {
      setBannerType('online');
      setShowBanner(true);
      // Auto-ocultar después de 3 segundos
      setTimeout(() => setShowBanner(false), 3000);
    } else {
      setShowBanner(false);
    }
  }, [isOnline, isSyncing, pendingCount, bannerType]);

  if (!showBanner) return null;

  return (
    <Alert 
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-auto max-w-md shadow-lg ${
        bannerType === 'offline' 
          ? 'bg-destructive text-destructive-foreground border-destructive' 
          : bannerType === 'syncing'
          ? 'bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800'
          : 'bg-green-50 dark:bg-green-950 text-green-900 dark:text-green-100 border-green-200 dark:border-green-800'
      }`}
    >
      {bannerType === 'offline' && (
        <>
          <WifiOff className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            <span className="font-semibold">Sin conexión</span>
            <span className="text-sm">Las fotos se guardarán localmente</span>
          </AlertDescription>
        </>
      )}
      
      {bannerType === 'syncing' && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertDescription className="flex items-center gap-2">
            <span className="font-semibold">Sincronizando</span>
            <span className="text-sm">{pendingCount} foto(s) pendiente(s)</span>
          </AlertDescription>
        </>
      )}
      
      {bannerType === 'online' && (
        <>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            <span className="font-semibold">Conectado</span>
            <span className="text-sm">Todo sincronizado</span>
          </AlertDescription>
        </>
      )}
    </Alert>
  );
};
