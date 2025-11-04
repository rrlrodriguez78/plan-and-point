import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HardDrive, RefreshCw, Trash2, Check } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface OfflineTourBadgeProps {
  isDownloaded: boolean;
  tourId: string;
  tourName: string;
  size?: number;
  photoCount?: number;
  lastModified?: Date;
  onDownload: () => void;
  onDelete: () => void;
  isDownloading?: boolean;
}

export function OfflineTourBadge({
  isDownloaded,
  tourId,
  tourName,
  size,
  photoCount,
  lastModified,
  onDownload,
  onDelete,
  isDownloading
}: OfflineTourBadgeProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isDownloaded) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onDownload}
              disabled={isDownloading}
              className="gap-2"
            >
              {isDownloading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Descargando...
                </>
              ) : (
                <>
                  <HardDrive className="w-4 h-4" />
                  Descargar Offline
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Descarga este tour para accederlo sin internet</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="secondary" className="gap-1 bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
        <Check className="w-3 h-3" />
        Offline
      </Badge>
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {size && (
                <span className="font-mono">{formatBytes(size)}</span>
              )}
              {photoCount && (
                <span className="ml-1">• {photoCount} fotos</span>
              )}
              {lastModified && (
                <span className="ml-1">
                  • {formatDistanceToNow(lastModified, { addSuffix: true, locale: es })}
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <p className="font-semibold">Tour descargado</p>
              {size && <p>Tamaño: {formatBytes(size)}</p>}
              {photoCount && <p>Fotos: {photoCount}</p>}
              {lastModified && (
                <p>Descargado: {lastModified.toLocaleString('es-ES')}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDownload}
                disabled={isDownloading}
                className="h-7 w-7 p-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDownloading ? 'animate-spin' : ''}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Actualizar tour offline</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Eliminar del almacenamiento offline</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
