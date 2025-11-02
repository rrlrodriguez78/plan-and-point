import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { NavigationPoint } from '@/types/tour';
import { MousePointer2, Hand, Trash2, Target } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ArrowPlacementControlsProps {
  mode: 'view' | 'place' | 'drag';
  onModeChange: (mode: 'view' | 'place' | 'drag') => void;
  targetHotspot: string | null;
  onTargetChange: (targetId: string | null) => void;
  availableTargets: Array<{ id: string; title: string }>;
  existingPoints: NavigationPoint[];
  onDeletePoint: (pointId: string) => void;
  onEditPoint: (point: NavigationPoint) => void;
  disabled?: boolean;
}

export const ArrowPlacementControls = ({
  mode,
  onModeChange,
  targetHotspot,
  onTargetChange,
  availableTargets,
  existingPoints,
  onDeletePoint,
  onEditPoint,
  disabled = false
}: ArrowPlacementControlsProps) => {
  
  const startPlacementMode = () => {
    if (!targetHotspot) {
      return;
    }
    onModeChange('place');
  };
  
  const cancelPlacement = () => {
    onModeChange('view');
    onTargetChange(null);
  };
  
  return (
    <div className="space-y-3">
      {/* Indicador Sistema UV */}
      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            Sistema UV Activo
          </span>
        </div>
        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
          Coordenadas independientes de la rotación de cámara
        </p>
      </div>
      
      {/* Modo Actual */}
      <div className="flex items-center gap-2">
        <Badge variant={mode === 'place' ? 'default' : mode === 'drag' ? 'secondary' : 'outline'} className="text-xs">
          {mode === 'place' && (
            <>
              <MousePointer2 className="w-3 h-3 mr-1" />
              Colocando Flecha
            </>
          )}
          {mode === 'drag' && (
            <>
              <Hand className="w-3 h-3 mr-1" />
              Arrastrando
            </>
          )}
          {mode === 'view' && (
            <>
              <Target className="w-3 h-3 mr-1" />
              Vista
            </>
          )}
        </Badge>
      </div>
      
      {/* Instrucciones según modo */}
      {mode === 'place' && (
        <Alert className="py-2">
          <AlertDescription className="text-xs">
            Haz click en el panorama donde quieres colocar la flecha. Presiona ESC para cancelar.
          </AlertDescription>
        </Alert>
      )}
      
      {mode === 'drag' && (
        <Alert className="py-2">
          <AlertDescription className="text-xs">
            Arrastra la flecha a la nueva posición. Haz click para fijarla.
          </AlertDescription>
        </Alert>
      )}
      
      {mode === 'view' && (
        <>
          {/* Selector de destino */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Destino de la nueva flecha:</label>
            <Select
              value={targetHotspot || undefined}
              onValueChange={onTargetChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un hotspot..." />
              </SelectTrigger>
              <SelectContent>
                {availableTargets.map((target) => (
                  <SelectItem key={target.id} value={target.id}>
                    {target.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Botón para iniciar colocación */}
          <Button
            onClick={startPlacementMode}
            disabled={!targetHotspot || disabled}
            className="w-full"
          >
            <MousePointer2 className="w-4 h-4 mr-2" />
            Añadir Flecha
          </Button>
        </>
      )}
      
      {mode === 'place' && (
        <Button
          onClick={cancelPlacement}
          variant="outline"
          className="w-full"
        >
          Cancelar
        </Button>
      )}
      
      {/* Lista de flechas existentes */}
      {existingPoints.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium">Flechas existentes:</label>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2">
            {existingPoints.map((point) => {
              const target = availableTargets.find(t => t.id === point.to_hotspot_id);
              return (
                <div
                  key={point.id}
                  className="flex items-center justify-between p-1.5 border rounded-md hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium truncate">
                        {point.label || target?.title || 'Sin título'}
                      </p>
                      {/* Badge UV/Legacy */}
                      {point.u !== undefined && point.v !== undefined ? (
                        <Badge variant="outline" className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 text-[10px] px-1.5 py-0 border-green-200 dark:border-green-800">
                          UV
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-[10px] px-1.5 py-0 border-orange-200 dark:border-orange-800">
                          Legacy
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {point.u !== undefined && point.v !== undefined 
                        ? `UV: ${point.u.toFixed(3)}, ${point.v.toFixed(3)}`
                        : `θ: ${point.theta.toFixed(0)}°, φ: ${point.phi.toFixed(0)}°`
                      }
                    </p>
                  </div>
                  <div className="flex gap-0.5 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEditPoint(point)}
                      disabled={disabled}
                      className="h-7 w-7 p-0"
                    >
                      <Hand className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeletePoint(point.id)}
                      disabled={disabled}
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
