import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Bookmark, Trash2, Star, Plus, AlertCircle } from 'lucide-react';
import { logger } from '../../lib/logger';
import { useAlert } from '../../contexts/AlertContext';

interface SavedFilter {
  id: string;
  name: string;
  filters: any;
  is_default: boolean;
  created_at: string;
}

interface LogSavedFilterManagerProps {
  filterType: 'audit' | 'system';
  currentFilters: any;
  onLoadFilter: (filters: any) => void;
  onClose: () => void;
}

export function LogSavedFilterManager({ filterType, currentFilters, onLoadFilter, onClose }: LogSavedFilterManagerProps) {
  const { showConfirm } = useAlert();
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveMode, setSaveMode] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [saving, setSaving] = useState(false);

  const tableName = filterType === 'audit' ? 'saved_audit_filters' : 'saved_system_filters';

  useEffect(() => {
    loadSavedFilters();
  }, [filterType]);

  const loadSavedFilters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedFilters(data || []);

      logger.info('Loaded saved filters', {
        component: 'LogSavedFilterManager',
        filterType,
        count: data?.length || 0
      }, 'USER_ACTION');
    } catch (err: any) {
      setError(err.message);
      logger.error('Failed to load saved filters', {
        component: 'LogSavedFilterManager',
        error: err.message
      }, 'DATABASE');
    } finally {
      setLoading(false);
    }
  };

  const saveFilter = async () => {
    if (!filterName.trim()) {
      setError('Please enter a filter name');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error: insertError } = await supabase
        .from(tableName)
        .insert({
          user_id: user.id,
          name: filterName.trim(),
          filters: currentFilters,
          is_default: false
        });

      if (insertError) throw insertError;

      logger.info('Saved filter', {
        component: 'LogSavedFilterManager',
        filterType,
        filterName: filterName.trim()
      }, 'USER_ACTION');

      setFilterName('');
      setSaveMode(false);
      await loadSavedFilters();
    } catch (err: any) {
      setError(err.message);
      logger.error('Failed to save filter', {
        component: 'LogSavedFilterManager',
        error: err.message
      }, 'DATABASE');
    } finally {
      setSaving(false);
    }
  };

  const deleteFilter = async (id: string, name: string) => {
    const confirmed = await showConfirm({
      variant: 'warning',
      title: 'Delete Filter',
      message: `Delete saved filter "${name}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;

      logger.info('Deleted filter', {
        component: 'LogSavedFilterManager',
        filterType,
        filterName: name
      }, 'USER_ACTION');

      await loadSavedFilters();
    } catch (err: any) {
      setError(err.message);
      logger.error('Failed to delete filter', {
        component: 'LogSavedFilterManager',
        error: err.message
      }, 'DATABASE');
    }
  };

  const setDefaultFilter = async (id: string) => {
    try {
      const { error } = await supabase
        .from(tableName)
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;

      logger.info('Set default filter', {
        component: 'LogSavedFilterManager',
        filterType,
        filterId: id
      }, 'USER_ACTION');

      await loadSavedFilters();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-slate-600 dark:text-gray-400">Loading saved filters...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle className="mr-2 flex-shrink-0" size={20} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Save Current Filter */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
          <Plus size={16} />
          Save Current Filter
        </h3>
        {saveMode ? (
          <div className="space-y-3">
            <input
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Enter filter name..."
              className="w-full px-3 py-2 border border-blue-300 dark:border-blue-700 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              onKeyDown={(e) => e.key === 'Enter' && saveFilter()}
            />
            <div className="flex gap-2">
              <button
                onClick={saveFilter}
                disabled={saving || !filterName.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setSaveMode(false);
                  setFilterName('');
                  setError('');
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-300 dark:hover:bg-gray-600 transition text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setSaveMode(true)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            Save Current Filter
          </button>
        )}
      </div>

      {/* Saved Filters List */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <Bookmark size={16} />
          Saved Filters ({savedFilters.length})
        </h3>

        {savedFilters.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 dark:bg-gray-800/50 rounded-lg border border-slate-200 dark:border-gray-700">
            <Bookmark className="mx-auto mb-2 text-slate-300 dark:text-gray-600" size={32} />
            <p className="text-slate-500 dark:text-gray-400 text-sm">No saved filters yet</p>
            <p className="text-slate-400 dark:text-gray-500 text-xs mt-1">
              Configure your filters and save them for quick access
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {savedFilters.map((filter) => (
              <div
                key={filter.id}
                className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-4 hover:border-blue-300 dark:hover:border-blue-700 transition group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-slate-800 dark:text-white truncate">
                        {filter.name}
                      </h4>
                      {filter.is_default && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium rounded">
                          <Star size={12} />
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      Saved {new Date(filter.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onLoadFilter(filter.filters);
                        logger.info('Loaded saved filter', {
                          component: 'LogSavedFilterManager',
                          filterType,
                          filterName: filter.name
                        }, 'USER_ACTION');
                      }}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                    >
                      Load
                    </button>
                    {!filter.is_default && (
                      <button
                        onClick={() => setDefaultFilter(filter.id)}
                        className="p-1.5 text-slate-400 hover:text-yellow-600 dark:hover:text-yellow-400 transition"
                        title="Set as default"
                      >
                        <Star size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteFilter(filter.id, filter.name)}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
