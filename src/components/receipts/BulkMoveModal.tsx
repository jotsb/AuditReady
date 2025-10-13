import { useState, useEffect } from 'react';
import { X, FolderInput } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

interface BulkMoveModalProps {
  selectedCount: number;
  currentCollectionId: string;
  onConfirm: (collectionId: string) => void;
  onClose: () => void;
}

export function BulkMoveModal({ selectedCount, currentCollectionId, onConfirm, onClose }: BulkMoveModalProps) {
  const [collectionId, setCollectionId] = useState('');
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*, businesses(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Filter out current collection
      setCollections((data || []).filter(c => c.id !== currentCollectionId));
    } catch (error) {
      logger.error('Error loading collections', error as Error, {
        currentCollectionId,
        component: 'BulkMoveModal',
        operation: 'load_collections'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionId) {
      alert('Please select a collection');
      return;
    }
    onConfirm(collectionId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <FolderInput size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
                Move to Collection
              </h2>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                {selectedCount} receipt{selectedCount !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Destination Collection
            </label>
            {loading ? (
              <div className="text-center py-4 text-slate-500 dark:text-gray-400">
                Loading collections...
              </div>
            ) : collections.length === 0 ? (
              <div className="text-center py-4 text-slate-500 dark:text-gray-400">
                No other collections available
              </div>
            ) : (
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              >
                <option value="">Choose a collection...</option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.businesses?.name} - {col.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              This will move all {selectedCount} selected receipt{selectedCount !== 1 ? 's' : ''} to the chosen collection.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !collectionId || collections.length === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Move Receipts
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
