import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { HardDrive, ArrowRight, RefreshCw, AlertTriangle } from 'lucide-react';
import { useResourceMonitor } from '@/hooks/useResourceMonitor';
import { tourOfflineCache } from '@/utils/tourOfflineCache';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export function CacheStatusWidget() {
  const navigate = useNavigate();
  const { 
    cacheSize, 
    cacheUsagePercentage, 
    cachedToursCount, 
    isNearLimit, 
    isAtLimit,
    isLoading: statsLoading,
    refresh 
  } = useResourceMonitor(10000); // Refresh cada 10s
  
  const [cacheInfo, setCacheInfo] = useState({
    toursCount: 0,
    totalSize: 0,
    imagesCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadCacheInfo = async () => {
    try {
      const [tours, size] = await Promise.all([
        tourOfflineCache.getAllCachedTours(),
        tourOfflineCache.getCacheSize(),
      ]);

      const imagesCount = tours.reduce(
        (acc, tour) => acc + tour.floorPlanImages.size,
        0
      );

      setCacheInfo({
        toursCount: tours.length,
        totalSize: size,
        imagesCount,
      });
    } catch (error) {
      console.error('Error loading cache info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCacheInfo();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleCleanExpired = async () => {
    try {
      await tourOfflineCache.cleanExpiredTours();
      toast.success('Tours expirados eliminados');
      await Promise.all([loadCacheInfo(), refresh()]);
    } catch (error) {
      console.error('Error cleaning expired tours:', error);
      toast.error('Error al limpiar caché');
    }
  };

  if (isLoading || statsLoading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center h-48">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Caché Offline
            {isAtLimit && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                Lleno
              </Badge>
            )}
            {isNearLimit && !isAtLimit && (
              <Badge variant="secondary" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                Casi lleno
              </Badge>
            )}
          </div>
          {cacheInfo.toursCount > 0 && (
            <Badge variant="secondary">{cacheInfo.toursCount}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(isNearLimit || isAtLimit) && (
          <Alert variant={isAtLimit ? "destructive" : "default"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {isAtLimit 
                ? 'Caché lleno. Elimina tours antiguos para liberar espacio.'
                : 'Caché cerca del límite. Considera limpiar tours antiguos.'
              }
            </AlertDescription>
          </Alert>
        )}
        {cacheInfo.toursCount === 0 ? (
          <div className="text-center py-6">
            <HardDrive className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              No hay tours en caché
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/app/tours')}
            >
              Preparar tours
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Espacio usado</span>
                <span className="font-semibold">{formatBytes(cacheSize)}</span>
              </div>
              <Progress 
                value={cacheUsagePercentage} 
                className={`h-2 ${isAtLimit ? '[&>div]:bg-destructive' : isNearLimit ? '[&>div]:bg-yellow-500' : ''}`} 
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{Math.round(cacheUsagePercentage)}% usado</span>
                <span>Límite: 100MB</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-xl font-bold">{cacheInfo.toursCount}</div>
                <div className="text-xs text-muted-foreground">Tours</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-xl font-bold">{cacheInfo.imagesCount}</div>
                <div className="text-xs text-muted-foreground">Imágenes</div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleCleanExpired}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Limpiar
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => navigate('/app/offline-cache')}
              >
                Ver todo
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
