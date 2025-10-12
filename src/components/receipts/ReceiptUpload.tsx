import { useState, useEffect, useRef } from 'react';
import { Upload, Camera, X, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { optimizeImage, type OptimizedImages } from '../../lib/imageOptimizer';
import { PageThumbnailStrip } from './PageThumbnailStrip';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ReceiptUploadProps {
  onUpload: (file: File, thumbnail: File) => Promise<void>;
  onMultiPageUpload?: (files: Array<{ file: File; thumbnail: File }>) => Promise<void>;
  onClose: () => void;
  autoTriggerPhoto?: boolean;
}

async function convertPdfToImage(pdfFile: File): Promise<File> {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);

  const scale = 2;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context');

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({
    canvasContext: context,
    viewport: viewport
  }).promise;

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const imageFile = new File([blob], pdfFile.name.replace('.pdf', '.png'), { type: 'image/png' });
        resolve(imageFile);
      }
    }, 'image/png', 0.95);
  });
}

async function convertMultiPagePdfToImages(pdfFile: File): Promise<File[]> {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const images: File[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = 2;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;

    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/png', 0.95);
    });

    const imageFile = new File(
      [blob],
      `${pdfFile.name.replace('.pdf', '')}_page_${i}.png`,
      { type: 'image/png' }
    );

    images.push(imageFile);
  }

  return images;
}

interface ProcessedFile {
  id: string;
  file: File;
  thumbnail: File;
  preview: string;
  pageNumber: number;
}

