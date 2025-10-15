import { Upload, CreditCard as Edit, Search, Filter, CheckSquare } from 'lucide-react';
import { Collection } from '../../hooks/useReceiptsData';
import { AdvancedFilters } from '../../hooks/useReceiptFilters';

interface ReceiptsHeaderProps {
  collections: Collection[];
  selectedCollection: string;
  onCollectionChange: (collectionId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterCategory: string;
  onCategoryChange: (category: string) => void;
  advancedFilters: AdvancedFilters;
  onShowAdvancedFilters: () => void;
  isSelectMode: boolean;
  onToggleSelectMode: () => void;
  onUploadClick: () => void;
  onManualEntryClick: () => void;
}

export function ReceiptsHeader({
  collections,
  selectedCollection,
  onCollectionChange,
  searchQuery,
  onSearchChange,
  filterCategory,
  onCategoryChange,
  advancedFilters,
  onShowAdvancedFilters,
  isSelectMode,
  onToggleSelectMode,
  onUploadClick,
  onManualEntryClick
}: ReceiptsHeaderProps) {
  const hasActiveFilters = advancedFilters.dateFrom || advancedFilters.dateTo ||
    advancedFilters.amountMin || advancedFilters.amountMax ||
    advancedFilters.paymentMethod || advancedFilters.categories.length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between mb-6">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Collection</label>
          <select
            value={selectedCollection}
            onChange={(e) => onCollectionChange(e.target.value)}
            className="w-full md:w-auto px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {collections.map((col) => (
              <option key={col.id} value={col.id}>
                {col.businesses?.name} - {col.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onToggleSelectMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              isSelectMode
                ? 'bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300'
                : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-gray-600'
            }`}
          >
            <CheckSquare size={20} />
            <span>{isSelectMode ? 'Cancel' : 'Select'}</span>
          </button>
          <button
            onClick={onUploadClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Upload size={20} />
            <span>Upload</span>
          </button>
          <button
            onClick={onManualEntryClick}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition"
          >
            <Edit size={20} />
            <span>Manual Entry</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search receipts..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div className="relative">
          <Filter size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-gray-500" />
          <select
            value={filterCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full md:w-auto pl-10 pr-8 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">All Categories</option>
            <option value="Meals & Entertainment">Meals & Entertainment</option>
            <option value="Transportation">Transportation</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="Miscellaneous">Miscellaneous</option>
          </select>
        </div>

        <button
          onClick={onShowAdvancedFilters}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-600 transition"
        >
          <Filter size={20} />
          <span>Advanced</span>
          {hasActiveFilters && (
            <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
              Active
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
