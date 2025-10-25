import { MapPin, Eye } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface HotspotPointProps {
  index: number;
  title: string;
  x: number;
  y: number;
  onClick: (e: React.MouseEvent) => void;
  hasPanorama?: boolean;
  isSelected?: boolean;
  isManagementMode?: boolean;
  photoCount?: number;
  photoNames?: string[];
  style?: {
    icon?: string;
    color?: string;
    size?: number;
  };
}

export const HotspotPoint = ({ 
  index, 
  title, 
  x, 
  y, 
  onClick, 
  hasPanorama, 
  isSelected = false,
  isManagementMode = false,
  photoCount = 0,
  photoNames = [],
  style 
}: HotspotPointProps) => {
  const IconComponent = style?.icon 
    ? (LucideIcons as any)[style.icon] || MapPin 
    : MapPin;
  
  const baseColor = style?.color || '#4285F4';
  const color = isSelected ? '#10b981' : baseColor;
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
        className={`relative rounded-full border-2 shadow-lg flex items-center justify-center transition-all group-hover:scale-125 ${
          isSelected ? 'border-green-400 border-4 ring-4 ring-green-400/30' : 'border-white'
        }`}
        style={{
          backgroundColor: color,
          width: `${size}px`,
          height: `${size}px`,
        }}
      >
        <IconComponent className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} />
        
        {/* Selection indicator */}
        {isManagementMode && isSelected && (
          <div className="absolute -top-1 -left-1 bg-green-500 rounded-full p-0.5 border-2 border-white shadow-lg">
            <LucideIcons.Check className="w-3 h-3 text-white" />
          </div>
        )}
        
        {/* 360° Badge */}
        {hasPanorama && (
          <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1 border-2 border-white shadow-lg">
            <Eye className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full mb-2 hidden group-hover:block animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-card border border-border px-3 py-2 rounded-lg shadow-lg min-w-[200px]">
          <p className="text-sm font-medium text-foreground mb-1">{title}</p>
          {photoCount > 0 && (
            <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-1 mt-1">
              <p className="font-medium">📷 {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}:</p>
              <ul className="space-y-0.5 pl-2">
                {photoNames.slice(0, 3).map((name, idx) => (
                  <li key={idx} className="truncate max-w-[180px]">• {name}</li>
                ))}
                {photoCount > 3 && (
                  <li className="text-muted-foreground/70">...y {photoCount - 3} más</li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </button>
  );
};