export function ReceiptUpload({ onUpload, onMultiPageUpload, onClose, autoTriggerPhoto = false }: ReceiptUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [multiPageFiles, setMultiPageFiles] = useState<ProcessedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const multiFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoTriggerPhoto && photoInputRef.current) {
      photoInputRef.current.click();
    }
  }, [autoTriggerPhoto]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      let fileToUse = selectedFile;

      if (selectedFile.type === 'application/pdf') {
        setConverting(true);
        try {
          fileToUse = await convertPdfToImage(selectedFile);
        } catch (error) {
          console.error('PDF conversion error:', error);
          alert('Failed to convert PDF. Please try a different file.');
          setConverting(false);
          return;
        }
        setConverting(false);
      }

      setOptimizing(true);
      try {
        const optimized = await optimizeImage(fileToUse);

        setFile(optimized.full);
        setThumbnail(optimized.thumbnail);

        const reader = new FileReader();
        reader.onloadend = () => {
          setPreview(reader.result as string);
        };
        reader.readAsDataURL(optimized.full);
      } catch (error) {
        console.error('Image optimization error:', error);
        alert('Failed to optimize image. Please try a different file.');
      } finally {
        setOptimizing(false);
      }
    }
  };

  const handleMultiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setOptimizing(true);
    const processedFiles: ProcessedFile[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        let filesToProcess: File[] = [file];

        if (file.type === 'application/pdf') {
          setConverting(true);
          try {
            filesToProcess = await convertMultiPagePdfToImages(file);
          } catch (error) {
            console.error('PDF conversion error:', error);
            alert(`Failed to convert PDF: ${file.name}`);
            continue;
          } finally {
            setConverting(false);
          }
        }

        for (const fileToProcess of filesToProcess) {
          const optimized = await optimizeImage(fileToProcess);
          const reader = new FileReader();
          const preview = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(optimized.full);
          });

          processedFiles.push({
            id: crypto.randomUUID(),
            file: optimized.full,
            thumbnail: optimized.thumbnail,
            preview,
            pageNumber: processedFiles.length + 1,
          });
        }
      }

      setMultiPageFiles(processedFiles);
    } catch (error) {
      console.error('Multi-file processing error:', error);
      alert('Failed to process files. Please try again.');
    } finally {
      setOptimizing(false);
      if (multiFileInputRef.current) {
        multiFileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveMultiPage = (pageNumber: number) => {
    const updatedFiles = multiPageFiles
      .filter((f) => f.pageNumber !== pageNumber)
      .map((f, index) => ({ ...f, pageNumber: index + 1 }));
    setMultiPageFiles(updatedFiles);
  };

  const handleMultiPageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (multiPageFiles.length === 0 || !onMultiPageUpload) return;

    setLoading(true);
    try {
      await onMultiPageUpload(
        multiPageFiles.map((f) => ({
          file: f.file,
          thumbnail: f.thumbnail,
        }))
      );
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !thumbnail) return;

    setLoading(true);
    try {
      await onUpload(file, thumbnail);
      onClose();
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Upload Receipt</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 dark:bg-gray-700 rounded-lg transition"
          >
            <X size={24} className="text-slate-600 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-4">
              Select Receipt Image or PDF
            </label>

            {multiPageFiles.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-800 dark:text-gray-200 mb-1">
                    {multiPageFiles.length} {multiPageFiles.length === 1 ? 'page' : 'pages'} selected
                  </p>
                  <p className="text-xs text-slate-600 dark:text-gray-400">
                    These pages will be uploaded as a single multi-page receipt
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-96 overflow-y-auto p-2">
                  {multiPageFiles.map((file) => (
                    <div key={file.id} className="relative group">
                      <div className="aspect-[3/4] rounded-lg overflow-hidden border-2 border-slate-200 dark:border-gray-700">
                        <img
                          src={file.preview}
                          alt={`Page ${file.pageNumber}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute bottom-2 left-2 bg-slate-900 bg-opacity-75 text-white px-2 py-1 rounded text-xs font-medium">
                        Page {file.pageNumber}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMultiPage(file.pageNumber)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg hover:bg-red-600"
                        aria-label="Remove page"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMultiPageFiles([]);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Clear all pages
                </button>
              </div>
            ) : !preview ? (
              <div className="space-y-4">
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {converting || optimizing ? (
                      <>
                        <Loader2 size={48} className="text-blue-600 animate-spin mb-4" />
                        <p className="text-sm text-slate-600 dark:text-gray-400">
                          {converting ? 'Converting PDF...' : 'Optimizing images...'}
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload size={48} className="text-slate-400 dark:text-gray-500 mb-4" />
                        <p className="mb-2 text-sm text-slate-600 dark:text-gray-400">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">Single file: PNG, JPG, PDF</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    disabled={converting || optimizing}
                  />
                </label>

                {onMultiPageUpload && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-300 dark:border-gray-600"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-gray-800 text-slate-500 dark:text-gray-400">or</span>
                      </div>
                    </div>

                    <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition">
                      <Upload size={20} />
                      <span className="font-medium">Upload Multiple Pages</span>
                      <input
                        ref={multiFileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*,.pdf"
                        multiple
                        onChange={handleMultiFileChange}
                        disabled={converting || optimizing}
                      />
                    </label>
                  </>
                )}

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-300 dark:border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-gray-800 text-slate-500 dark:text-gray-400">or</span>
                  </div>
                </div>

                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg cursor-pointer hover:bg-slate-200 dark:hover:bg-gray-600 transition">
                  <Camera size={20} />
                  <span className="font-medium">Take Photo</span>
                  <input
                    ref={photoInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative border border-slate-200 rounded-lg overflow-hidden">
                  {file?.type.startsWith('image/') ? (
                    <img src={preview} alt="Receipt preview" className="w-full" />
                  ) : (
                    <div className="flex items-center justify-center h-64 bg-slate-50">
                      <div className="text-center">
                        <Upload size={48} className="text-slate-400 dark:text-gray-500 mx-auto mb-2" />
                        <p className="text-slate-600 dark:text-gray-400">{file?.name}</p>
                      </div>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-800 dark:text-white"
                >
                  Choose different file
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {multiPageFiles.length > 0 ? (
              <button
                type="button"
                onClick={handleMultiPageSubmit}
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  `Upload ${multiPageFiles.length} ${multiPageFiles.length === 1 ? 'Page' : 'Pages'}`
                )}
              </button>
            ) : (
              <button
                type="submit"
                disabled={!file || loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Uploading...' : 'Upload & Extract Data'}
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-6 py-3 bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-300 dark:hover:bg-gray-600 transition disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
