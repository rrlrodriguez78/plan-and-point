import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Cloud, Smartphone } from "lucide-react";
import { format } from "date-fns";

interface ConflictResolverProps {
  open: boolean;
  tourName: string;
  localVersion: any;
  remoteVersion: any;
  onResolve: (resolution: 'local' | 'remote') => void;
  onClose: () => void;
}

export function ConflictResolver({ 
  open, 
  tourName,
  localVersion, 
  remoteVersion, 
  onResolve,
  onClose
}: ConflictResolverProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <DialogTitle>Conflicto de Sincronización Detectado</DialogTitle>
          </div>
          <DialogDescription>
            El tour "{tourName}" fue editado en dos lugares diferentes. Elige qué versión mantener.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
          {/* Versión Local */}
          <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50/50 hover:bg-blue-50 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900">Tu Versión (Local)</h3>
            </div>
            
            <div className="bg-white rounded-md p-3 mb-3 border border-blue-100">
              <p className="font-medium text-gray-900 mb-1">{localVersion.title}</p>
              <p className="text-sm text-gray-600 line-clamp-2">{localVersion.description || 'Sin descripción'}</p>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p>
                <span className="font-medium">Última edición:</span>{' '}
                {localVersion.updated_at 
                  ? format(new Date(localVersion.updated_at), 'dd/MM/yyyy HH:mm')
                  : 'Desconocida'}
              </p>
              {localVersion.floor_plans && (
                <p>
                  <span className="font-medium">Floor plans:</span> {localVersion.floor_plans.length}
                </p>
              )}
            </div>

            <Button 
              className="w-full mt-4"
              onClick={() => onResolve('local')}
            >
              Usar Esta Versión
            </Button>
          </div>

          {/* Versión Remota */}
          <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50/50 hover:bg-green-50 transition-colors">
            <div className="flex items-center gap-2 mb-3">
              <Cloud className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-900">Versión del Servidor</h3>
            </div>
            
            <div className="bg-white rounded-md p-3 mb-3 border border-green-100">
              <p className="font-medium text-gray-900 mb-1">{remoteVersion.title}</p>
              <p className="text-sm text-gray-600 line-clamp-2">{remoteVersion.description || 'Sin descripción'}</p>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p>
                <span className="font-medium">Última edición:</span>{' '}
                {remoteVersion.updated_at 
                  ? format(new Date(remoteVersion.updated_at), 'dd/MM/yyyy HH:mm')
                  : 'Desconocida'}
              </p>
              {remoteVersion.floor_plans && (
                <p>
                  <span className="font-medium">Floor plans:</span> {remoteVersion.floor_plans.length}
                </p>
              )}
            </div>

            <Button 
              className="w-full mt-4"
              variant="outline"
              onClick={() => onResolve('remote')}
            >
              Usar Esta Versión
            </Button>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          <p className="font-medium mb-1">⚠️ Importante:</p>
          <p>La versión que no elijas se perderá permanentemente. Asegúrate de elegir la correcta.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
