import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAlert } from '../../contexts/AlertContext';
import { CategorySuggestions } from './CategorySuggestions';
import { logger } from '../../lib/logger';

interface Category {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

interface CategoryManagementProps {
  businessId?: string;
}

export function CategoryManagement({ businessId }: CategoryManagementProps) {
  const { showConfirm } = useAlert();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCategories, setTotalCategories] = useState(0);
  const [reevaluating, setReevaluating] = useState(false);
  const [suggestionKey, setSuggestionKey] = useState(0);
  const itemsPerPage = 10;

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadCategories();
  }, [currentPage]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage - 1;

      const { count } = await supabase
        .from('expense_categories')
        .select('*', { count: 'exact', head: true });

      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('sort_order')
        .range(startIndex, endIndex);

      if (error) throw error;
      setCategories(data || []);
      setTotalCategories(count || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name.trim()) return;

    try {
      setSaving(true);
      setError(null);

      const trimmedName = newCategory.name.trim();

      const existingCategory = categories.find(
        c => c.name.toLowerCase() === trimmedName.toLowerCase()
      );

      if (existingCategory) {
        setError(`Category "${trimmedName}" already exists`);
        setSaving(false);
        return;
      }

      const maxOrder = Math.max(...categories.map(c => c.sort_order), 0);

      const { error: insertError } = await supabase
        .from('expense_categories')
        .insert({
          name: trimmedName,
          description: newCategory.description.trim() || null,
          sort_order: maxOrder + 1,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          setError(`Category "${trimmedName}" already exists`);
        } else {
          throw insertError;
        }
      } else {
        const addedName = trimmedName;
        const addedDesc = newCategory.description.trim();
        setNewCategory({ name: '', description: '' });
        setShowAddForm(false);
        await loadCategories();

        if (businessId) {
          await triggerCategoryReevaluation(addedName, addedDesc);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const triggerCategoryReevaluation = async (categoryName: string, categoryDescription: string) => {
    if (!businessId) return;

    try {
      setReevaluating(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reevaluate-categories`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            businessId,
            newCategoryName: categoryName,
            categoryDescription: categoryDescription || categoryName
          })
        }
      );

      const result = await response.json();

      if (result.success && result.suggestionsCount > 0) {
        setSuggestionKey(prev => prev + 1);
      }
    } catch (err) {
      logger.warn('Failed to trigger category re-evaluation', {
        categoryName,
        businessId,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setReevaluating(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    const confirmed = await showConfirm({
      variant: 'warning',
      title: 'Delete Category',
      message: `Are you sure you want to delete the category "${categoryName}"?`,
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    if (!confirmed) return;

    try {
      setSaving(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', categoryId);

      if (deleteError) throw deleteError;

      await loadCategories();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 size={24} className="animate-spin text-slate-600 dark:text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {businessId && (
        <CategorySuggestions
          key={suggestionKey}
          businessId={businessId}
          onSuggestionsChange={() => setSuggestionKey(prev => prev + 1)}
        />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Expense Categories</h3>
            <p className="text-sm text-slate-600 mt-1">
              Manage global expense categories for all receipts
            </p>
          </div>
          <div className="flex items-center gap-2">
            {reevaluating && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <RefreshCw size={14} className="animate-spin" />
                <span>Checking receipts...</span>
              </div>
            )}
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={16} />
              <span>Add Category</span>
            </button>
          </div>
        </div>

      {showAddForm && (
        <form onSubmit={handleAddCategory} className="mb-6 p-4 bg-slate-50 dark:bg-gray-800 rounded-lg border border-slate-200">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                required
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="e.g., Vehicle Expenses"
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                placeholder="Brief description of this category"
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !newCategory.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Category'
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewCategory({ name: '', description: '' });
                  setError(null);
                }}
                className="px-4 py-2 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-1">
        {categories.length === 0 ? (
          <p className="text-center text-slate-600 py-8">No categories found</p>
        ) : (
          categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center justify-between p-3 bg-white dark:bg-gray-700 rounded-lg border border-slate-200 hover:border-slate-300 dark:border-gray-600 dark:hover:border-gray-500 transition"
            >
              <div className="flex-1">
                <div className="font-medium text-slate-800 dark:text-white">{category.name}</div>
                {category.description && (
                  <div className="text-sm text-slate-600 dark:text-gray-400">{category.description}</div>
                )}
              </div>
              <button
                onClick={() => handleDeleteCategory(category.id, category.name)}
                disabled={saving}
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition disabled:opacity-50"
                title="Delete category"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {totalCategories > itemsPerPage && (
          <div className="flex flex-col items-center gap-3 mt-6 pt-6 border-t border-slate-200">
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCategories / itemsPerPage), p + 1))}
                disabled={currentPage >= Math.ceil(totalCategories / itemsPerPage)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
            <div className="text-sm text-slate-600 dark:text-gray-400">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCategories)} of {totalCategories} categories
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
