import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { offlineStorage, PendingPhoto } from '@/utils/offlineStorage';
import { toast } from 'sonner';

interface SyncQueuePanelProps {
  hotspotId?: string;
  onRetry?: () => void;
}

export const SyncQueuePanel = ({ hotspotId, onRetry }: SyncQueuePanelProps) => {
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      let pendingPhotos: PendingPhoto[];
      
      if (hotspotId) {
        pendingPhotos = await offlineStorage.getPendingPhotosByHotspot(hotspotId);
      } else {
        pendingPhotos = await offlineStorage.getPendingPhotos();
      }
      
      setPhotos(pendingPhotos);
    } catch (error) {
      console.error('Error loading photos:', error);
      toast.error('Error al cargar las fotos pendientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
    
    // Refrescar cada 5 segundos
    const interval = setInterval(loadPhotos, 5000);
    return () => clearInterval(interval);
  }, [hotspotId]);

  const handleDelete = async (photoId: string) => {
    try {
      await offlineStorage.deletePhoto(photoId);
      toast.success('Foto eliminada de la cola');
      await loadPhotos();
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('Error al eliminar la foto');
    }
  };

  const handleRetryAll = () => {
    onRetry?.();
    toast.info('Reintentando sincronización...');
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Cargando cola...</span>
        </div>
      </Card>
    );
  }

  if (photos.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500" />
          <p className="font-medium">No hay fotos pendientes</p>
          <p className="text-sm">Todas las fotos están sincronizadas</p>
        </div>
      </Card>
    );
  }

  const pendingCount = photos.filter(p => p.status === 'pending').length;
  const syncingCount = photos.filter(p => p.status === 'syncing').length;
  const errorCount = photos.filter(p => p.status === 'error').length;

  return (
    <Card className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Cola de Sincronización</h3>
          <p className="text-sm text-muted-foreground">
            {photos.length} foto(s) en espera
          </p>
        </div>
        <Button 
          size="sm" 
          variant="outline"
          onClick={handleRetryAll}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar Todo
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted/50 rounded p-2 text-center">
          <div className="text-2xl font-bold">{pendingCount}</div>
          <div className="text-xs text-muted-foreground">Pendientes</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950 rounded p-2 text-center">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{syncingCount}</div>
          <div className="text-xs text-amber-600 dark:text-amber-400">Sincronizando</div>
        </div>
        <div className="bg-red-50 dark:bg-red-950 rounded p-2 text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{errorCount}</div>
          <div className="text-xs text-red-600 dark:text-red-400">Errores</div>
        </div>
      </div>

      {/* Lista de fotos */}
      <ScrollArea className="h-[300px]">
        <div className="space-y-2">
          {photos.map((photo) => (
            <div 
              key={photo.id}
              className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border"
            >
              {/* Thumbnail placeholder */}
              <div className="w-16 h-16 bg-primary/10 rounded flex items-center justify-center flex-shrink-0">
                <span className="text-xs text-muted-foreground">360°</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{photo.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(photo.captureDate).toLocaleString()}
                </p>
                {photo.errorMessage && (
                  <p className="text-xs text-red-500 mt-1">{photo.errorMessage}</p>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center gap-2">
                {photo.status === 'pending' && (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="w-3 h-3" />
                    Pendiente
                  </Badge>
                )}
                {photo.status === 'syncing' && (
                  <Badge variant="default" className="gap-1 bg-amber-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Subiendo
                  </Badge>
                )}
                {photo.status === 'error' && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="w-3 h-3" />
                    Error ({photo.attempts})
                  </Badge>
                )}
                
                {/* Delete button */}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleDelete(photo.id)}
                  className="h-8 w-8"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};
