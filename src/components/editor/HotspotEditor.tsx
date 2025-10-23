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
  const [debugClickPoint, setDebugClickPoint] = useState<{ x: number; y: number } | null>(null);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || draggingId) return;

    const target = e.target as HTMLElement;
    if (target.closest('[data-hotspot]')) return;

    const container = containerRef.current;
    const image = imageRef.current;
    if (!container || !image) return;

    // Prevenir el comportamiento por defecto y asegurar coordenadas precisas
    e.preventDefault();
    e.stopPropagation();

    const coords = convertContainerToImageCoordinates(
      e.clientX,
      e.clientY,
      container,
      image
    );

    if (coords) {
      // Logs de debug mejorados
      console.group('🎯 Debug de Coordenadas');
      console.log('Click en:', { clientX: e.clientX, clientY: e.clientY });
      console.log('Imagen rect:', image.getBoundingClientRect());
      console.log('Coordenadas %:', coords);
      console.groupEnd();
      
      // Mostrar punto de debug temporal
      setDebugClickPoint({ x: e.clientX, y: e.clientY });
      setTimeout(() => setDebugClickPoint(null), 2000);
      
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

    e.preventDefault();
    
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
      console.log('📍 Arrastrando a:', coords); // Debug log
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
    const isSelected = selectedIds.includes(hotspot.id);
    
    return (
      <div className="relative w-full h-full">
        {/* Pulsing ring effect for selected */}
        {isSelected && (
          <div className="absolute inset-0 rounded-full bg-[#4285F4] animate-ping opacity-25" />
        )}
        
        {/* Main circle */}
        <div 
          className="relative w-full h-full rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-all"
          style={{ 
            backgroundColor: hotspot.style?.color || '#4285F4',
            boxShadow: isSelected ? '0 0 0 4px rgba(66, 133, 244, 0.3)' : '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
        >
          <IconComponent 
            className="w-1/2 h-1/2 text-white" 
          />
        </div>
      </div>
    );
  };

  return (
    <Card className="p-6 bg-[hsl(var(--accent)/0.3)]">
      <div
        ref={containerRef}
        className="relative bg-background rounded-lg overflow-hidden cursor-crosshair border-2 border-dashed border-border shadow-inner"
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        style={{ minHeight: '500px' }}
      >
        <img
          ref={imageRef}
          src={imageUrl}
          alt="Floor plan"
          className="w-full h-auto select-none"
          draggable={false}
        />

        {/* Indicador visual temporal de clic */}
        {debugClickPoint && (
          <div
            className="absolute w-3 h-3 bg-red-500 rounded-full pointer-events-none z-[9999] animate-ping"
            style={{
              left: `${debugClickPoint.x}px`,
              top: `${debugClickPoint.y}px`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        )}

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
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Usa el botón <span className="font-semibold">"Agregar Punto"</span> y haz click en el plano • Arrastra hotspots para moverlos • Shift+Click para selección múltiple
        </p>
      )}
    </Card>
  );
}
