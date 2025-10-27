import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hotspot } from '@/types/tour';
import { useZoomPan } from '@/hooks/useZoomPan';

interface ViewerCanvasProps {
  imageUrl: string;
  hotspots: Hotspot[];
  onHotspotClick: (hotspot: Hotspot, event?: React.MouseEvent) => void;
  renderHotspot: (hotspot: Hotspot, index: number) => React.ReactNode;
  isManagementMode?: boolean;
  selectedHotspots?: string[];
}

export const ViewerCanvas = ({ 
  imageUrl, 
  hotspots, 
  onHotspotClick, 
  renderHotspot,
  isManagementMode = false,
  selectedHotspots = []
}: ViewerCanvasProps) => {
  const { transform, containerRef, contentRef, zoomIn, zoomOut, resetTransform } = useZoomPan();

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-accent/30 overflow-hidden cursor-grab active:cursor-grabbing"
    >
      {/* Zoom controls - Optimizados para móvil */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:top-4 md:right-4 z-10 flex flex-row md:flex-col gap-2 bg-background/80 backdrop-blur-sm p-2 rounded-full md:rounded-lg shadow-lg">
        <Button
          variant="secondary"
          size="icon"
          onClick={zoomIn}
          className="h-12 w-12 md:h-10 md:w-10 touch-manipulation"
          title="Acercar"
        >
          <ZoomIn className="w-5 h-5 md:w-4 md:h-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={zoomOut}
          className="h-12 w-12 md:h-10 md:w-10 touch-manipulation"
          title="Alejar"
        >
          <ZoomOut className="w-5 h-5 md:w-4 md:h-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={resetTransform}
          className="h-12 w-12 md:h-10 md:w-10 touch-manipulation"
          title="Restablecer vista"
        >
          <Maximize className="w-5 h-5 md:w-4 md:h-4" />
        </Button>
      </div>

      {/* Canvas */}
      <div className="w-full h-full flex items-center justify-center">
        <div
          ref={contentRef}
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            transition: 'transform 0.1s ease-out',
          }}
          className="relative w-full h-full max-w-full max-h-full"
        >
          <img
            src={imageUrl}
            alt="Floor plan"
            className="w-full h-full object-contain rounded-lg shadow-2xl select-none"
            draggable={false}
          />
          {hotspots.map((hotspot, index) => (
            <div key={hotspot.id}>
              {renderHotspot(hotspot, index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
