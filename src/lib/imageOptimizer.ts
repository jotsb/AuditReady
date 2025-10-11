import { logger } from './logger';

export interface OptimizedImages {
  full: File;
  thumbnail: File;
}

export interface ImageOptimizationOptions {
  maxDimension?: number;
  thumbnailSize?: number;
  quality?: number;
}

const DEFAULT_OPTIONS: Required<ImageOptimizationOptions> = {
  maxDimension: 2048,
  thumbnailSize: 200,
  quality: 0.92,
};

async function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

function calculateDimensions(
  currentWidth: number,
  currentHeight: number,
  maxDimension: number
): { width: number; height: number; needsResize: boolean } {
  if (currentWidth <= maxDimension && currentHeight <= maxDimension) {
    return {
      width: currentWidth,
      height: currentHeight,
      needsResize: false,
    };
  }

  const aspectRatio = currentWidth / currentHeight;
  let width: number;
  let height: number;

  if (currentWidth > currentHeight) {
    width = maxDimension;
    height = Math.round(maxDimension / aspectRatio);
  } else {
    height = maxDimension;
    width = Math.round(maxDimension * aspectRatio);
  }

  return { width, height, needsResize: true };
}

async function processImage(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  quality: number,
  fileName: string
): Promise<File> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create blob'));
          return;
        }

        const webpFileName = fileName.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');
        const file = new File([blob], webpFileName, { type: 'image/webp' });
        resolve(file);
      },
      'image/webp',
      quality
    );
  });
}

export async function optimizeImage(
  file: File,
  options: ImageOptimizationOptions = {}
): Promise<OptimizedImages> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (!file.type.startsWith('image/')) {
    throw new Error('File must be an image');
  }

  const img = await loadImage(file);

  const fullDimensions = calculateDimensions(
    img.width,
    img.height,
    opts.maxDimension
  );

  logger.debug('Image optimization', {
    original: { width: img.width, height: img.height, size: file.size },
    optimized: { width: fullDimensions.width, height: fullDimensions.height },
    needsResize: fullDimensions.needsResize,
  }, 'PERFORMANCE');

  const [fullImage, thumbnail] = await Promise.all([
    processImage(
      img,
      fullDimensions.width,
      fullDimensions.height,
      opts.quality,
      file.name
    ),
    processImage(
      img,
      opts.thumbnailSize,
      opts.thumbnailSize,
      0.85,
      `thumb_${file.name}`
    ),
  ]);

  return { full: fullImage, thumbnail };
}

export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  const img = await loadImage(file);
  return { width: img.width, height: img.height };
}
