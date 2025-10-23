import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Hotspot } from '@/types/tour';

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
  return (
    <div className="relative w-full h-full bg-accent/30">
      <TransformWrapper
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        centerOnInit
        wheel={{ step: 0.1 }}
        doubleClick={{ mode: 'zoomIn' }}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <>
            {/* Zoom controls */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => zoomIn()}
                className="shadow-lg"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => zoomOut()}
                className="shadow-lg"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => resetTransform()}
                className="shadow-lg"
              >
                <Maximize className="w-4 h-4" />
              </Button>
            </div>

            {/* Canvas */}
            <TransformComponent
              wrapperClass="!w-full !h-full"
              contentClass="!w-full !h-full flex items-center justify-center"
            >
              <div className="relative inline-block">
                <img
                  src={imageUrl}
                  alt="Floor plan"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  draggable={false}
                />
                {hotspots.map((hotspot, index) => (
                  <div key={hotspot.id}>
                    {renderHotspot(hotspot, index)}
                  </div>
                ))}
              </div>
            </TransformComponent>
          </>
        )}
      </TransformWrapper>
    </div>
  );
};
