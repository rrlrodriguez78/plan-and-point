import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  HardDrive, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Settings,
  FolderOpen
} from 'lucide-react';
import { useHybridStorage } from '@/hooks/useHybridStorage';
import { debugStorageSetup } from '@/utils/nativeFileStorage';
import { toast } from 'sonner';

export function StorageDiagnostic() {
  const {
    isNativeApp,
    hasPermission,
    stats,
    usingNativeStorage,
    requestPermissions,
    openSettings,
    refreshStats
  } = useHybridStorage();

  const [debugInfo, setDebugInfo] = useState<{
    isNative: boolean;
    hasPermissions: boolean;
    storageDirectory: string;
    basePath: string;
    fullPath: string;
    foldersCreated: boolean;
    error?: string;
  } | null>(null);

  const [isDebugging, setIsDebugging] = useState(false);

  const runDiagnostic = async () => {
    setIsDebugging(true);
    try {
      const info = await debugStorageSetup();
      setDebugInfo(info);
      
      if (info.foldersCreated) {
        toast.success('✅ Carpetas de almacenamiento verificadas correctamente');
      } else if (info.error) {
        toast.error(`❌ Error: ${info.error}`);
      } else {
        toast.warning('⚠️ No se pudieron crear las carpetas');
      }
    } catch (error) {
      toast.error('Error al ejecutar diagnóstico');
      console.error(error);
    } finally {
      setIsDebugging(false);
    }
  };

  useEffect(() => {
    if (isNativeApp && hasPermission) {
      runDiagnostic();
    }
  }, [isNativeApp, hasPermission]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5" />
          <CardTitle>Diagnóstico de Almacenamiento</CardTitle>
        </div>
        <CardDescription>
          Estado del sistema de almacenamiento nativo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estado de la plataforma */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Plataforma Nativa</span>
          {isNativeApp ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Activo
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <XCircle className="h-3 w-3" />
              Web
            </Badge>
          )}
        </div>

        {/* Estado de permisos */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Permisos de Almacenamiento</span>
          {hasPermission ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Concedidos
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Sin permisos
            </Badge>
          )}
        </div>

        {/* Tipo de almacenamiento activo */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Tipo de Almacenamiento</span>
          <Badge variant={usingNativeStorage ? "default" : "secondary"}>
            {usingNativeStorage ? 'Filesystem Nativo' : 'IndexedDB (Temporal)'}
          </Badge>
        </div>

        {/* Información de debug */}
        {debugInfo && isNativeApp && (
          <>
            <div className="border-t pt-4 space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Rutas de Almacenamiento
              </h4>
              
              <div className="bg-muted p-3 rounded-md space-y-1 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">Ruta completa:</span>
                  <div className="text-foreground break-all">{debugInfo.fullPath}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Base path:</span>
                  <div className="text-foreground">{debugInfo.basePath}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Directory:</span>
                  <div className="text-foreground">{debugInfo.storageDirectory}</div>
                </div>
              </div>

              {debugInfo.foldersCreated ? (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Carpetas verificadas correctamente
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  No se pudieron crear las carpetas
                </div>
              )}

              {debugInfo.error && (
                <div className="bg-destructive/10 p-2 rounded text-xs text-destructive">
                  Error: {debugInfo.error}
                </div>
              )}
            </div>
          </>
        )}

        {/* Estadísticas de tours */}
        <div className="border-t pt-4 space-y-2">
          <h4 className="text-sm font-semibold">Tours Descargados</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Total:</span>
              <span className="ml-2 font-medium">{stats.count}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Tamaño:</span>
              <span className="ml-2 font-medium">{formatBytes(stats.size)}</span>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="border-t pt-4 space-y-2">
          {!hasPermission && isNativeApp && (
            <Button 
              onClick={requestPermissions} 
              className="w-full"
              variant="default"
            >
              <Settings className="h-4 w-4 mr-2" />
              Solicitar Permisos
            </Button>
          )}

          <Button
            onClick={runDiagnostic}
            disabled={isDebugging || !isNativeApp}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isDebugging ? 'animate-spin' : ''}`} />
            Verificar Carpetas
          </Button>

          {hasPermission && !debugInfo?.foldersCreated && (
            <Button
              onClick={openSettings}
              variant="destructive"
              className="w-full"
            >
              <Settings className="h-4 w-4 mr-2" />
              Ir a Ajustes del Sistema
            </Button>
          )}

          <Button
            onClick={refreshStats}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar Estadísticas
          </Button>
        </div>

        {/* Información adicional */}
        {!isNativeApp && (
          <div className="bg-muted p-3 rounded-md text-xs text-muted-foreground">
            💡 Este diagnóstico solo funciona en la app nativa móvil. 
            En navegador web se usa IndexedDB.
          </div>
        )}

        {isNativeApp && !hasPermission && (
          <div className="bg-yellow-500/10 p-3 rounded-md text-xs text-yellow-600 dark:text-yellow-400">
            ⚠️ La app necesita permisos de almacenamiento para guardar tours offline en tu dispositivo.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
