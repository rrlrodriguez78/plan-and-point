import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, AlertCircle, X } from "lucide-react";

interface SyncJob {
  id: string;
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  total_items: number;
  processed_items: number;
  failed_items: number;
  error_messages: Array<{ photoId: string; error: string }>;
}

interface Props {
  open: boolean;
  job: SyncJob | null;
  alreadySynced?: number;
  onClose: () => void;
  onCancel: () => void;
}

export const SyncProgressDialog: React.FC<Props> = ({ 
  open, 
  job, 
  alreadySynced = 0,
  onClose, 
  onCancel 
}) => {
  if (!job) return null;

  const progress = job.total_items > 0 
    ? (job.processed_items / job.total_items) * 100 
    : 0;

  const isComplete = ['completed', 'failed', 'cancelled'].includes(job.status);
  const successCount = job.processed_items - job.failed_items;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {job.status === 'processing' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                Sincronizando Fotos...
              </>
            )}
            {job.status === 'completed' && (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Sincronización Completa
              </>
            )}
            {job.status === 'failed' && (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                Sincronización Fallida
              </>
            )}
            {job.status === 'cancelled' && (
              <>
                <AlertCircle className="h-5 w-5 text-yellow-500" />
                Sincronización Cancelada
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {job.status === 'processing' 
              ? 'El proceso está en curso. Puedes cerrar este diálogo, el proceso continuará en segundo plano.'
              : 'El proceso ha finalizado.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Progreso</span>
              <span className="text-muted-foreground">
                {job.processed_items} / {job.total_items} fotos
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="text-xs text-muted-foreground text-center">
              {progress.toFixed(0)}% completado
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-green-50 dark:bg-green-950 p-3 rounded border border-green-200 dark:border-green-800">
              <div className="text-green-600 dark:text-green-400 font-medium text-xs">✓ Sincronizadas</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{successCount}</div>
            </div>

            {job.failed_items > 0 && (
              <div className="bg-red-50 dark:bg-red-950 p-3 rounded border border-red-200 dark:border-red-800">
                <div className="text-red-600 dark:text-red-400 font-medium text-xs">✗ Fallidas</div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">{job.failed_items}</div>
              </div>
            )}

            {alreadySynced > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded border border-blue-200 dark:border-blue-800">
                <div className="text-blue-600 dark:text-blue-400 font-medium text-xs">⏭ Ya existían</div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{alreadySynced}</div>
              </div>
            )}
          </div>

          {/* Error Messages */}
          {job.error_messages && job.error_messages.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">Errores encontrados:</div>
                <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
                  {job.error_messages.map((err, idx) => (
                    <li key={idx} className="font-mono">
                      {err.photoId.slice(0, 8)}: {err.error}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end pt-2">
            {job.status === 'processing' && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={onCancel}
              >
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            )}
            {isComplete && (
              <Button 
                variant="default" 
                size="sm"
                onClick={onClose}
              >
                Cerrar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
