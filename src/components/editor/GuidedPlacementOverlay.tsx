import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, SkipForward, Undo2, Calendar as CalendarIcon } from 'lucide-react';
import type { Match } from '@/utils/photoMatcher';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface GuidedPlacementOverlayProps {
  matches: Match[];
  currentIndex: number;
  onPointPlaced: (position: { x: number; y: number }) => void;
  onSkip: () => void;
  onUndo: () => void;
  onCancel: () => void;
}

export const GuidedPlacementOverlay = ({
  matches,
  currentIndex,
  onSkip,
  onUndo,
  onCancel
}: GuidedPlacementOverlayProps) => {
  if (currentIndex >= matches.length) return null;

  const currentMatch = matches[currentIndex];
  const progress = ((currentIndex) / matches.length) * 100;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <Card className="p-4 shadow-2xl border-2 border-primary bg-card">
        <div className="flex items-start gap-4">
          {/* Preview de foto */}
          {currentMatch.photoPreview && (
            <img
              src={currentMatch.photoPreview}
              alt={currentMatch.name}
              className="w-20 h-20 rounded-lg object-cover flex-shrink-0 border-2 border-primary"
            />
          )}

          {/* Info del punto */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-lg truncate">{currentMatch.name}</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCancel}
                className="flex-shrink-0 -mt-1 -mr-1"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-1">
              Coloca el punto {currentIndex + 1} de {matches.length}
            </p>

            {currentMatch.captureDate && (
              <div className="flex items-center gap-1 text-xs text-blue-600 mb-2">
                <CalendarIcon className="w-3 h-3" />
                {format(parseISO(currentMatch.captureDate), "dd 'de' MMMM 'de' yyyy", { locale: es })}
              </div>
            )}
            
            <p className="text-xs text-muted-foreground mb-3">
              Haz click en el plano donde debe ir este punto
            </p>

            {/* Progress bar */}
            <div className="space-y-1">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{currentIndex} colocados</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={onSkip}
            className="flex-1"
            disabled={currentIndex >= matches.length - 1}
          >
            <SkipForward className="w-4 h-4 mr-1" />
            Omitir
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onUndo}
            className="flex-1"
            disabled={currentIndex === 0}
          >
            <Undo2 className="w-4 h-4 mr-1" />
            Deshacer
          </Button>
          
          <Button
            variant="destructive"
            size="sm"
            onClick={onCancel}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-1" />
            Cancelar
          </Button>
        </div>
      </Card>
    </div>
  );
};
