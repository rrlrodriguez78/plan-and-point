/**
 * Easing function for smooth animations
 * Creates a smooth acceleration and deceleration curve
 */
export const easeInOutCubic = (t: number): number => {
  return t < 0.5 
    ? 4 * t * t * t 
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/**
 * Animate a value from start to end over a duration
 * @param from Starting value
 * @param to Ending value
 * @param duration Animation duration in milliseconds
 * @param onUpdate Callback called on each frame with the current value
 * @param onComplete Callback called when animation completes
 * @returns Function to cancel the animation
 */
export const animateValue = (
  from: number,
  to: number,
  duration: number,
  onUpdate: (value: number) => void,
  onComplete?: () => void
): (() => void) => {
  const startTime = Date.now();
  let animationFrame: number;
  
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeInOutCubic(progress);
    const currentValue = from + (to - from) * easedProgress;
    
    onUpdate(currentValue);
    
    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      onComplete?.();
    }
  };
  
  animate();
  
  // Return cancellation function
  return () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
    }
  };
};

/**
 * Create a simple delay promise
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
