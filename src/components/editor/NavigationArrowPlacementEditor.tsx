import { useState } from 'react';
import { NavigationPoint } from '@/types/tour';
import { Button } from '@/components/ui/button';
import { Eye, ImageIcon } from 'lucide-react';
import { NavigationArrowPlacementEditor2D } from './NavigationArrowPlacementEditor2D';
import { NavigationArrowPlacementEditor3D } from './NavigationArrowPlacementEditor3D';

interface NavigationArrowPlacementEditorProps {
  hotspotId: string;
  panoramaUrl: string;
  existingPoints: NavigationPoint[];
  availableTargets: Array<{ id: string; title: string }>;
  onSave: (points: NavigationPoint[]) => Promise<void>;
}

export const NavigationArrowPlacementEditor = ({
  hotspotId,
  panoramaUrl,
  existingPoints,
  availableTargets,
  onSave
}: NavigationArrowPlacementEditorProps) => {
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

  const handleSave = async () => {
    await onSave(existingPoints);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button 
          variant={viewMode === '2d' ? 'default' : 'outline'}
          onClick={() => setViewMode('2d')}
          size="sm"
        >
          <ImageIcon className="w-4 h-4 mr-1" />
          📐 Editor 2D
        </Button>
        <Button 
          variant={viewMode === '3d' ? 'default' : 'outline'}
          onClick={() => setViewMode('3d')}
          size="sm"
        >
          <Eye className="w-4 h-4 mr-1" />
          🌐 Preview 3D
        </Button>
      </div>

      {viewMode === '2d' ? (
        <NavigationArrowPlacementEditor2D
          hotspotId={hotspotId}
          panoramaUrl={panoramaUrl}
          existingPoints={existingPoints}
          availableTargets={availableTargets}
          onSave={handleSave}
          onToggle3D={() => setViewMode('3d')}
        />
      ) : (
        <NavigationArrowPlacementEditor3D
          hotspotId={hotspotId}
          panoramaUrl={panoramaUrl}
          existingPoints={existingPoints}
          availableTargets={availableTargets}
          onSave={handleSave}
          onToggle2D={() => setViewMode('2d')}
        />
      )}
    </div>
  );
};
