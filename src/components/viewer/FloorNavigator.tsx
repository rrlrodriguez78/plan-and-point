import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface FloorPlan {
  id: string;
  name: string;
  image_url: string;
}

interface FloorNavigatorProps {
  floorPlans: FloorPlan[];
  currentFloorIndex: number;
  onFloorChange: (index: number) => void;
  hotspotCounts: Record<string, number>;
}

export const FloorNavigator = ({ 
  floorPlans, 
  currentFloorIndex, 
  onFloorChange,
  hotspotCounts 
}: FloorNavigatorProps) => {
  if (floorPlans.length <= 1) return null;

  return (
    <div className="border-b border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Piso:</span>
          <Tabs value={currentFloorIndex.toString()} onValueChange={(v) => onFloorChange(parseInt(v))}>
            <TabsList>
              {floorPlans.map((plan, idx) => (
                <TabsTrigger key={plan.id} value={idx.toString()} className="gap-2">
                  {plan.name}
                  {hotspotCounts[plan.id] > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {hotspotCounts[plan.id]}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
