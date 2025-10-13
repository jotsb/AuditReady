import { useState, useRef } from 'react';
import { Camera, Plus, Check, X, RotateCcw, Trash2, Loader2 } from 'lucide-react';
import { optimizeImage } from '../../lib/imageOptimizer';
import { PageThumbnailStrip } from './PageThumbnailStrip';
import { logger } from '../../lib/logger';

export interface CapturedPage {
  id: string;
  file: File;
  thumbnail: File;
  preview: string;
  pageNumber: number;
}

interface MultiPageCameraCaptureProps {
  onComplete: (pages: CapturedPage[]) => Promise<void>;
  onCancel: () => void;
}

type CaptureMode = 'capture' | 'preview' | 'review';

export function MultiPageCameraCapture({ onComplete, onCancel }: MultiPageCameraCaptureProps) {
  const [capturedPages, setCapturedPages] = useState<CapturedPage[]>([]);
  const [currentMode, setCurrentMode] = useState<CaptureMode>('capture');
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);
  const [tempPage, setTempPage] = useState<CapturedPage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    try {
      const optimized = await optimizeImage(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        const preview = reader.result as string;
        setCurrentPreview(preview);

        const newPage: CapturedPage = {
          id: crypto.randomUUID(),
          file: optimized.full,
          thumbnail: optimized.thumbnail,
          preview,
          pageNumber: capturedPages.length + 1,
        };

        setTempPage(newPage);
        setCurrentMode('preview');
      };
      reader.readAsDataURL(optimized.full);
    } catch (error) {
      logger.error('Image processing error', error as Error, {
        pageNumber: capturedPages.length + 1,
        component: 'MultiPageCameraCapture',
        operation: 'process_camera_image'
      });
      alert('Failed to process image. Please try again.');
    } finally {
      setProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmPage = () => {
    if (!tempPage) return;
    setCapturedPages([...capturedPages, tempPage]);
    setTempPage(null);
    setCurrentPreview(null);
    setCurrentMode('review');
  };

  const handleRetakePage = () => {
    setTempPage(null);
    setCurrentPreview(null);
    setCurrentMode('capture');
    triggerCamera();
  };

  const handleAddAnotherPage = () => {
    setCurrentMode('capture');
    triggerCamera();
  };

  const handleRemovePage = (pageNumber: number) => {
    const updatedPages = capturedPages
      .filter((p) => p.pageNumber !== pageNumber)
      .map((p, index) => ({ ...p, pageNumber: index + 1 }));

    setCapturedPages(updatedPages);

    if (updatedPages.length === 0) {
      setCurrentMode('capture');
    }
  };

  const handleComplete = async () => {
    if (capturedPages.length === 0) return;

    setUploading(true);
    try {
      await onComplete(capturedPages);
    } catch (error) {
      logger.error('Multi-page upload failed from review', error as Error, {
        pageCount: capturedPages.length,
        component: 'MultiPageCameraCapture',
        operation: 'complete_multipage_review'
      });
      alert('Upload failed. Please try again.');
      setUploading(false);
    }
  };

  const handleFinishSinglePage = async () => {
    if (!tempPage) return;

    setUploading(true);
    try {
      await onComplete([tempPage]);
    } catch (error) {
      logger.error('Single page upload failed from preview', error as Error, {
        pageNumber: tempPage.pageNumber,
        component: 'MultiPageCameraCapture',
        operation: 'complete_single_preview'
      });
      alert('Upload failed. Please try again.');
      setUploading(false);
    }
  };

  if (currentMode === 'capture') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                {capturedPages.length === 0 ? 'Take Receipt Photo' : `Capture Page ${capturedPages.length + 1}`}
              </h2>
              {capturedPages.length > 0 && (
                <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
                  {capturedPages.length} {capturedPages.length === 1 ? 'page' : 'pages'} captured
                </p>
              )}
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <X size={24} className="text-slate-600 dark:text-gray-400" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoCapture}
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-4">
              {processing ? (
                <div className="flex flex-col items-center py-12">
                  <Loader2 size={48} className="text-blue-600 animate-spin mb-4" />
                  <p className="text-slate-600 dark:text-gray-400">Processing image...</p>
                </div>
              ) : (
                <>
                  <button
                    onClick={triggerCamera}
                    className="w-full max-w-sm py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-gray-600 rounded-lg hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition"
                  >
                    <Camera size={64} className="text-slate-400 dark:text-gray-500 mb-4" />
                    <span className="text-lg font-medium text-slate-700 dark:text-gray-300">
                      Take Photo
                    </span>
                    <span className="text-sm text-slate-500 dark:text-gray-400 mt-2">
                      Position receipt clearly and well-lit
                    </span>
                  </button>

                  {capturedPages.length > 0 && (
                    <div className="w-full space-y-4">
                      <div className="border-t border-slate-200 dark:border-gray-700 pt-4">
                        <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                          Captured Pages
                        </h3>
                        <PageThumbnailStrip
                          pages={capturedPages.map((p) => ({
                            id: p.id,
                            preview: p.preview,
                            pageNumber: p.pageNumber,
                          }))}
                          showRemove={true}
                          onPageRemove={handleRemovePage}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3">
              {capturedPages.length > 0 && (
                <button
                  onClick={handleComplete}
                  disabled={uploading || processing}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Check size={20} />
                      Upload {capturedPages.length} {capturedPages.length === 1 ? 'Page' : 'Pages'}
                    </>
                  )}
                </button>
              )}
              <button
                onClick={onCancel}
                disabled={uploading || processing}
                className="px-6 py-3 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (currentMode === 'preview') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              Page {capturedPages.length + 1} Preview
            </h2>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <X size={24} className="text-slate-600 dark:text-gray-400" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="aspect-[3/4] w-full max-w-md mx-auto rounded-lg overflow-hidden border-2 border-slate-200 dark:border-gray-700">
              <img
                src={currentPreview || ''}
                alt="Preview"
                className="w-full h-full object-contain bg-slate-50 dark:bg-gray-900"
              />
            </div>

            <div className="space-y-3">
              <button
                onClick={handleConfirmPage}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
              >
                <Check size={20} />
                Looks Good
              </button>

              <button
                onClick={handleRetakePage}
                className="w-full border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 py-3 px-4 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition font-medium flex items-center justify-center gap-2"
              >
                <RotateCcw size={20} />
                Retake Photo
              </button>
            </div>

            {capturedPages.length === 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-slate-700 dark:text-gray-300 font-medium mb-2">
                  Is this receipt multi-page?
                </p>
                <p className="text-xs text-slate-600 dark:text-gray-400">
                  You can add more pages after confirming this one, or upload just this page now.
                </p>
                <button
                  onClick={handleFinishSinglePage}
                  disabled={uploading}
                  className="mt-3 w-full bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 py-2 px-4 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Upload Single Page
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (currentMode === 'review') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
                Receipt Pages ({capturedPages.length})
              </h2>
              <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
                Review all pages before uploading
              </p>
            </div>
            <button
              onClick={onCancel}
              disabled={uploading}
              className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
            >
              <X size={24} className="text-slate-600 dark:text-gray-400" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {capturedPages.map((page) => (
                <div key={page.id} className="relative group">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden border-2 border-slate-200 dark:border-gray-700">
                    <img
                      src={page.preview}
                      alt={`Page ${page.pageNumber}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute bottom-2 left-2 bg-slate-900 bg-opacity-75 text-white px-2 py-1 rounded text-xs font-medium">
                    Page {page.pageNumber}
                  </div>
                  <button
                    onClick={() => handleRemovePage(page.pageNumber)}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg hover:bg-red-600"
                    aria-label="Remove page"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <button
                onClick={handleAddAnotherPage}
                disabled={uploading}
                className="w-full border-2 border-dashed border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 py-3 px-4 rounded-lg hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Plus size={20} />
                Add Another Page
              </button>

              {capturedPages.length > 1 && (
                <button
                  onClick={() => handleRemovePage(capturedPages.length)}
                  disabled={uploading}
                  className="w-full border border-slate-300 dark:border-gray-600 text-red-600 dark:text-red-400 py-2 px-4 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Trash2 size={18} />
                  Remove Last Page
                </button>
              )}

              <button
                onClick={handleComplete}
                disabled={uploading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Check size={20} />
                    Upload {capturedPages.length} Pages
                  </>
                )}
              </button>

              <button
                onClick={onCancel}
                disabled={uploading}
                className="w-full text-slate-600 dark:text-gray-400 py-2 hover:text-slate-800 dark:hover:text-gray-200 transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
