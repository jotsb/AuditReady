import { useState, useEffect, useRef, memo } from 'react';
import { FileText, Image as ImageIcon } from 'lucide-react';
import { loadThumbnailUrl } from '../../lib/thumbnailBatcher';

interface ReceiptThumbnailProps {
  thumbnailPath: string | null;
  filePath: string | null;
  vendorName: string;
  fileType?: string;
  className?: string;
}

function ReceiptThumbnailComponent({
  thumbnailPath,
  filePath,
  vendorName,
  fileType,
  className = ''
}: ReceiptThumbnailProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const pathToLoad = thumbnailPath || filePath;
    if (!pathToLoad) {
      setIsLoading(false);
      return;
    }

    async function loadImage() {
      try {
        const signedUrl = await loadThumbnailUrl(pathToLoad);
        setImageUrl(signedUrl);
      } catch (error) {
        console.error('Error loading thumbnail:', error);
        setImageUrl(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadImage();
  }, [isVisible, thumbnailPath, filePath]);

  const isPdf = fileType === 'pdf' || filePath?.toLowerCase().endsWith('.pdf');

  return (
    <div
      ref={imgRef}
      className={`relative flex items-center justify-center bg-slate-100 dark:bg-gray-700 rounded overflow-hidden ${className}`}
      style={{ width: '48px', height: '48px', minWidth: '48px' }}
    >
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        </div>
      ) : imageUrl && !isPdf ? (
        <img
          src={imageUrl}
          alt={vendorName}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImageUrl(null)}
        />
      ) : isPdf ? (
        <FileText size={24} className="text-red-600 dark:text-red-400" />
      ) : (
        <ImageIcon size={24} className="text-slate-400 dark:text-gray-500" />
      )}
    </div>
  );
}

export const ReceiptThumbnail = memo(ReceiptThumbnailComponent, (prevProps, nextProps) => {
  return (
    prevProps.thumbnailPath === nextProps.thumbnailPath &&
    prevProps.filePath === nextProps.filePath &&
    prevProps.vendorName === nextProps.vendorName &&
    prevProps.fileType === nextProps.fileType &&
    prevProps.className === nextProps.className
  );
});
