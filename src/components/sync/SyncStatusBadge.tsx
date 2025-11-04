import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCloudSync } from "@/hooks/useCloudSync";
import { RefreshCw, Cloud, CloudOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function SyncStatusBadge() {
  const { status, syncNow, resolveConflict } = useCloudSync();

  const getSyncIcon = () => {
    if (!status.isOnline) {
      return <CloudOff className="h-3 w-3" />;
    }
    if (status.isSyncing) {
      return <RefreshCw className="h-3 w-3 animate-spin" />;
    }
    if (status.hasConflicts) {
      return <AlertTriangle className="h-3 w-3" />;
    }
    if (status.pendingChanges > 0) {
      return <Cloud className="h-3 w-3" />;
    }
    return <CheckCircle2 className="h-3 w-3" />;
  };

  const getSyncVariant = () => {
    if (!status.isOnline) return "destructive";
    if (status.hasConflicts) return "warning" as any;
    if (status.pendingChanges > 0) return "secondary";
    return "success" as any;
  };

  const getSyncLabel = () => {
    if (!status.isOnline) return "Sin conexión";
    if (status.isSyncing) return "Sincronizando...";
    if (status.hasConflicts) return `${status.conflictingTours.length} conflicto${status.conflictingTours.length > 1 ? 's' : ''}`;
    if (status.pendingChanges > 0) return `${status.pendingChanges} pendiente${status.pendingChanges > 1 ? 's' : ''}`;
    return "Sincronizado";
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-8 px-2">
          <Badge variant={getSyncVariant()} className="gap-1.5">
            {getSyncIcon()}
            <span className="text-xs">{getSyncLabel()}</span>
          </Badge>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Estado de Sincronización</h4>
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncNow()}
              disabled={!status.isOnline || status.isSyncing}
              className="h-7"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${status.isSyncing ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Conexión:</span>
              <Badge variant={status.isOnline ? "success" as any : "destructive"}>
                {status.isOnline ? "🟢 Online" : "🔴 Offline"}
              </Badge>
            </div>

            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Cambios pendientes:</span>
              <span className="font-medium">{status.pendingChanges}</span>
            </div>

            {status.lastSyncAt && (
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-muted-foreground">Última sync:</span>
                <span className="text-xs">
                  {format(status.lastSyncAt, "HH:mm:ss", { locale: es })}
                </span>
              </div>
            )}

            {status.hasConflicts && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-medium text-yellow-800">
                      {status.conflictingTours.length} conflicto{status.conflictingTours.length > 1 ? 's' : ''} detectado{status.conflictingTours.length > 1 ? 's' : ''}
                    </p>
                    <ul className="text-xs text-yellow-700 space-y-1">
                      {status.conflictingTours.map((conflict) => (
                        <li key={conflict.tourId} className="truncate">
                          • {conflict.tourName}
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-7 text-xs mt-2"
                      onClick={() => {
                        // El primer conflicto se puede resolver desde aquí
                        // Para múltiples conflictos, mejor ir a una página dedicada
                        if (status.conflictingTours.length === 1) {
                          const conflict = status.conflictingTours[0];
                          // Aquí normalmente abriríamos el dialog
                          console.log('Resolver conflicto:', conflict);
                        }
                      }}
                    >
                      Ver y Resolver
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!status.isOnline && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-start gap-2">
                  <CloudOff className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-red-800">Sin conexión</p>
                    <p className="text-xs text-red-700 mt-1">
                      Los cambios se guardarán localmente y se sincronizarán automáticamente cuando se restaure la conexión.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
