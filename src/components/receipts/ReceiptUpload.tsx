import { useState } from 'react';
import { Upload, Camera, X } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { optimizeImage, type OptimizedImages } from '../../lib/imageOptimizer';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ReceiptUploadProps {
  onUpload: (file: File, thumbnail: File) => Promise<void>;
  onClose: () => void;
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

export function ReceiptUpload({ onUpload, onClose }: ReceiptUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [optimizing, setOptimizing] = useState(false);

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
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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

            {!preview ? (
              <div className="space-y-4">
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-slate-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {converting || optimizing ? (
                      <>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-sm text-slate-600 dark:text-gray-400">
                          {converting ? 'Converting PDF...' : 'Optimizing image...'}
                        </p>
                      </>
                    ) : (
                      <>
                        <Upload size={48} className="text-slate-400 mb-4" />
                        <p className="mb-2 text-sm text-slate-600 dark:text-gray-400">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-slate-500">PNG, JPG, PDF up to 50MB</p>
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

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-slate-500">or</span>
                  </div>
                </div>

                <label className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg cursor-pointer hover:bg-slate-200 dark:bg-gray-700 transition">
                  <Camera size={20} />
                  <span className="font-medium">Take Photo</span>
                  <input
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
                        <Upload size={48} className="text-slate-400 mx-auto mb-2" />
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
            <button
              type="submit"
              disabled={!file || loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Uploading...' : 'Upload & Extract Data'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-300 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
