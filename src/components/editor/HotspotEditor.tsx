import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { convertContainerToImageCoordinates, convertImageToContainerPosition } from '@/components/shared/ImageCoordinateCalculator';
import * as LucideIcons from 'lucide-react';

interface Hotspot {
  id: string;
  title: string;
  x_position: number;
  y_position: number;
  style?: {
    icon: string;
    color: string;
    size: number;
  };
}

interface HotspotEditorProps {
  imageUrl: string;
  hotspots: Hotspot[];
  selectedIds: string[];
  onHotspotClick: (id: string, event: React.MouseEvent) => void;
  onHotspotDrag: (id: string, x: number, y: number) => void;
  onCanvasClick: (x: number, y: number) => void;
  readOnly?: boolean;
}

export default function HotspotEditor({
  imageUrl,
  hotspots,
  selectedIds,
  onHotspotClick,
  onHotspotDrag,
  onCanvasClick,
  readOnly = false,
}: HotspotEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || draggingId) return;

    const target = e.target as HTMLElement;
    if (target.closest('[data-hotspot]')) return;

    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image) return;

    const coords = convertContainerToImageCoordinates(
      e.clientX,
      e.clientY,
      container,
      image
    );

    if (coords) {
      onCanvasClick(coords.x, coords.y);
    }
  };

  const handleHotspotMouseDown = (hotspot: Hotspot, e: React.MouseEvent) => {
    if (readOnly) return;
    
    e.stopPropagation();
    setDraggingId(hotspot.id);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingId || readOnly) return;

    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image) return;

    const coords = convertContainerToImageCoordinates(
      e.clientX,
      e.clientY,
      container,
      image
    );

    if (coords) {
      onHotspotDrag(draggingId, coords.x, coords.y);
    }
  };

  const handleMouseUp = () => {
    setDraggingId(null);
    setDragStart(null);
  };

  useEffect(() => {
    if (draggingId) {
      document.addEventListener('mouseup', handleMouseUp as any);
      return () => {
        document.removeEventListener('mouseup', handleMouseUp as any);
      };
    }
  }, [draggingId]);

  const renderHotspotIcon = (hotspot: Hotspot) => {
    const iconName = hotspot.style?.icon || 'MapPin';
    const IconComponent = (LucideIcons as any)[iconName] || LucideIcons.MapPin;
    const size = hotspot.style?.size || 32;
    
    return (
      <IconComponent 
        className="w-full h-full" 
        style={{ 
          color: hotspot.style?.color || '#3b82f6',
          filter: selectedIds.includes(hotspot.id) ? 'drop-shadow(0 0 8px currentColor)' : 'none'
        }}
      />
    );
  };

  return (
    <Card className="p-4">
      <div
        ref={containerRef}
        className="relative bg-muted rounded-lg overflow-hidden cursor-crosshair"
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        style={{ minHeight: '400px' }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Floor plan"
          className="w-full h-auto select-none"
          draggable={false}
        />

        {hotspots.map((hotspot) => {
          const container = containerRef.current;
          const image = imageRef.current;
          if (!container || !image) return null;

          const position = convertImageToContainerPosition(
            hotspot.x_position,
            hotspot.y_position,
            container,
            image
          );

          const size = hotspot.style?.size || 32;
          const isSelected = selectedIds.includes(hotspot.id);
          const isDragging = draggingId === hotspot.id;

          return (
            <div
              key={hotspot.id}
              data-hotspot
              className={`absolute transition-all ${
                isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-110'
              } ${isSelected ? 'ring-4 ring-primary ring-opacity-50 rounded-full' : ''}`}
              style={{
                left: position.left,
                top: position.top,
                width: `${size}px`,
                height: `${size}px`,
                transform: 'translate(-50%, -50%)',
                zIndex: isDragging ? 1000 : isSelected ? 100 : 10,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onHotspotClick(hotspot.id, e);
              }}
              onMouseDown={(e) => handleHotspotMouseDown(hotspot, e)}
              title={hotspot.title}
            >
              {renderHotspotIcon(hotspot)}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Click en el plano para agregar hotspot • Arrastra hotspots para moverlos • Shift+Click para selección múltiple
        </p>
      )}
    </Card>
  );
}
