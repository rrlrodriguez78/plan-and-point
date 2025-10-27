import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';

interface SwipeIndicatorProps {
  direction: 'left' | 'right' | 'up' | 'down' | null;
  isActive: boolean;
  deltaX?: number;
  deltaY?: number;
}

export const SwipeIndicator = ({ direction, isActive, deltaX = 0, deltaY = 0 }: SwipeIndicatorProps) => {
  const getIcon = () => {
    switch (direction) {
      case 'left':
        return <ChevronLeft className="w-8 h-8" />;
      case 'right':
        return <ChevronRight className="w-8 h-8" />;
      case 'up':
        return <ChevronUp className="w-8 h-8" />;
      case 'down':
        return <ChevronDown className="w-8 h-8" />;
      default:
        return null;
    }
  };

  const getPosition = () => {
    if (direction === 'left' || direction === 'right') {
      return {
        left: direction === 'left' ? '10%' : 'auto',
        right: direction === 'right' ? '10%' : 'auto',
        top: '50%',
        transform: 'translateY(-50%)',
      };
    } else {
      return {
        top: direction === 'up' ? '10%' : 'auto',
        bottom: direction === 'down' ? '10%' : 'auto',
        left: '50%',
        transform: 'translateX(-50%)',
      };
    }
  };

  const getOpacity = () => {
    const delta = Math.abs(direction === 'left' || direction === 'right' ? deltaX : deltaY);
    return Math.min(delta / 100, 0.8);
  };

  return (
    <AnimatePresence>
      {isActive && direction && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: getOpacity(), scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="fixed z-50 pointer-events-none"
          style={{
            ...getPosition(),
          }}
        >
          <div className="bg-primary/90 text-primary-foreground rounded-full p-4 shadow-lg backdrop-blur-sm">
            {getIcon()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface SwipeProgressBarProps {
  direction: 'horizontal' | 'vertical';
  progress: number; // 0-1
  isActive: boolean;
}

export const SwipeProgressBar = ({ direction, progress, isActive }: SwipeProgressBarProps) => {
  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          exit={{ opacity: 0 }}
          className={`fixed z-40 bg-primary pointer-events-none ${
            direction === 'horizontal'
              ? 'top-0 left-0 h-1 w-full'
              : 'left-0 top-0 w-1 h-full'
          }`}
        >
          <motion.div
            className="bg-primary-glow h-full w-full"
            initial={{ scaleX: 0, scaleY: 0 }}
            animate={
              direction === 'horizontal'
                ? { scaleX: Math.abs(progress), originX: progress > 0 ? 0 : 1 }
                : { scaleY: Math.abs(progress), originY: progress > 0 ? 0 : 1 }
            }
            transition={{ duration: 0.1 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

interface SwipeDotsIndicatorProps {
  total: number;
  current: number;
  direction: 'horizontal' | 'vertical';
}

export const SwipeDotsIndicator = ({ total, current, direction }: SwipeDotsIndicatorProps) => {
  return (
    <div
      className={`flex gap-2 ${
        direction === 'horizontal' ? 'flex-row' : 'flex-col'
      }`}
    >
      {Array.from({ length: total }).map((_, index) => (
        <motion.div
          key={index}
          className={`rounded-full transition-all ${
            index === current
              ? 'bg-primary w-8 h-2'
              : 'bg-muted-foreground/30 w-2 h-2'
          } ${direction === 'vertical' && index === current ? 'h-8 w-2' : ''}`}
          animate={{
            scale: index === current ? 1.2 : 1,
          }}
          transition={{ duration: 0.2 }}
        />
      ))}
    </div>
  );
};
