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
      {/* Zoom controls */}
      <div className="absolute bottom-4 md:top-4 right-4 z-10 flex flex-row md:flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          onClick={zoomIn}
          className="shadow-lg h-11 w-11 md:h-10 md:w-10 touch-manipulation"
        >
          <ZoomIn className="w-5 h-5 md:w-4 md:h-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={zoomOut}
          className="shadow-lg h-11 w-11 md:h-10 md:w-10 touch-manipulation"
        >
          <ZoomOut className="w-5 h-5 md:w-4 md:h-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={resetTransform}
          className="shadow-lg h-11 w-11 md:h-10 md:w-10 touch-manipulation"
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
          className="relative inline-block"
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
