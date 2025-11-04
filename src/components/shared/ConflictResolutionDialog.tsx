import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConflictResolutionDialogProps {
  open: boolean;
  onResolve: (resolution: 'keep-local' | 'use-remote' | 'cancel') => void;
  tourName: string;
  localChanges: string;
  remoteChanges: string;
}

export function ConflictResolutionDialog({
  open,
  onResolve,
  tourName,
  localChanges,
  remoteChanges,
}: ConflictResolutionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onResolve('cancel')}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <DialogTitle>Conflicto de Sincronización</DialogTitle>
          </div>
          <DialogDescription>
            El tour "{tourName}" tiene cambios tanto locales como remotos. ¿Qué versión deseas conservar?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 my-4">
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">📱 Tus Cambios Locales</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{localChanges}</p>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">☁️ Cambios del Servidor</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{remoteChanges}</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onResolve('cancel')}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => onResolve('use-remote')}>
            Usar Versión del Servidor
          </Button>
          <Button onClick={() => onResolve('keep-local')}>
            Mantener Mis Cambios
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
