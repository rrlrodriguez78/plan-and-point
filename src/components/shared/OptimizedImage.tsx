import { useLazyImage } from '@/hooks/useLazyImage';
import { cn } from '@/lib/utils';
import { CSSProperties } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  objectFit?: CSSProperties['objectFit'];
  priority?: boolean;
  quality?: number;
  sizes?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  objectFit = 'cover',
  priority = false,
  quality = 85,
  sizes = '100vw',
  onLoad,
  onError,
}: OptimizedImageProps) {
  const { imgRef, isVisible } = useLazyImage({
    threshold: 0.1,
    rootMargin: '50px',
  });

  // Generate WebP and JPEG URLs
  const getImageUrl = (format: 'webp' | 'jpeg') => {
    // If it's already a data URL or blob, return as is
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      return src;
    }

    // For external URLs or already processed images, return as is
    if (src.startsWith('http')) {
      return src;
    }

    // For local images, add format extension
    const [basePath, extension] = src.split(/\.(?=[^.]+$)/);
    return `${basePath}.${format}`;
  };

  // Generate srcset for responsive images
  const generateSrcSet = (format: 'webp' | 'jpeg') => {
    if (!width) return undefined;
    
    const widths = [320, 640, 768, 1024, 1280, 1536];
    const applicableWidths = widths.filter(w => w <= width);
    
    if (applicableWidths.length === 0) {
      applicableWidths.push(width);
    }

    return applicableWidths
      .map(w => {
        const url = getImageUrl(format);
        return `${url} ${w}w`;
      })
      .join(', ');
  };

  const webpSrcSet = generateSrcSet('webp');
  const jpegSrcSet = generateSrcSet('jpeg');

  // For priority images, don't use lazy loading
  const shouldLoad = priority || isVisible;

  return (
    <picture>
      {/* WebP format with srcset */}
      {shouldLoad && (
        <source
          type="image/webp"
          srcSet={webpSrcSet}
          sizes={sizes}
        />
      )}
      
      {/* JPEG fallback with srcset */}
      {shouldLoad && (
        <source
          type="image/jpeg"
          srcSet={jpegSrcSet}
          sizes={sizes}
        />
      )}
      
      {/* Fallback img tag */}
      <img
        ref={imgRef}
        src={shouldLoad ? getImageUrl('jpeg') : undefined}
        alt={alt}
        width={width}
        height={height}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        className={cn(
          'transition-opacity duration-300',
          shouldLoad ? 'opacity-100' : 'opacity-0',
          className
        )}
        style={{
          objectFit,
          aspectRatio: width && height ? `${width}/${height}` : undefined,
        }}
        onLoad={onLoad}
        onError={onError}
      />
    </picture>
  );
}
