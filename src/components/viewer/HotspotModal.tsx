import { X, ChevronLeft, ChevronRight, MapPin, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { FloorPlan } from '@/types/tour';

interface Hotspot {
  id: string;
  title: string;
  description?: string;
  first_photo_url?: string;
}

interface HotspotModalProps {
  hotspot: Hotspot | null;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  currentIndex?: number;
  totalCount?: number;
  availableHotspots?: Hotspot[];
  onHotspotSelect?: (hotspot: Hotspot) => void;
  floorPlans?: FloorPlan[];
  currentFloorPlan?: FloorPlan;
  onFloorChange?: (floorPlanId: string) => void;
}

export const HotspotModal = ({ 
  hotspot, 
  onClose, 
  onNext, 
  onPrevious,
  currentIndex,
  totalCount,
  availableHotspots = [],
  onHotspotSelect,
  floorPlans = [],
  currentFloorPlan,
  onFloorChange
}: HotspotModalProps) => {
  if (!hotspot) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-200">
      <Card className="max-w-3xl w-full max-h-[90vh] md:max-h-[85vh] relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Large Side Navigation Buttons - SIEMPRE VISIBLES */}
        {availableHotspots.length > 0 && (
          <>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onPrevious}
              disabled={!onPrevious || currentIndex === undefined || currentIndex <= 0}
              className="absolute left-1 md:left-2 top-1/2 -translate-y-1/2 text-foreground bg-background/60 hover:bg-background/80 backdrop-blur-sm rounded-full h-12 w-12 md:h-14 md:w-14 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed z-10 touch-manipulation"
              title="Punto anterior"
            >
              <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
            </Button>

            <Button 
              variant="ghost" 
              size="icon"
              onClick={onNext}
              disabled={!onNext || currentIndex === undefined || totalCount === undefined || currentIndex >= totalCount - 1}
              className="absolute right-1 md:right-2 top-1/2 -translate-y-1/2 text-foreground bg-background/60 hover:bg-background/80 backdrop-blur-sm rounded-full h-12 w-12 md:h-14 md:w-14 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed z-10 touch-manipulation"
              title="Punto siguiente"
            >
              <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
            </Button>
          </>
        )}

        <div className="p-3 md:p-6 overflow-auto max-h-[90vh] md:max-h-[85vh]" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Header with Floor Selector and Hotspot List */}
          <div className="flex justify-between items-start mb-4 gap-2">
            <div className="flex-1 flex items-start gap-2 flex-wrap">
              {/* Floor Selector */}
              {floorPlans.length > 0 && currentFloorPlan && onFloorChange && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Building2 className="w-4 h-4" />
                      {currentFloorPlan.name}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-popover/95 backdrop-blur-sm">
                    {floorPlans.map((floor) => (
                      <DropdownMenuItem
                        key={floor.id}
                        onClick={() => {
                          onFloorChange(floor.id);
                          onClose();
                        }}
                        className={floor.id === currentFloorPlan.id ? 'bg-accent' : ''}
                      >
                        <Building2 className="w-4 h-4 mr-2" />
                        {floor.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Hotspot List Dropdown */}
              {availableHotspots.length > 0 && onHotspotSelect && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <MapPin className="w-4 h-4" />
                      {availableHotspots.length} puntos
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-popover/95 backdrop-blur-sm max-h-[400px] overflow-auto">
                    {availableHotspots.map((h) => (
                      <DropdownMenuItem
                        key={h.id}
                        onClick={() => onHotspotSelect(h)}
                        className={h.id === hotspot.id ? 'bg-accent' : ''}
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        {h.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-bold text-foreground mb-1 truncate">{hotspot.title}</h2>
                {currentIndex !== undefined && totalCount !== undefined && (
                  <p className="text-sm text-muted-foreground">
                    Punto {currentIndex + 1} de {totalCount}
                  </p>
                )}
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="shrink-0"
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
          {hotspot.first_photo_url ? (
            <div className="rounded-lg overflow-hidden mb-4">
              <img
                src={hotspot.first_photo_url}
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
        </div>
      </Card>
    </div>
  );
};
