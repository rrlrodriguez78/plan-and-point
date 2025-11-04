import { useEffect, useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CacheStatusWidget } from '@/components/shared/CacheStatusWidget';
import { OfflineStorageWidget } from '@/components/shared/OfflineStorageWidget';
import { SettingsStatusWidget } from '@/components/settings/SettingsStatusWidget';
import { OfflineQuickStart } from '@/components/shared/OfflineQuickStart';
import { StorageDiagnostic } from '@/components/shared/StorageDiagnostic';
import { OfflineTutorialDialog } from '@/components/shared/OfflineTutorialDialog';
import { useHybridStorage } from '@/hooks/useHybridStorage';
import { useTourSync } from '@/hooks/useTourSync';
import { WifiOff, RefreshCw, Shield, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const SystemStatus = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { currentTenant } = useTenant();
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  
  const { isNativeApp, hasPermission, requestPermissions } = useHybridStorage();
  const { pendingCount, isSyncing, syncProgress, syncNow } = useTourSync();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
              <Activity className="w-10 h-10 text-primary" />
              Estado del Sistema
            </h1>
            <p className="text-muted-foreground">
              Información de sincronización, almacenamiento y estado offline
            </p>
          </div>
        </div>

        {/* Offline Status Banner */}
        {!isOnline && (
          <Alert className="mb-6 border-orange-500/50 bg-orange-500/10">
            <WifiOff className="w-4 h-4 text-orange-500" />
            <AlertDescription>
              <strong>Sin conexión a Internet</strong>
              <p className="text-sm text-muted-foreground mt-1">
                Puedes seguir creando tours. Se sincronizarán automáticamente cuando vuelva la conexión.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Pending Tours Sync Banner */}
        {pendingCount > 0 && (
          <Alert className="mb-6 border-blue-500/50 bg-blue-500/10">
            <RefreshCw className={`w-4 h-4 text-blue-500 ${isSyncing ? 'animate-spin' : ''}`} />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <strong>{pendingCount} {pendingCount === 1 ? 'tour sin sincronizar' : 'tours sin sincronizar'}</strong>
                <p className="text-sm text-muted-foreground mt-1">
                  {isSyncing 
                    ? `Sincronizando... ${syncProgress}%` 
                    : 'Se subirán automáticamente cuando tengas internet'
                  }
                </p>
              </div>
              {isOnline && !isSyncing && (
                <Button onClick={syncNow} size="sm" variant="outline">
                  Sincronizar Ahora
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Permission Banner (Mobile only) */}
        {isNativeApp && !hasPermission && (
          <Alert className="mb-6">
            <Shield className="w-4 h-4" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <strong>Almacenamiento Nativo Disponible</strong>
                <p className="text-sm text-muted-foreground mt-1">
                  Concede permisos para trabajar offline sin límites de espacio
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <Button onClick={requestPermissions} size="sm">
                  Conceder Permisos
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Info Widgets Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
          <CacheStatusWidget />
          <OfflineStorageWidget />
          <SettingsStatusWidget />
          <OfflineQuickStart onOpenTutorial={() => setTutorialOpen(true)} />
        </div>
        
        {/* Storage Diagnostic */}
        <div className="mb-6">
          <StorageDiagnostic />
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>
              Gestiona el almacenamiento y sincronización
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => navigate('/app/offline-cache')}
            >
              Gestor de Caché Offline
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start"
              onClick={() => setTutorialOpen(true)}
            >
              Ver Tutorial Offline
            </Button>
            {isOnline && pendingCount > 0 && (
              <Button 
                variant="default" 
                className="w-full justify-start"
                onClick={syncNow}
                disabled={isSyncing}
              >
                {isSyncing ? 'Sincronizando...' : 'Forzar Sincronización'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <OfflineTutorialDialog 
        open={tutorialOpen} 
        onOpenChange={setTutorialOpen} 
      />
    </div>
  );
};

export default SystemStatus;
