import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { X, SkipForward, Undo2, Calendar as CalendarIcon, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
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
  const [isMinimized, setIsMinimized] = useState(false);
  
  if (currentIndex >= matches.length) return null;

  const currentMatch = matches[currentIndex];
  const progress = ((currentIndex) / matches.length) * 100;

  return (
    <>
      {/* Versión minimizada */}
      {isMinimized && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button
            onClick={() => setIsMinimized(false)}
            className="shadow-xl"
            size="lg"
          >
            <MapPin className="w-4 h-4 mr-2" />
            {currentIndex + 1}/{matches.length}
            <ChevronUp className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      {/* Versión completa */}
      {!isMinimized && (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-md px-4">
          <Card className="p-4 shadow-2xl border-2 border-primary bg-card">
            <div className="flex items-start gap-4">
          {/* Preview de fotos */}
          <div className="flex gap-2 flex-shrink-0">
            {currentMatch.photos.slice(0, 3).map((photo, idx) => (
              <img
                key={idx}
                src={photo.preview}
                alt={currentMatch.name}
                className="w-16 h-16 rounded-lg object-cover border-2 border-primary"
              />
            ))}
            {currentMatch.photos.length > 3 && (
              <div className="w-16 h-16 rounded-lg border-2 border-primary bg-muted flex items-center justify-center">
                <span className="text-xs font-semibold">
                  +{currentMatch.photos.length - 3}
                </span>
              </div>
            )}
          </div>

          {/* Info del punto */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-lg truncate">{currentMatch.name}</h3>
              <div className="flex gap-1 flex-shrink-0 -mt-1 -mr-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(true)}
                  className="h-8 w-8"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onCancel}
                  className="h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-1">
              Coloca el punto {currentIndex + 1} de {matches.length}
            </p>

            <p className="text-xs text-primary font-medium mb-2">
              📷 {currentMatch.photos.length} foto(s) se agregarán a este punto
            </p>

            {/* Mostrar fechas de las fotos */}
            {currentMatch.photos.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {currentMatch.photos.map((photo, idx) => (
                  photo.captureDate && (
                    <Badge key={idx} variant="outline" className="text-xs">
                      <CalendarIcon className="w-3 h-3 mr-1" />
                      {format(parseISO(photo.captureDate), "dd/MM/yyyy")}
                    </Badge>
                  )
                ))}
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
      )}
    </>
  );
};