import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Navbar } from '@/components/Navbar';
import { 
  HardDrive, 
  Trash2, 
  Download, 
  RefreshCw, 
  Eye,
  Calendar,
  Image as ImageIcon,
  Layers,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { tourOfflineCache } from '@/utils/tourOfflineCache';
import type { Tour, FloorPlan, Hotspot } from '@/types/tour';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CachedTourInfo {
  tour: Tour;
  floorPlans: FloorPlan[];
  hotspots: Hotspot[];
  cachedAt: Date;
  expiresAt: Date;
  imagesCount: number;
}

export default function OfflineCacheManager() {
  const navigate = useNavigate();
  const [cachedTours, setCachedTours] = useState<CachedTourInfo[]>([]);
  const [totalCacheSize, setTotalCacheSize] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tourToDelete, setTourToDelete] = useState<string | null>(null);

  const loadCacheData = async () => {
    setIsLoading(true);
    try {
      const tours = await tourOfflineCache.getAllCachedTours();
      const size = await tourOfflineCache.getCacheSize();
      
      const toursInfo: CachedTourInfo[] = tours.map(cached => ({
        ...cached,
        imagesCount: cached.floorPlanImages.size,
      }));

      setCachedTours(toursInfo);
      setTotalCacheSize(size);
    } catch (error) {
      console.error('Error loading cache data:', error);
      toast.error('Error al cargar datos de caché');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCacheData();
  }, []);

  const handleDeleteTour = async (tourId: string) => {
    try {
      await tourOfflineCache.deleteCachedTour(tourId);
      toast.success('Tour eliminado del caché');
      await loadCacheData();
    } catch (error) {
      console.error('Error deleting tour:', error);
      toast.error('Error al eliminar tour del caché');
    } finally {
      setTourToDelete(null);
    }
  };

  const handleCleanExpired = async () => {
    setIsRefreshing(true);
    try {
      await tourOfflineCache.cleanExpiredTours();
      toast.success('Tours expirados eliminados');
      await loadCacheData();
    } catch (error) {
      console.error('Error cleaning expired tours:', error);
      toast.error('Error al limpiar tours expirados');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRefreshTour = async (tourId: string) => {
    setIsRefreshing(true);
    try {
      if (!navigator.onLine) {
        toast.error('Necesitas conexión a internet para actualizar');
        return;
      }
      
      await tourOfflineCache.downloadTourForOffline(tourId);
      toast.success('Tour actualizado');
      await loadCacheData();
    } catch (error) {
      console.error('Error refreshing tour:', error);
      toast.error('Error al actualizar tour');
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getStoragePercentage = () => {
    const maxStorage = 50 * 1024 * 1024; // 50MB como límite sugerido
    return Math.min((totalCacheSize / maxStorage) * 100, 100);
  };

  const isExpiringSoon = (expiresAt: Date) => {
    const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 1;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 pt-24 pb-12">
          <div className="flex items-center justify-center h-[50vh]">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Cargando caché...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <HardDrive className="w-8 h-8" />
              Gestión de Caché Offline
            </h1>
            <p className="text-muted-foreground mt-2">
              Administra los tours disponibles sin conexión
            </p>
          </div>
          
          <Button
            variant="outline"
            onClick={handleCleanExpired}
            disabled={isRefreshing}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Limpiar Expirados
          </Button>
        </div>

        {/* Storage Overview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5" />
              Espacio de Almacenamiento
            </CardTitle>
            <CardDescription>
              Uso actual del caché local
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Espacio usado</span>
              <span className="text-2xl font-bold">{formatBytes(totalCacheSize)}</span>
            </div>
            
            <Progress value={getStoragePercentage()} className="h-3" />
            
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">{cachedTours.length}</div>
                <div className="text-sm text-muted-foreground">Tours</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {cachedTours.reduce((acc, t) => acc + t.floorPlans.length, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Planos</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold">
                  {cachedTours.reduce((acc, t) => acc + t.imagesCount, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Imágenes</div>
              </div>
            </div>

            {getStoragePercentage() > 80 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  El caché está cerca de su límite. Considera eliminar tours que no uses.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Cached Tours List */}
        {cachedTours.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <HardDrive className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No hay tours en caché</h3>
              <p className="text-muted-foreground mb-6">
                Prepara tours para uso offline desde el Editor
              </p>
              <Button onClick={() => navigate('/app/tours')}>
                Ir a Mis Tours
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {cachedTours.map((cachedTour) => {
              const isExpiring = isExpiringSoon(cachedTour.expiresAt);
              const isExpired = cachedTour.expiresAt < new Date();
              
              return (
                <Card key={cachedTour.tour.id} className="animate-fade-in">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-semibold">{cachedTour.tour.title}</h3>
                          
                          {isExpired ? (
                            <Badge variant="destructive">Expirado</Badge>
                          ) : isExpiring ? (
                            <Badge variant="secondary">Expira pronto</Badge>
                          ) : (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              Activo
                            </Badge>
                          )}

                          {cachedTour.tour.tour_type && (
                            <Badge variant="outline">
                              {cachedTour.tour.tour_type === 'tour_360' ? '🌐 360°' : '📸 Fotos'}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Layers className="w-4 h-4" />
                            <span>{cachedTour.floorPlans.length} planos</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ImageIcon className="w-4 h-4" />
                            <span>{cachedTour.imagesCount} imágenes</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {formatDistanceToNow(cachedTour.cachedAt, { 
                                addSuffix: true, 
                                locale: es 
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Expira {formatDistanceToNow(cachedTour.expiresAt, { 
                                addSuffix: true, 
                                locale: es 
                              })}
                            </span>
                          </div>
                        </div>

                        {cachedTour.tour.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {cachedTour.tour.description}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/editor/${cachedTour.tour.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Abrir
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefreshTour(cachedTour.tour.id)}
                          disabled={isRefreshing || !navigator.onLine}
                        >
                          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                          Actualizar
                        </Button>
                        
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setTourToDelete(cachedTour.tour.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!tourToDelete} onOpenChange={(open) => !open && setTourToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar del caché?</AlertDialogTitle>
            <AlertDialogDescription>
              Este tour dejará de estar disponible sin conexión. Podrás volver a descargarlo cuando tengas internet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => tourToDelete && handleDeleteTour(tourToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
