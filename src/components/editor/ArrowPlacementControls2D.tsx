import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Eye, MousePointer2, Trash2, Grid3x3 } from 'lucide-react';

interface Point {
  id: string;
  label?: string;
  u: number;
  v: number;
  theta: number;
  phi: number;
}

interface ArrowPlacementControls2DProps {
  mode: 'view' | 'place' | 'drag';
  onModeChange: (mode: 'view' | 'place' | 'drag') => void;
  targetHotspot: string;
  onTargetChange: (value: string) => void;
  availableTargets: Array<{ id: string; title: string }>;
  existingPoints: Point[];
  onDeletePoint: (id: string) => void;
  selectedPoint: Point | null;
  onSelectPoint: (point: Point | null) => void;
  disabled?: boolean;
  showGrid: boolean;
  onShowGridChange: (value: boolean) => void;
  zoom: number;
  onZoomChange: (value: number) => void;
}

export function ArrowPlacementControls2D({
  mode,
  onModeChange,
  targetHotspot,
  onTargetChange,
  availableTargets,
  existingPoints,
  onDeletePoint,
  selectedPoint,
  onSelectPoint,
  disabled,
  showGrid,
  onShowGridChange,
  zoom,
  onZoomChange
}: ArrowPlacementControls2DProps) {
  return (
    <div className="space-y-3">
      {/* Indicador Sistema UV */}
      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-medium text-green-800 dark:text-green-200">
            Editor 2D - Sistema UV
          </span>
        </div>
        <p className="text-[10px] text-green-600 dark:text-green-400 mt-1">
          Click directo sobre la imagen para colocar flechas
        </p>
      </div>

      {/* Modo */}
      <Card>
        <CardContent className="p-3 space-y-3">
          <div>
            <Label className="text-xs mb-2 block">Modo</Label>
            <ToggleGroup 
              type="single" 
              value={mode} 
              onValueChange={(value) => value && onModeChange(value as any)}
              className="grid grid-cols-3 gap-1"
            >
              <ToggleGroupItem value="view" size="sm" className="text-xs">
                <Eye className="w-3 h-3 mr-1" />
                Ver
              </ToggleGroupItem>
              <ToggleGroupItem value="place" size="sm" className="text-xs">
                <MousePointer2 className="w-3 h-3 mr-1" />
                Colocar
              </ToggleGroupItem>
              <ToggleGroupItem value="drag" size="sm" className="text-xs">
                <MousePointer2 className="w-3 h-3 mr-1" />
                Mover
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Destino */}
          {mode === 'place' && (
            <div>
              <Label htmlFor="target" className="text-xs mb-2 block">
                Destino de la flecha
              </Label>
              <Select value={targetHotspot} onValueChange={onTargetChange} disabled={disabled}>
                <SelectTrigger id="target" className="h-8 text-xs">
                  <SelectValue placeholder="Selecciona destino" />
                </SelectTrigger>
                <SelectContent>
                  {availableTargets.map((target) => (
                    <SelectItem key={target.id} value={target.id} className="text-xs">
                      {target.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Grid Helper */}
          <div className="flex items-center justify-between">
            <Label htmlFor="grid" className="text-xs flex items-center gap-1">
              <Grid3x3 className="w-3 h-3" />
              Mostrar Grid
            </Label>
            <Switch 
              id="grid"
              checked={showGrid} 
              onCheckedChange={onShowGridChange}
              disabled={disabled}
            />
          </div>

          {/* Zoom */}
          <div>
            <Label className="text-xs mb-2 block">Zoom: {zoom}%</Label>
            <Slider 
              value={[zoom]} 
              onValueChange={([v]) => onZoomChange(v)}
              min={100}
              max={200}
              step={10}
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Instrucciones */}
      {mode === 'place' && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            📍 Click en la imagen para colocar la flecha
          </p>
        </div>
      )}

      {mode === 'drag' && (
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
          <p className="text-xs text-purple-800 dark:text-purple-200">
            🎯 Click y arrastra las flechas para reposicionarlas
          </p>
        </div>
      )}

      {/* Lista de Flechas */}
      {existingPoints.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <Label className="text-xs mb-2 block">
              Flechas colocadas ({existingPoints.length})
            </Label>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {existingPoints.map((point) => (
                <div
                  key={point.id}
                  className={`flex items-center justify-between p-1.5 border rounded-md hover:bg-accent/50 transition-colors cursor-pointer ${
                    selectedPoint?.id === point.id ? 'bg-accent border-primary' : ''
                  }`}
                  onClick={() => onSelectPoint(point)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium truncate">
                        {point.label || 'Sin título'}
                      </p>
                      <Badge variant="outline" className="bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 text-[10px] px-1.5 py-0 border-green-200 dark:border-green-800">
                        UV
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      u: {point.u.toFixed(3)}, v: {point.v.toFixed(3)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePoint(point.id);
                    }}
                    disabled={disabled}
                    className="h-6 w-6 p-0"
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
