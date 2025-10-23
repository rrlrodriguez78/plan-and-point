import { useState, useMemo } from 'react';
import { Search, MapPin, Image, Maximize2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Hotspot, FloorPlan } from '@/types/tour';

interface GlobalHotspotListProps {
  isOpen: boolean;
  onClose: () => void;
  hotspotsByFloor: Record<string, Hotspot[]>;
  floorPlans: FloorPlan[];
  onHotspotSelect: (hotspot: Hotspot, floorPlanId: string) => void;
}

export const GlobalHotspotList = ({
  isOpen,
  onClose,
  hotspotsByFloor,
  floorPlans,
  onHotspotSelect,
}: GlobalHotspotListProps) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Flatten all hotspots with floor info
  const allHotspots = useMemo(() => {
    const hotspots: Array<Hotspot & { floorPlanId: string; floorName: string }> = [];
    
    Object.entries(hotspotsByFloor).forEach(([floorPlanId, floorHotspots]) => {
      const floor = floorPlans.find(fp => fp.id === floorPlanId);
      if (floor) {
        floorHotspots.forEach(hotspot => {
          hotspots.push({
            ...hotspot,
            floorPlanId,
            floorName: floor.name,
          });
        });
      }
    });

    return hotspots;
  }, [hotspotsByFloor, floorPlans]);

  // Filter hotspots based on search
  const filteredHotspots = useMemo(() => {
    if (!searchQuery.trim()) return allHotspots;

    const query = searchQuery.toLowerCase();
    return allHotspots.filter(
      hotspot =>
        hotspot.title.toLowerCase().includes(query) ||
        hotspot.description?.toLowerCase().includes(query) ||
        hotspot.floorName.toLowerCase().includes(query)
    );
  }, [allHotspots, searchQuery]);

  // Group by floor
  const groupedHotspots = useMemo(() => {
    const groups: Record<string, typeof filteredHotspots> = {};
    
    filteredHotspots.forEach(hotspot => {
      if (!groups[hotspot.floorPlanId]) {
        groups[hotspot.floorPlanId] = [];
      }
      groups[hotspot.floorPlanId].push(hotspot);
    });

    return groups;
  }, [filteredHotspots]);

  const handleSelect = (hotspot: Hotspot & { floorPlanId: string }) => {
    onHotspotSelect(hotspot, hotspot.floorPlanId);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Todos los Puntos del Tour
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, descripción o piso..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stats */}
        <div className="flex gap-2">
          <Badge variant="secondary">
            Total: {allHotspots.length} puntos
          </Badge>
          {searchQuery && (
            <Badge variant="default">
              Encontrados: {filteredHotspots.length}
            </Badge>
          )}
        </div>

        {/* Hotspot List */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 pb-4">
            {Object.entries(groupedHotspots).map(([floorPlanId, hotspots]) => {
              const floor = floorPlans.find(fp => fp.id === floorPlanId);
              if (!floor) return null;

              return (
                <div key={floorPlanId} className="space-y-2">
                  <div className="flex items-center gap-2 py-2">
                    <div className="h-px flex-1 bg-border" />
                    <Badge variant="outline" className="font-semibold">
                      {floor.name}
                    </Badge>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {hotspots.map((hotspot) => (
                    <Card
                      key={hotspot.id}
                      className="p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleSelect(hotspot)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate">
                              {hotspot.title}
                            </h3>
                            {hotspot.has_panorama && (
                              <Badge variant="secondary" className="text-xs">
                                <Maximize2 className="w-3 h-3 mr-1" />
                                360°
                              </Badge>
                            )}
                            {hotspot.media_url && (
                              <Badge variant="secondary" className="text-xs">
                                <Image className="w-3 h-3 mr-1" />
                                Media
                              </Badge>
                            )}
                          </div>
                          {hotspot.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {hotspot.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>
                              Posición: ({hotspot.x_position.toFixed(1)}%, {hotspot.y_position.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(hotspot);
                          }}
                        >
                          Ir →
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              );
            })}

            {filteredHotspots.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No se encontraron puntos</p>
                {searchQuery && (
                  <p className="text-sm mt-1">
                    Intenta con otros términos de búsqueda
                  </p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
