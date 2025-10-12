import { X } from 'lucide-react';

interface PageThumbnail {
  id: string;
  preview: string;
  pageNumber: number;
}

interface PageThumbnailStripProps {
  pages: PageThumbnail[];
  currentPage?: number;
  onPageClick?: (pageNumber: number) => void;
  onPageRemove?: (pageNumber: number) => void;
  showRemove?: boolean;
}

export function PageThumbnailStrip({
  pages,
  currentPage,
  onPageClick,
  onPageRemove,
  showRemove = false,
}: PageThumbnailStripProps) {
  if (pages.length === 0) return null;

  return (
    <div className="page-thumbnail-strip">
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {pages.map((page) => (
          <div
            key={page.id}
            className={`relative flex-shrink-0 ${
              onPageClick ? 'cursor-pointer' : ''
            }`}
            onClick={() => onPageClick?.(page.pageNumber)}
          >
            <div
              className={`w-20 h-28 rounded-lg border-2 overflow-hidden transition ${
                currentPage === page.pageNumber
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-slate-300 dark:border-gray-600 hover:border-blue-400'
              }`}
            >
              <img
                src={page.preview}
                alt={`Page ${page.pageNumber}`}
                className="w-full h-full object-cover"
              />
            </div>
            <div
              className={`absolute -bottom-1 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded text-xs font-medium ${
                currentPage === page.pageNumber
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300'
              }`}
            >
              {page.pageNumber}
            </div>
            {showRemove && onPageRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPageRemove(page.pageNumber);
                }}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition shadow-lg"
                aria-label="Remove page"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
