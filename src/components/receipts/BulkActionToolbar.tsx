import { useState } from 'react';
import { Trash2, Tag, FolderInput, Download, X } from 'lucide-react';

interface BulkActionToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onCategorize: () => void;
  onMove: () => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onCancel: () => void;
}

export function BulkActionToolbar({
  selectedCount,
  onDelete,
  onCategorize,
  onMove,
  onExportCSV,
  onExportPDF,
  onCancel,
}: BulkActionToolbarProps) {
  const [showExportMenu, setShowExportMenu] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-blue-600 dark:bg-blue-700 text-white rounded-lg shadow-2xl px-6 py-4 flex items-center gap-4">
        <span className="font-semibold">
          {selectedCount} {selectedCount === 1 ? 'receipt' : 'receipts'} selected
        </span>

        <div className="flex items-center gap-2 border-l border-blue-400 pl-4">
          <button
            onClick={onCategorize}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            title="Categorize"
          >
            <Tag size={18} />
            <span className="hidden sm:inline">Categorize</span>
          </button>

          <button
            onClick={onMove}
            className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
            title="Move to Collection"
          >
            <FolderInput size={18} />
            <span className="hidden sm:inline">Move</span>
          </button>

          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              onBlur={() => setTimeout(() => setShowExportMenu(false), 200)}
              className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
              title="Export"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Export</span>
            </button>

            {showExportMenu && (
              <div className="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-slate-200 dark:border-gray-700 overflow-hidden min-w-[120px]">
                <button
                  onClick={() => {
                    onExportCSV();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 transition"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => {
                    onExportPDF();
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 transition"
                >
                  Export PDF
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition"
            title="Delete"
          >
            <Trash2 size={18} />
            <span className="hidden sm:inline">Delete</span>
          </button>
        </div>

        <button
          onClick={onCancel}
          className="ml-2 p-2 hover:bg-white/10 rounded-lg transition"
          title="Cancel Selection"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
