import { useState, useEffect } from 'react';
import { Camera, Plus, Upload, FileText, X } from 'lucide-react';

interface FloatingActionButtonProps {
  onTakePhotoClick: () => void;
  onUploadClick: () => void;
  onManualEntryClick: () => void;
}

export function FloatingActionButton({ onTakePhotoClick, onUploadClick, onManualEntryClick }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsOpen(prev => !prev);
        }
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isOpen]);

  const handleTakePhoto = () => {
    setIsOpen(false);
    onTakePhotoClick();
  };

  const handleUpload = () => {
    setIsOpen(false);
    onUploadClick();
  };

  const handleManualEntry = () => {
    setIsOpen(false);
    onManualEntryClick();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className="fixed bottom-6 right-6 z-30 flex items-end gap-3">
        <div className={`flex flex-col gap-3 transition-all duration-300 ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}`}>
          <button
            onClick={handleTakePhoto}
            className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 text-slate-800 dark:text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-slate-200 dark:border-gray-700 whitespace-nowrap"
            title="Take Photo"
          >
            <Camera size={20} />
            <span className="font-medium">Take Photo</span>
          </button>

          <button
            onClick={handleUpload}
            className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 text-slate-800 dark:text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-slate-200 dark:border-gray-700 whitespace-nowrap"
            title="Upload Receipt (Image/PDF)"
          >
            <Upload size={20} />
            <span className="font-medium">Upload Receipt</span>
          </button>

          <button
            onClick={handleManualEntry}
            className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 text-slate-800 dark:text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105 border border-slate-200 dark:border-gray-700 whitespace-nowrap"
            title="Manual Entry"
          >
            <FileText size={20} />
            <span className="font-medium">Manual Entry</span>
          </button>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group ${isOpen ? 'rotate-45' : ''}`}
          title="Quick Capture (Press C)"
        >
          {isOpen ? (
            <X size={24} className="transition-transform" />
          ) : (
            <Plus size={24} className="transition-transform" />
          )}
        </button>

        {!isOpen && (
          <div className="absolute -top-12 right-0 bg-slate-800 dark:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Press <kbd className="px-1.5 py-0.5 bg-slate-700 dark:bg-gray-600 rounded">C</kbd> for quick capture
          </div>
        )}
      </div>
    </>
  );
}
