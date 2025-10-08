import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Category {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
}

export function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCategories, setTotalCategories] = useState(0);
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
        .order('display_order')
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

      const maxOrder = Math.max(...categories.map(c => c.display_order), 0);

      const { error: insertError } = await supabase
        .from('expense_categories')
        .insert({
          name: trimmedName,
          description: newCategory.description.trim() || null,
          display_order: maxOrder + 1,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          setError(`Category "${trimmedName}" already exists`);
        } else {
          throw insertError;
        }
      } else {
        setNewCategory({ name: '', description: '' });
        setShowAddForm(false);
        await loadCategories();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Are you sure you want to delete the category "${categoryName}"?`)) return;

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
        <Loader2 size={24} className="animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Expense Categories</h3>
          <p className="text-sm text-slate-600 mt-1">
            Manage global expense categories for all receipts
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          <span>Add Category</span>
        </button>
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
                className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 dark:border-gray-600 transition"
            >
              <div className="flex-1">
                <div className="font-medium text-slate-800">{category.name}</div>
                {category.description && (
                  <div className="text-sm text-slate-600">{category.description}</div>
                )}
              </div>
              <button
                onClick={() => handleDeleteCategory(category.id, category.name)}
                disabled={saving}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                title="Delete category"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {totalCategories > itemsPerPage && (
        <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200">
          <div className="text-sm text-slate-600">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCategories)} of {totalCategories} categories
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCategories / itemsPerPage), p + 1))}
              disabled={currentPage >= Math.ceil(totalCategories / itemsPerPage)}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
