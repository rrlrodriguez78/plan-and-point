/**
 * Mobile-First Optimizations for Samsung Galaxy and All Devices
 * Ensures proper touch targets, accessibility, and responsive behavior
 */

export interface MobileOptimizationConfig {
  minTouchTarget: number;
  minFontSize: number;
  minScreenWidth: number;
  enableSamsungOptimizations: boolean;
}

export const DEFAULT_CONFIG: MobileOptimizationConfig = {
  minTouchTarget: 44, // Apple/Google minimum recommendation
  minFontSize: 16, // Prevents zoom on iOS
  minScreenWidth: 320, // iPhone SE and similar
  enableSamsungOptimizations: true,
};

// Detect Samsung Galaxy devices
export const isSamsungGalaxy = (): boolean => {
  const ua = navigator.userAgent.toLowerCase();
  return /samsung|sm-|galaxy/.test(ua);
};

// Get Samsung-specific optimizations
export const getSamsungOptimizations = () => {
  if (!isSamsungGalaxy()) return {};
  
  return {
    // Samsung Internet browser specific
    touchCallout: 'none',
    tapHighlightColor: 'transparent',
    // Enable hardware acceleration
    transform: 'translateZ(0)',
    willChange: 'transform',
  };
};

// Validate touch target size
export const validateTouchTarget = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  return rect.width >= DEFAULT_CONFIG.minTouchTarget && 
         rect.height >= DEFAULT_CONFIG.minTouchTarget;
};

// Check if screen is small
export const isSmallScreen = (): boolean => {
  return window.innerWidth < 640; // Tailwind sm breakpoint
};

// Get responsive touch target classes
export const getTouchTargetClasses = (size: 'sm' | 'md' | 'lg' = 'md'): string => {
  const baseClasses = 'touch-manipulation select-none';
  
  switch (size) {
    case 'sm':
      return `${baseClasses} min-h-[44px] min-w-[44px]`;
    case 'md':
      return `${baseClasses} min-h-[48px] min-w-[48px]`;
    case 'lg':
      return `${baseClasses} min-h-[56px] min-w-[56px]`;
    default:
      return baseClasses;
  }
};

// Accessibility improvements
export const getA11yAttributes = (label: string, role?: string) => {
  return {
    'aria-label': label,
    role: role || 'button',
    tabIndex: 0,
  };
};

// PWA detection
export const isPWA = (): boolean => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true;
};

// Screen reader detection
export const hasScreenReader = (): boolean => {
  // Check for common screen reader user agents
  const ua = navigator.userAgent.toLowerCase();
  return /talkback|voiceover|nvda|jaws/.test(ua) ||
         // Check for screen reader specific media queries
         window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Performance optimization for mobile
export const optimizeForMobile = () => {
  // Disable hover effects on touch devices
  if ('ontouchstart' in window) {
    document.body.classList.add('touch-device');
  }
  
  // Add Samsung-specific optimizations
  if (isSamsungGalaxy()) {
    document.body.classList.add('samsung-device');
  }
  
  // Add PWA class
  if (isPWA()) {
    document.body.classList.add('is-pwa');
  }
  
  // Add small screen class
  if (isSmallScreen()) {
    document.body.classList.add('small-screen');
  }
};

// Cross-browser compatibility fixes
export const applyCrossBrowserFixes = () => {
  // Fix for iOS Safari viewport height
  const setVH = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  
  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', setVH);
  
  // Prevent double-tap zoom on touch devices
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
};

// Initialize all mobile optimizations
export const initMobileOptimizations = () => {
  optimizeForMobile();
  applyCrossBrowserFixes();
  
  console.log('[Mobile Optimizations] Initialized', {
    isSamsung: isSamsungGalaxy(),
    isPWA: isPWA(),
    isSmallScreen: isSmallScreen(),
    hasScreenReader: hasScreenReader(),
  });
};
