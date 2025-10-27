export interface CompatibilityResult {
  category: string;
  feature: string;
  supported: boolean;
  details?: string;
}

export interface CompatibilityReport {
  web: CompatibilityResult[];
  pwa: CompatibilityResult[];
  mobile: CompatibilityResult[];
  accessibility: CompatibilityResult[];
  performance: CompatibilityResult[];
  overall: {
    score: number;
    supported: number;
    total: number;
  };
}

// Web Browser Compatibility
export const checkWebCompatibility = (): CompatibilityResult[] => {
  const results: CompatibilityResult[] = [];
  const ua = navigator.userAgent;

  // Chrome
  results.push({
    category: 'web',
    feature: 'Chrome',
    supported: /Chrome/.test(ua) && !/Edge/.test(ua),
    details: /Chrome\/(\d+)/.exec(ua)?.[1] || 'Not detected'
  });

  // Firefox
  results.push({
    category: 'web',
    feature: 'Firefox',
    supported: /Firefox/.test(ua),
    details: /Firefox\/(\d+)/.exec(ua)?.[1] || 'Not detected'
  });

  // Safari
  results.push({
    category: 'web',
    feature: 'Safari',
    supported: /Safari/.test(ua) && !/Chrome/.test(ua),
    details: /Version\/(\d+)/.exec(ua)?.[1] || 'Not detected'
  });

  // Edge
  results.push({
    category: 'web',
    feature: 'Edge',
    supported: /Edg/.test(ua),
    details: /Edg\/(\d+)/.exec(ua)?.[1] || 'Not detected'
  });

  return results;
};

// PWA Compatibility
export const checkPWACompatibility = async (): Promise<CompatibilityResult[]> => {
  const results: CompatibilityResult[] = [];

  // Service Worker
  const swSupported = 'serviceWorker' in navigator;
  let swRegistered = false;
  if (swSupported) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      swRegistered = !!registration;
    } catch (e) {
      // Service worker check failed
    }
  }
  results.push({
    category: 'pwa',
    feature: 'Service Worker',
    supported: swSupported && swRegistered,
    details: swSupported ? (swRegistered ? 'Registered' : 'Supported but not registered') : 'Not supported'
  });

  // Manifest
  const manifestLink = document.querySelector('link[rel="manifest"]');
  results.push({
    category: 'pwa',
    feature: 'Manifest',
    supported: !!manifestLink,
    details: manifestLink ? 'Present' : 'Missing'
  });

  // Offline support (check if caches API is available)
  const offlineSupported = 'caches' in window;
  results.push({
    category: 'pwa',
    feature: 'Offline',
    supported: offlineSupported,
    details: offlineSupported ? 'Cache API available' : 'Not supported'
  });

  return results;
};

// Mobile Compatibility
export const checkMobileCompatibility = (): CompatibilityResult[] => {
  const results: CompatibilityResult[] = [];

  // Touch events
  const touchSupported = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  results.push({
    category: 'mobile',
    feature: 'Touch events',
    supported: touchSupported,
    details: touchSupported ? `${navigator.maxTouchPoints} touch points` : 'Not supported'
  });

  // Viewport
  const viewport = document.querySelector('meta[name="viewport"]');
  results.push({
    category: 'mobile',
    feature: 'Viewport',
    supported: !!viewport,
    details: viewport ? (viewport as HTMLMetaElement).content : 'Missing'
  });

  // Orientation
  const orientationSupported = 'orientation' in screen || 'orientation' in window;
  results.push({
    category: 'mobile',
    feature: 'Orientation',
    supported: orientationSupported,
    details: orientationSupported ? `${screen.orientation?.type || window.orientation}` : 'Not supported'
  });

  return results;
};

// Accessibility Compatibility
export const checkAccessibilityCompatibility = (): CompatibilityResult[] => {
  const results: CompatibilityResult[] = [];

  // Screen readers (check for ARIA support)
  const ariaSupported = 'ariaLabel' in document.createElement('div');
  results.push({
    category: 'accessibility',
    feature: 'Screen readers',
    supported: ariaSupported,
    details: ariaSupported ? 'ARIA supported' : 'Not supported'
  });

  // Keyboard navigation
  const keyboardSupported = 'tabIndex' in document.createElement('div');
  results.push({
    category: 'accessibility',
    feature: 'Keyboard nav',
    supported: keyboardSupported,
    details: keyboardSupported ? 'Tab navigation supported' : 'Not supported'
  });

  // ARIA
  const ariaElements = document.querySelectorAll('[role], [aria-label], [aria-labelledby]');
  results.push({
    category: 'accessibility',
    feature: 'ARIA',
    supported: ariaElements.length > 0,
    details: `${ariaElements.length} ARIA elements found`
  });

  return results;
};

// Performance Compatibility
export const checkPerformanceCompatibility = async (): Promise<CompatibilityResult[]> => {
  const results: CompatibilityResult[] = [];

  // Check if Performance API is available
  if (!('performance' in window) || !('getEntriesByType' in performance)) {
    results.push({
      category: 'performance',
      feature: 'Performance API',
      supported: false,
      details: 'Not available'
    });
    return results;
  }

  // LCP - Largest Contentful Paint
  const lcpEntries = performance.getEntriesByType('largest-contentful-paint') as any[];
  const lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].renderTime || lcpEntries[lcpEntries.length - 1].loadTime : 0;
  results.push({
    category: 'performance',
    feature: 'LCP < 2.5s',
    supported: lcp > 0 && lcp < 2500,
    details: lcp > 0 ? `${(lcp / 1000).toFixed(2)}s` : 'Not measured yet'
  });

  // FID - First Input Delay (check for FCP as proxy)
  const fidEntries = performance.getEntriesByType('first-input') as any[];
  const fid = fidEntries.length > 0 ? fidEntries[0].processingStart - fidEntries[0].startTime : 0;
  results.push({
    category: 'performance',
    feature: 'FID < 100ms',
    supported: fid > 0 && fid < 100,
    details: fid > 0 ? `${fid.toFixed(2)}ms` : 'Not measured yet'
  });

  // CLS - Cumulative Layout Shift
  const clsEntries = performance.getEntriesByType('layout-shift') as any[];
  const cls = clsEntries.reduce((sum: number, entry: any) => sum + (entry.hadRecentInput ? 0 : entry.value), 0);
  results.push({
    category: 'performance',
    feature: 'CLS < 0.1',
    supported: cls < 0.1,
    details: `${cls.toFixed(3)}`
  });

  return results;
};

// Run all compatibility checks
export const runCompatibilityCheck = async (): Promise<CompatibilityReport> => {
  const web = checkWebCompatibility();
  const pwa = await checkPWACompatibility();
  const mobile = checkMobileCompatibility();
  const accessibility = checkAccessibilityCompatibility();
  const performance = await checkPerformanceCompatibility();

  const allResults = [...web, ...pwa, ...mobile, ...accessibility, ...performance];
  const supported = allResults.filter(r => r.supported).length;
  const total = allResults.length;
  const score = Math.round((supported / total) * 100);

  return {
    web,
    pwa,
    mobile,
    accessibility,
    performance,
    overall: {
      score,
      supported,
      total
    }
  };
};
