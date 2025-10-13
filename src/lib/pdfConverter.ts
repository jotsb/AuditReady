import * as pdfjsLib from 'pdfjs-dist';

// Use local worker file from node_modules to avoid CSP issues
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export interface ConvertedPage {
  blob: Blob;
  pageNumber: number;
}

export async function convertPdfToImages(pdfFile: File): Promise<ConvertedPage[]> {
  try {
    console.log('Starting PDF conversion:', pdfFile.name, 'Size:', pdfFile.size);

    const arrayBuffer = await pdfFile.arrayBuffer();
    console.log('ArrayBuffer created, size:', arrayBuffer.byteLength);

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      useWorkerFetch: false,
      isEvalSupported: false,
      disableAutoFetch: true,
      disableStream: true
    });

    const pdf = await loadingTask.promise;
    console.log('PDF loaded successfully, pages:', pdf.numPages);

    const pages: ConvertedPage[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`Rendering page ${pageNum} of ${pdf.numPages}`);

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', { alpha: false });

      if (!context) {
        throw new Error('Failed to get canvas context');
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        background: 'white'
      };

      await page.render(renderContext).promise;
      console.log(`Page ${pageNum} rendered successfully`);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        }, 'image/jpeg', 0.92);
      });

      console.log(`Page ${pageNum} converted to blob, size:`, blob.size);
      pages.push({ blob, pageNumber: pageNum });
    }

    console.log('PDF conversion completed successfully');
    return pages;
  } catch (error) {
    console.error('PDF conversion error:', error);
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }
    throw new Error(`Failed to convert PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
