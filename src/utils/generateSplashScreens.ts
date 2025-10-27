/**
 * PWA Splash Screen Configuration
 * Generates splash screens for iOS and Android devices
 */

export interface SplashScreenConfig {
  width: number;
  height: number;
  deviceName: string;
  media: string;
}

// iOS Splash Screen Resolutions
export const iosSplashScreens: SplashScreenConfig[] = [
  // iPhone SE, iPod touch 5th generation and later
  {
    width: 640,
    height: 1136,
    deviceName: 'iPhone SE',
    media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
  },
  // iPhone 8, 7, 6s, 6 (4.7" display)
  {
    width: 750,
    height: 1334,
    deviceName: 'iPhone 8',
    media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)',
  },
  // iPhone 8 Plus, 7 Plus, 6s Plus, 6 Plus (5.5" display)
  {
    width: 1242,
    height: 2208,
    deviceName: 'iPhone 8 Plus',
    media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)',
  },
  // iPhone X, Xs, 11 Pro (5.8" display)
  {
    width: 1125,
    height: 2436,
    deviceName: 'iPhone X',
    media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)',
  },
  // iPhone Xs Max, 11 Pro Max (6.5" display)
  {
    width: 1242,
    height: 2688,
    deviceName: 'iPhone Xs Max',
    media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)',
  },
  // iPhone Xr, 11 (6.1" display)
  {
    width: 828,
    height: 1792,
    deviceName: 'iPhone XR',
    media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)',
  },
  // iPhone 12, 12 Pro, 13, 13 Pro, 14 (6.1" display)
  {
    width: 1170,
    height: 2532,
    deviceName: 'iPhone 12',
    media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)',
  },
  // iPhone 12 Pro Max, 13 Pro Max, 14 Plus (6.7" display)
  {
    width: 1284,
    height: 2778,
    deviceName: 'iPhone 12 Pro Max',
    media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)',
  },
  // iPhone 14 Pro (6.1" display)
  {
    width: 1179,
    height: 2556,
    deviceName: 'iPhone 14 Pro',
    media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)',
  },
  // iPhone 14 Pro Max (6.7" display)
  {
    width: 1290,
    height: 2796,
    deviceName: 'iPhone 14 Pro Max',
    media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)',
  },
  // iPhone 15, 15 Pro (6.1" display)
  {
    width: 1179,
    height: 2556,
    deviceName: 'iPhone 15',
    media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)',
  },
  // iPhone 15 Plus, 15 Pro Max (6.7" display)
  {
    width: 1290,
    height: 2796,
    deviceName: 'iPhone 15 Plus',
    media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)',
  },
  // iPad Mini, Air (7.9", 9.7" displays)
  {
    width: 1536,
    height: 2048,
    deviceName: 'iPad Mini',
    media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)',
  },
  // iPad Pro 10.5" (10.5" display)
  {
    width: 1668,
    height: 2224,
    deviceName: 'iPad Pro 10.5',
    media: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)',
  },
  // iPad Pro 11" (11" display)
  {
    width: 1668,
    height: 2388,
    deviceName: 'iPad Pro 11',
    media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)',
  },
  // iPad Pro 12.9" (12.9" display)
  {
    width: 2048,
    height: 2732,
    deviceName: 'iPad Pro 12.9',
    media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)',
  },
];

// Android Splash Screen Resolutions
export const androidSplashScreens: SplashScreenConfig[] = [
  {
    width: 320,
    height: 568,
    deviceName: 'Small Android',
    media: '(min-width: 320px)',
  },
  {
    width: 360,
    height: 640,
    deviceName: 'Medium Android',
    media: '(min-width: 360px)',
  },
  {
    width: 411,
    height: 731,
    deviceName: 'Large Android',
    media: '(min-width: 411px)',
  },
  {
    width: 768,
    height: 1024,
    deviceName: 'Tablet Android',
    media: '(min-width: 768px)',
  },
];

/**
 * Generate canvas-based splash screen
 * This can be used to dynamically create splash screens
 */
export const generateSplashScreen = (
  width: number,
  height: number,
  brandColor: string = '#000000',
  logoUrl?: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    // Background
    ctx.fillStyle = brandColor;
    ctx.fillRect(0, 0, width, height);

    if (logoUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // Center logo
        const logoSize = Math.min(width, height) * 0.3;
        const x = (width - logoSize) / 2;
        const y = (height - logoSize) / 2;
        ctx.drawImage(img, x, y, logoSize, logoSize);

        // Convert to data URL
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        reject(new Error('Failed to load logo'));
      };
      img.src = logoUrl;
    } else {
      // Just background
      resolve(canvas.toDataURL('image/png'));
    }
  });
};

/**
 * Get splash screen HTML link tags
 */
export const generateSplashScreenLinkTags = (
  basePath: string = '/splash'
): string => {
  return iosSplashScreens
    .map(
      (screen) =>
        `<link rel="apple-touch-startup-image" href="${basePath}/splash-${screen.width}x${screen.height}.png" media="${screen.media}" />`
    )
    .join('\n');
};

/**
 * Download splash screen image
 */
export const downloadSplashScreen = async (
  dataUrl: string,
  filename: string
) => {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
};
