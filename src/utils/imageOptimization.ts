/**
 * Centralized image optimization utility
 * Handles compression, resizing, and format conversion for all image uploads
 */

interface OptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg';
  maxSizeMB?: number;
}

interface OptimizationResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  optimizedSize: number;
  format: string;
}

const DEFAULT_OPTIONS: Required<OptimizationOptions> = {
  maxWidth: 4000,
  maxHeight: 4000,
  quality: 0.85,
  format: 'webp',
  maxSizeMB: 10,
};

/**
 * Check if browser supports WebP
 */
const supportsWebP = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').startsWith('data:image/webp');
})();

/**
 * Load an image from a File or Blob
 */
export const loadImage = (file: File | Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Calculate new dimensions maintaining aspect ratio
 */
const calculateDimensions = (
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } => {
  let width = originalWidth;
  let height = originalHeight;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  return { width, height };
};

/**
 * Optimize a single image
 */
export const optimizeImage = async (
  file: File,
  options: OptimizationOptions = {}
): Promise<OptimizationResult> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalSize = file.size;

  // Determine output format
  const useWebP = opts.format === 'webp' && supportsWebP;
  const outputFormat = useWebP ? 'image/webp' : 'image/jpeg';
  const formatExtension = useWebP ? 'webp' : 'jpg';

  // Load image
  const img = await loadImage(file);

  // Calculate new dimensions
  const { width, height } = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    opts.maxWidth,
    opts.maxHeight
  );

  // Create canvas and draw resized image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // Use high-quality image rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  // Convert to blob
  let blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to create blob'));
      },
      outputFormat,
      opts.quality
    );
  });

  // If still too large, reduce quality iteratively
  let currentQuality = opts.quality;
  const maxSizeBytes = opts.maxSizeMB * 1024 * 1024;

  while (blob.size > maxSizeBytes && currentQuality > 0.5) {
    currentQuality -= 0.05;
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        },
        outputFormat,
        currentQuality
      );
    });
  }

  // Final size check
  if (blob.size > maxSizeBytes) {
    throw new Error(
      `Image still too large after optimization: ${(blob.size / 1024 / 1024).toFixed(2)}MB`
    );
  }

  return {
    blob,
    width,
    height,
    originalSize,
    optimizedSize: blob.size,
    format: formatExtension,
  };
};

/**
 * Create multiple optimized versions of an image
 */
export const createImageVersions = async (
  file: File,
  versions: { name: string; options: OptimizationOptions }[]
): Promise<Record<string, OptimizationResult>> => {
  const results: Record<string, OptimizationResult> = {};

  for (const version of versions) {
    results[version.name] = await optimizeImage(file, version.options);
  }

  return results;
};

/**
 * Get compression statistics
 */
export const getCompressionStats = (
  originalSize: number,
  optimizedSize: number
): { savingsBytes: number; savingsPercent: number; ratio: string } => {
  const savingsBytes = originalSize - optimizedSize;
  const savingsPercent = Math.round((savingsBytes / originalSize) * 100);
  const ratio = `${(originalSize / optimizedSize).toFixed(1)}:1`;

  return { savingsBytes, savingsPercent, ratio };
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
};

/**
 * Validate image file
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload JPG, PNG, or WebP images.',
    };
  }

  // Check if file is too large (50MB pre-optimization limit)
  const maxPreOptimizationSize = 50 * 1024 * 1024;
  if (file.size > maxPreOptimizationSize) {
    return {
      valid: false,
      error: `File too large. Maximum size before optimization is ${formatFileSize(maxPreOptimizationSize)}.`,
    };
  }

  return { valid: true };
};
