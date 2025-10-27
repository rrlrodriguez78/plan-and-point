import { useEffect } from 'react';
import { preloadImage } from '@/utils/imageOptimization';

interface PreloadCriticalImagesProps {
  images: Array<{
    src: string;
    format?: 'webp' | 'jpeg';
  }>;
}

/**
 * Component to preload critical images that should be loaded immediately
 * Use this for hero images, logos, or above-the-fold content
 */
export function PreloadCriticalImages({ images }: PreloadCriticalImagesProps) {
  useEffect(() => {
    images.forEach(({ src, format = 'webp' }) => {
      preloadImage(src, format);
    });
  }, [images]);

  return null;
}
