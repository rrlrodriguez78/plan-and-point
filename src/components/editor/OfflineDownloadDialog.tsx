import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Download, HardDrive } from 'lucide-react';

interface DownloadProgress {
  tourId: string;
  tourName: string;
  stage: 'metadata' | 'floorplans' | 'photos' | 'complete';
  progress: number;
  currentItem: string;
  totalItems: number;
  currentItemNumber: number;
}

interface OfflineDownloadDialogProps {
  open: boolean;
  progress: DownloadProgress | null;
}

export function OfflineDownloadDialog({ open, progress }: OfflineDownloadDialogProps) {
  if (!progress) return null;

  const isComplete = progress.stage === 'complete';

  const getStageIcon = () => {
    if (isComplete) return <CheckCircle2 className="w-12 h-12 text-green-500" />;
    return <Download className="w-12 h-12 text-blue-500 animate-bounce" />;
  };

  const getStageLabel = () => {
    switch (progress.stage) {
      case 'metadata':
        return 'Descargando información del tour';
      case 'floorplans':
        return 'Descargando planos';
      case 'photos':
        return 'Descargando fotos 360°';
      case 'complete':
        return '¡Descarga completa!';
      default:
        return 'Descargando...';
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Descarga para Offline
          </DialogTitle>
          <DialogDescription>
            {progress.tourName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Icon */}
          <div className="flex justify-center">
            {getStageIcon()}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{getStageLabel()}</span>
              <span className="font-medium">{Math.round(progress.progress)}%</span>
            </div>
            <Progress value={progress.progress} className="h-2" />
          </div>

          {/* Current Item */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{progress.currentItem}</p>
            {progress.totalItems > 0 && progress.stage !== 'complete' && (
              <p className="text-xs text-muted-foreground">
                {progress.currentItemNumber} de {progress.totalItems}
              </p>
            )}
          </div>

          {/* Success Message */}
          {isComplete && (
            <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-4">
              <p className="text-sm text-green-800 dark:text-green-200 text-center">
                Tour descargado exitosamente. Ya puedes acceder a él sin conexión.
              </p>
            </div>
          )}

          {/* Info */}
          {!isComplete && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground text-center">
                Esta descarga incluye todos los planos, fotos 360°, puntos de navegación y metadatos del tour.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
