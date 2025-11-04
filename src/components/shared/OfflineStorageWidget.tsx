import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { HardDrive, Database } from 'lucide-react';
import { useHybridStorage } from '@/hooks/useHybridStorage';
import { useEffect, useState } from 'react';

export function OfflineStorageWidget() {
  const { stats, isLoadingStats, usingNativeStorage } = useHybridStorage();
  const [usagePercentage, setUsagePercentage] = useState(0);

  useEffect(() => {
    if (stats.limit > 0) {
      setUsagePercentage((stats.size / stats.limit) * 100);
    }
  }, [stats]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (isLoadingStats) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Almacenamiento Offline</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {usingNativeStorage ? (
              <HardDrive className="w-4 h-4 text-blue-500" />
            ) : (
              <Database className="w-4 h-4 text-purple-500" />
            )}
            <CardTitle className="text-base">Almacenamiento Offline</CardTitle>
          </div>
        </div>
        <CardDescription className="text-xs">
          {usingNativeStorage ? 'Almacenamiento Nativo' : 'IndexedDB (Navegador)'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Storage Stats */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tours descargados</span>
            <span className="font-medium">{stats.count}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Espacio usado</span>
            <span className="font-medium">{formatBytes(stats.size)}</span>
          </div>
          
          {stats.limit > 0 && (
            <>
              <Progress value={usagePercentage} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Disponible: {formatBytes(stats.availableSpace || 0)}</span>
                <span>{usagePercentage.toFixed(0)}% usado</span>
              </div>
            </>
          )}
        </div>

        {/* Warning if storage is getting full */}
        {usagePercentage > 80 && (
          <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900 rounded-lg p-2">
            <p className="text-xs text-orange-800 dark:text-orange-200">
              ⚠️ Almacenamiento casi lleno. Considera eliminar tours antiguos.
            </p>
          </div>
        )}

        {/* Info about storage type */}
        <div className="bg-muted/50 rounded-lg p-2">
          <p className="text-xs text-muted-foreground">
            {usingNativeStorage 
              ? '✓ Usando almacenamiento nativo del dispositivo - Sin límites artificiales'
              : '⚡ Usando almacenamiento del navegador - Límite configurable en ajustes'
            }
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
