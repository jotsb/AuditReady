/**
 * Image Metadata Stripper
 *
 * Removes EXIF and other metadata from images before upload for privacy protection.
 *
 * Features:
 * - Remove EXIF data (GPS, camera info, timestamps)
 * - Remove ICC color profiles
 * - Preserve image quality
 * - Support JPEG, PNG, WebP
 * - Client-side processing (no server upload needed)
 */

import { logger } from './logger';

export interface ImageMetadataStripResult {
  success: boolean;
  file: File | null;
  originalSize: number;
  newSize: number;
  metadata?: {
    strippedEXIF: boolean;
    strippedICC: boolean;
    format: string;
  };
  error?: string;
}

/**
 * Strip metadata from an image file
 * @param file - The image file to process
 * @param quality - JPEG quality (0.1 to 1.0), default 0.92
 * @returns Promise with the cleaned file and metadata
 */
export async function stripImageMetadata(
  file: File,
  quality: number = 0.92
): Promise<ImageMetadataStripResult> {
  const startTime = performance.now();

  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      return {
        success: false,
        file: null,
        originalSize: file.size,
        newSize: 0,
        error: 'File is not an image'
      };
    }

    // For PDFs, return as-is (no metadata stripping needed)
    if (file.type === 'application/pdf') {
      return {
        success: true,
        file,
        originalSize: file.size,
        newSize: file.size,
        metadata: {
          strippedEXIF: false,
          strippedICC: false,
          format: 'pdf'
        }
      };
    }

    const originalSize = file.size;

    // Load image
    const img = await loadImage(file);

    // Create canvas and draw image (this strips metadata automatically)
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw image (EXIF data is lost here)
    ctx.drawImage(img, 0, 0);

    // Convert to blob
    const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, mimeType, quality);

    // Create new file
    const cleanedFile = new File(
      [blob],
      file.name,
      { type: mimeType, lastModified: Date.now() }
    );

    const newSize = cleanedFile.size;
    const executionTime = performance.now() - startTime;

    logger.info('Image metadata stripped successfully', {
      fileName: file.name,
      originalSize,
      newSize,
      reduction: ((originalSize - newSize) / originalSize * 100).toFixed(2) + '%',
      executionTime: Math.round(executionTime) + 'ms'
    });

    return {
      success: true,
      file: cleanedFile,
      originalSize,
      newSize,
      metadata: {
        strippedEXIF: true,
        strippedICC: true,
        format: mimeType
      }
    };

  } catch (error: any) {
    logger.error('Failed to strip image metadata', error as Error, {
      fileName: file.name,
      fileType: file.type
    });

    return {
      success: false,
      file: null,
      originalSize: file.size,
      newSize: 0,
      error: error.message || 'Unknown error'
    };
  }
}

/**
 * Strip metadata from multiple images
 * @param files - Array of image files
 * @param quality - JPEG quality
 * @returns Promise with array of results
 */
export async function stripMultipleImageMetadata(
  files: File[],
  quality: number = 0.92
): Promise<ImageMetadataStripResult[]> {
  const results = await Promise.all(
    files.map(file => stripImageMetadata(file, quality))
  );

  const successCount = results.filter(r => r.success).length;
  logger.info('Batch metadata stripping complete', {
    total: files.length,
    success: successCount,
    failed: files.length - successCount
  });

  return results;
}

/**
 * Load image from file
 */
function loadImage(file: File): Promise<HTMLImageElement> {
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

/**
 * Convert canvas to blob
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Check if file has EXIF data (estimation based on file structure)
 * Note: This is a simple check, not 100% accurate
 * @param file - Image file to check
 * @returns Promise<boolean>
 */
export async function hasEXIFData(file: File): Promise<boolean> {
  try {
    // Only JPEG files typically have EXIF
    if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
      return false;
    }

    // Read first 12 bytes to check for EXIF marker
    const buffer = await file.slice(0, 12).arrayBuffer();
    const view = new DataView(buffer);

    // Check for JPEG SOI marker (0xFFD8)
    if (view.getUint16(0) !== 0xFFD8) {
      return false;
    }

    // Check for APP1 marker (0xFFE1) which contains EXIF
    // or APP0 marker (0xFFE0) which may contain metadata
    const marker = view.getUint16(2);
    return marker === 0xFFE1 || marker === 0xFFE0;

  } catch (error) {
    logger.warn('Failed to check EXIF data', { error, fileName: file.name });
    return false;
  }
}

/**
 * Get estimated metadata size
 * This is approximate - actual EXIF size varies
 */
export function estimateMetadataSize(fileSize: number, hasEXIF: boolean): number {
  if (!hasEXIF) return 0;

  // EXIF data is typically 10-50 KB, average ~20 KB
  // But it depends on the camera and settings
  // Return conservative estimate of 2-5% of file size
  return Math.min(fileSize * 0.03, 50000);
}

/**
 * Batch process images before upload
 * Convenience function for upload flows
 */
export async function prepareImagesForUpload(
  files: FileList | File[],
  options: {
    stripMetadata?: boolean;
    quality?: number;
    maxSizeMB?: number;
  } = {}
): Promise<{
  files: File[];
  errors: string[];
  totalOriginalSize: number;
  totalNewSize: number;
}> {
  const {
    stripMetadata = true,
    quality = 0.92,
    maxSizeMB = 10
  } = options;

  const fileArray = Array.from(files);
  const results: File[] = [];
  const errors: string[] = [];
  let totalOriginalSize = 0;
  let totalNewSize = 0;

  for (const file of fileArray) {
    totalOriginalSize += file.size;

    // Check size limit
    if (file.size > maxSizeMB * 1024 * 1024) {
      errors.push(`${file.name}: Exceeds ${maxSizeMB}MB limit`);
      continue;
    }

    // Strip metadata if enabled
    if (stripMetadata && file.type.startsWith('image/')) {
      const result = await stripImageMetadata(file, quality);
      if (result.success && result.file) {
        results.push(result.file);
        totalNewSize += result.newSize;
      } else {
        errors.push(`${file.name}: ${result.error || 'Failed to process'}`);
      }
    } else {
      results.push(file);
      totalNewSize += file.size;
    }
  }

  logger.info('Prepared images for upload', {
    totalFiles: fileArray.length,
    successfulFiles: results.length,
    failedFiles: errors.length,
    totalOriginalSize,
    totalNewSize,
    reduction: totalOriginalSize > 0
      ? ((totalOriginalSize - totalNewSize) / totalOriginalSize * 100).toFixed(2) + '%'
      : '0%'
  });

  return {
    files: results,
    errors,
    totalOriginalSize,
    totalNewSize
  };
}
