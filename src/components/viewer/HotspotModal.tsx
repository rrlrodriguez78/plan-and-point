import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Hotspot {
  id: string;
  title: string;
  description?: string;
  media_url?: string;
}

interface HotspotModalProps {
  hotspot: Hotspot | null;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

export const HotspotModal = ({ 
  hotspot, 
  onClose, 
  onNext, 
  onPrevious,
  currentIndex,
  totalCount 
}: HotspotModalProps) => {
  if (!hotspot) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <Card className="max-w-3xl w-full max-h-[85vh] overflow-auto animate-in zoom-in-95 duration-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-foreground mb-1">{hotspot.title}</h2>
              {currentIndex !== undefined && totalCount !== undefined && (
                <p className="text-sm text-muted-foreground">
                  Punto {currentIndex + 1} de {totalCount}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="ml-4"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Description */}
          {hotspot.description && (
            <p className="text-muted-foreground mb-4 leading-relaxed">
              {hotspot.description}
            </p>
          )}

          {/* Media */}
          {hotspot.media_url ? (
            <div className="rounded-lg overflow-hidden mb-4">
              <img
                src={hotspot.media_url}
                alt={hotspot.title}
                className="w-full h-auto"
              />
            </div>
          ) : (
            <div className="bg-muted rounded-lg p-12 text-center mb-4">
              <p className="text-muted-foreground">
                No hay contenido multimedia disponible
              </p>
            </div>
          )}

          {/* Navigation buttons */}
          {(onPrevious || onNext) && (
            <div className="flex justify-between items-center pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={onPrevious}
                disabled={!onPrevious}
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Anterior
              </Button>
              <Button
                variant="outline"
                onClick={onNext}
                disabled={!onNext}
              >
                Siguiente
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
