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
  renderHotspot
}: ViewerCanvasProps) => {
  return (
    <div className="relative w-full h-full bg-background overflow-hidden">
      {/* Canvas con imagen y hotspots fijos */}
      <div className="relative w-full h-full">
        <img
          src={imageUrl}
          alt="Floor plan"
          className="w-full h-full object-contain select-none"
          draggable={false}
        />
        {/* Hotspots posicionados sobre la imagen */}
        {hotspots.map((hotspot, index) => (
          <div key={hotspot.id}>
            {renderHotspot(hotspot, index)}
          </div>
        ))}
      </div>
    </div>
  );
};
