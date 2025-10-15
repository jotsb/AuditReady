export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export async function compressImage(
  arrayBuffer: ArrayBuffer,
  format: string,
  options: CompressionOptions = {}
): Promise<ArrayBuffer> {
  const {
    maxWidth = 1024,
    maxHeight = 1024,
    quality = 0.85
  } = options;

  try {
    const imageDecode = await import("https://deno.land/x/imagescript@1.3.0/mod.ts");

    const supportedFormats = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
    const lowerFormat = format.toLowerCase();

    if (!supportedFormats.includes(lowerFormat)) {
      return arrayBuffer;
    }

    let image = await imageDecode.Image.decode(new Uint8Array(arrayBuffer));

    if (image.width > maxWidth || image.height > maxHeight) {
      const aspectRatio = image.width / image.height;

      let newWidth = image.width;
      let newHeight = image.height;

      if (image.width > maxWidth) {
        newWidth = maxWidth;
        newHeight = Math.round(maxWidth / aspectRatio);
      }

      if (newHeight > maxHeight) {
        newHeight = maxHeight;
        newWidth = Math.round(maxHeight * aspectRatio);
      }

      image = image.resize(newWidth, newHeight);
    }

    let compressed: Uint8Array;
    if (lowerFormat === 'png') {
      compressed = await image.encodePNG();
    } else if (lowerFormat === 'webp') {
      compressed = await image.encodeWEBP(Math.round(quality * 100));
    } else {
      compressed = await image.encodeJPEG(Math.round(quality * 100));
    }

    return compressed.buffer;
  } catch (error) {
    console.warn('Image compression failed, using original:', error);
    return arrayBuffer;
  }
}

export function getImageFormat(filePath: string): string {
  const lowerPath = filePath.toLowerCase();

  if (lowerPath.endsWith('.png')) return 'png';
  if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) return 'jpeg';
  if (lowerPath.endsWith('.webp')) return 'webp';
  if (lowerPath.endsWith('.gif')) return 'gif';

  return 'jpeg';
}
