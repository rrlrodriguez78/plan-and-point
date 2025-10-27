import { MapPin, Eye } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState, useRef, useCallback, useEffect } from 'react';

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
  const isMobile = useIsMobile();
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const hotspotRef = useRef<HTMLButtonElement>(null);
  
  const IconComponent = style?.icon 
    ? (LucideIcons as any)[style.icon] || MapPin 
    : MapPin;
  
  const baseColor = style?.color || '#4285F4';
  const color = isSelected ? '#10b981' : baseColor;
  
  // Tamaños optimizados para móvil y desktop
  const baseSize = isMobile ? 36 : (style?.size || 32);
  const size = baseSize;
  const touchAreaSize = isMobile ? 56 : 48;

  // Calcular la mejor posición del tooltip basado en los límites de la pantalla
  const calculateTooltipPosition = useCallback(() => {
    if (!hotspotRef.current) return 'top';
    
    const rect = hotspotRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const spaceTop = rect.top;
    const spaceBottom = viewportHeight - rect.bottom;
    const spaceLeft = rect.left;
    const spaceRight = viewportWidth - rect.right;
    
    // Priorizar posición con más espacio disponible
    const spaces = {
      top: spaceTop,
      bottom: spaceBottom,
      left: spaceLeft,
      right: spaceRight
    };
    
    // Encontrar la dirección con más espacio
    return Object.entries(spaces).reduce((best, [dir, space]) => 
      space > spaces[best] ? dir : best
    , 'top') as 'top' | 'bottom' | 'left' | 'right';
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    // En móvil, mostrar tooltip brevemente antes de la acción
    if (isMobile) {
      setTooltipVisible(true);
      setTimeout(() => setTooltipVisible(false), 2000);
    }
    onClick(e);
  };

  const handleMouseEnter = () => {
    if (!isMobile) {
      const position = calculateTooltipPosition();
      setTooltipPosition(position);
      setTooltipVisible(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      setTooltipVisible(false);
    }
  };

  const handleTouchStart = () => {
    if (isMobile) {
      const position = calculateTooltipPosition();
      setTooltipPosition(position);
      setTooltipVisible(true);
    }
  };

  const handleTouchEnd = () => {
    if (isMobile) {
      // Ocultar tooltip después de un delay en móvil
      setTimeout(() => setTooltipVisible(false), 2000);
    }
  };

  // Ocultar tooltip cuando se hace scroll o zoom
  useEffect(() => {
    const handleScroll = () => setTooltipVisible(false);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const renderTooltip = () => {
    if (!tooltipVisible) return null;

    const tooltipClasses = `absolute bg-card border border-border px-3 py-2 rounded-lg shadow-lg min-w-[160px] max-w-[200px] z-50 animate-in fade-in zoom-in-95 duration-200`;
    
    const getTooltipStyle = () => {
      const baseStyle = {
        left: '50%',
        transform: 'translateX(-50%)',
      };

      switch (tooltipPosition) {
        case 'top':
          return {
            ...baseStyle,
            bottom: '100%',
            marginBottom: '8px',
          };
        case 'bottom':
          return {
            ...baseStyle,
            top: '100%',
            marginTop: '8px',
          };
        case 'left':
          return {
            right: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            marginRight: '8px',
          };
        case 'right':
          return {
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            marginLeft: '8px',
          };
        default:
          return {
            ...baseStyle,
            bottom: '100%',
            marginBottom: '8px',
          };
      }
    };

    return (
      <div className={tooltipClasses} style={getTooltipStyle()}>
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        {hasPanorama && (
          <p className="text-xs text-blue-500 mt-1 flex items-center gap-1">
            <Eye className="w-3 h-3" />
            Vista 360° disponible
          </p>
        )}
        {photoCount > 0 && (
          <div className="text-xs text-muted-foreground space-y-1 border-t border-border pt-1 mt-1">
            <p className="font-medium">📷 {photoCount} {photoCount === 1 ? 'foto' : 'fotos'}</p>
            {!isMobile && (
              <ul className="space-y-0.5 pl-2">
                {photoNames.slice(0, 2).map((name, idx) => (
                  <li key={idx} className="truncate">• {name}</li>
                ))}
                {photoCount > 2 && (
                  <li className="text-muted-foreground/70">...y {photoCount - 2} más</li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <button
      ref={hotspotRef}
      className="absolute group cursor-pointer transition-all duration-300 hover:z-50 touch-manipulation select-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        width: `${touchAreaSize}px`,
        height: `${touchAreaSize}px`,
        minWidth: `${touchAreaSize}px`,
        minHeight: `${touchAreaSize}px`,
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      aria-label={`Punto ${title}${hasPanorama ? ' con vista 360°' : ''}`}
    >
      {/* Animated pulse ring */}
      <div 
        className={`absolute inset-0 rounded-full ${
          isMobile 
            ? 'animate-pulse opacity-30'
            : 'animate-ping opacity-25 group-hover:animate-pulse'
        }`}
        style={{
          backgroundColor: color,
          width: `${size}px`,
          height: `${size}px`,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      />
      
      {/* Main point */}
      <div
        className={`relative rounded-full border-2 shadow-lg flex items-center justify-center transition-all ${
          isMobile 
            ? 'active:scale-110 active:shadow-xl'
            : 'group-hover:scale-125'
        } ${
          isSelected 
            ? 'border-green-400 border-4 ring-4 ring-green-400/30 shadow-xl' 
            : 'border-white'
        }`}
        style={{
          backgroundColor: color,
          width: `${size}px`,
          height: `${size}px`,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
      >
        <IconComponent 
          className="text-white" 
          style={{ 
            width: Math.max(size * 0.5, 16),
            height: Math.max(size * 0.5, 16) 
          }} 
        />
        
        {/* Selection indicator */}
        {isManagementMode && isSelected && (
          <div className="absolute -top-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-white shadow-lg">
            <LucideIcons.Check className="w-3 h-3 text-white" />
          </div>
        )}
        
        {/* 360° Badge */}
        {hasPanorama && (
          <div className="absolute -top-1 -left-1 bg-blue-500 rounded-full p-1 border-2 border-white shadow-lg">
            <Eye className="w-3 h-3 text-white" />
          </div>
        )}
      </div>

      {/* Tooltip con detección de límites */}
      {renderTooltip()}
    </button>
  );
};