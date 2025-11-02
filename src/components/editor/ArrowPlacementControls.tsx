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
    <div className="space-y-4">
      {/* Modo Actual */}
      <div className="flex items-center gap-2">
        <Badge variant={mode === 'place' ? 'default' : mode === 'drag' ? 'secondary' : 'outline'}>
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
        <Alert>
          <AlertDescription className="text-sm">
            Haz click en el panorama donde quieres colocar la flecha. Presiona ESC para cancelar.
          </AlertDescription>
        </Alert>
      )}
      
      {mode === 'drag' && (
        <Alert>
          <AlertDescription className="text-sm">
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
          <label className="text-sm font-medium">Flechas existentes:</label>
          <div className="space-y-2">
            {existingPoints.map((point) => {
              const target = availableTargets.find(t => t.id === point.to_hotspot_id);
              return (
                <div
                  key={point.id}
                  className="flex items-center justify-between p-2 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {point.label || target?.title || 'Sin título'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      θ: {point.theta.toFixed(0)}°, φ: {point.phi.toFixed(0)}°
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEditPoint(point)}
                      disabled={disabled}
                    >
                      <Hand className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeletePoint(point.id)}
                      disabled={disabled}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
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
