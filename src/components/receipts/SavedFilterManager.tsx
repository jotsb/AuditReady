import { useState, useEffect } from 'react';
import { Save, Trash2, Star, StarOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface SavedFilter {
  id: string;
  name: string;
  filters: any;
  is_default: boolean;
  created_at: string;
}

interface SavedFilterManagerProps {
  currentFilters: any;
  onLoadFilter: (filters: any) => void;
  onClose?: () => void;
}

export function SavedFilterManager({
  currentFilters,
  onLoadFilter,
  onClose
}: SavedFilterManagerProps) {
  const { user } = useAuth();
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  useEffect(() => {
    loadSavedFilters();
  }, []);

  const loadSavedFilters = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_filters')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedFilters(data || []);
    } catch (error) {
      console.error('Error loading saved filters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFilter = async () => {
    if (!user || !filterName.trim()) {
      alert('Please enter a filter name');
      return;
    }

    try {
      const { error } = await supabase
        .from('saved_filters')
        .insert({
          user_id: user.id,
          name: filterName.trim(),
          filters: currentFilters,
          is_default: saveAsDefault
        });

      if (error) throw error;

      await loadSavedFilters();
      setShowSaveDialog(false);
      setFilterName('');
      setSaveAsDefault(false);
      alert('Filter saved successfully!');
    } catch (error) {
      console.error('Error saving filter:', error);
      alert('Failed to save filter. Please try again.');
    }
  };

  const handleDeleteFilter = async (filterId: string) => {
    if (!confirm('Are you sure you want to delete this saved filter?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('saved_filters')
        .delete()
        .eq('id', filterId);

      if (error) throw error;
      await loadSavedFilters();
    } catch (error) {
      console.error('Error deleting filter:', error);
      alert('Failed to delete filter. Please try again.');
    }
  };

  const handleToggleDefault = async (filterId: string, currentDefault: boolean) => {
    try {
      const { error } = await supabase
        .from('saved_filters')
        .update({ is_default: !currentDefault })
        .eq('id', filterId);

      if (error) throw error;
      await loadSavedFilters();
    } catch (error) {
      console.error('Error updating default filter:', error);
      alert('Failed to update default filter. Please try again.');
    }
  };

  const hasActiveFilters =
    currentFilters.dateFrom ||
    currentFilters.dateTo ||
    currentFilters.amountMin ||
    currentFilters.amountMax ||
    currentFilters.paymentMethod ||
    (currentFilters.categories && currentFilters.categories.length > 0);

  if (loading) {
    return (
      <div className="p-4 text-center text-slate-500 dark:text-gray-400">
        Loading saved filters...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Save Current Filter */}
      {hasActiveFilters && (
        <div className="border-b border-slate-200 dark:border-gray-700 pb-4">
          {showSaveDialog ? (
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Filter name (e.g., 'Large Expenses Q1')"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                autoFocus
              />
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={saveAsDefault}
                  onChange={(e) => setSaveAsDefault(e.target.checked)}
                  className="rounded"
                />
                Set as default filter
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveFilter}
                  disabled={!filterName.trim()}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setFilterName('');
                    setSaveAsDefault(false);
                  }}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveDialog(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Save size={18} />
              Save Current Filter
            </button>
          )}
        </div>
      )}

      {/* Saved Filters List */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">
          Saved Filters ({savedFilters.length})
        </h3>

        {savedFilters.length === 0 ? (
          <div className="text-center py-8 text-slate-500 dark:text-gray-400">
            <p className="text-sm">No saved filters yet</p>
            <p className="text-xs mt-1">Apply filters and save them for quick access</p>
          </div>
        ) : (
          <div className="space-y-2">
            {savedFilters.map((filter) => (
              <div
                key={filter.id}
                className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-gray-700 rounded-lg group hover:bg-slate-100 dark:hover:bg-gray-600 transition"
              >
                <button
                  onClick={() => handleToggleDefault(filter.id, filter.is_default)}
                  className="text-slate-400 hover:text-yellow-500 transition"
                  title={filter.is_default ? 'Remove as default' : 'Set as default'}
                >
                  {filter.is_default ? (
                    <Star size={18} className="fill-yellow-500 text-yellow-500" />
                  ) : (
                    <StarOff size={18} />
                  )}
                </button>

                <button
                  onClick={() => onLoadFilter(filter.filters)}
                  className="flex-1 text-left"
                >
                  <div className="text-sm font-medium text-slate-800 dark:text-white">
                    {filter.name}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-gray-400">
                    {new Date(filter.created_at).toLocaleDateString()}
                  </div>
                </button>

                <button
                  onClick={() => handleDeleteFilter(filter.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                  title="Delete filter"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
