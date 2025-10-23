import { MapPin, Eye } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface HotspotPointProps {
  index: number;
  title: string;
  x: number;
  y: number;
  onClick: () => void;
  hasPanorama?: boolean;
  style?: {
    icon?: string;
    color?: string;
    size?: number;
  };
}

export const HotspotPoint = ({ index, title, x, y, onClick, hasPanorama, style }: HotspotPointProps) => {
  const IconComponent = style?.icon 
    ? (LucideIcons as any)[style.icon] || MapPin 
    : MapPin;
  
  const color = style?.color || '#4285F4';
  const size = style?.size || 40;

  return (
    <button
      className="absolute group cursor-pointer transition-all duration-300 hover:z-50"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      onClick={onClick}
    >
      {/* Animated pulse ring */}
      <div 
        className="absolute inset-0 rounded-full animate-ping opacity-25"
        style={{
          backgroundColor: color,
          width: `${size}px`,
          height: `${size}px`,
        }}
      />
      
      {/* Main point */}
      <div
        className="relative rounded-full border-2 border-white shadow-lg flex items-center justify-center transition-transform group-hover:scale-125"
        style={{
          backgroundColor: color,
          width: `${size}px`,
          height: `${size}px`,
        }}
      >
        <IconComponent className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} />
        
        {/* 360° Badge */}
        {hasPanorama && (
          <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1 border-2 border-white shadow-lg">
            <Eye className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full mb-2 hidden group-hover:block animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-card border border-border px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
          <p className="text-sm font-medium text-foreground">{title}</p>
        </div>
      </div>
    </button>
  );
};
