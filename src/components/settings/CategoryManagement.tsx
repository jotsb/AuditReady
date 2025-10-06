import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Category {
  id: string;
  business_id: string | null;
  name: string;
  description: string | null;
  is_default: boolean;
  display_order: number;
}

interface Business {
  id: string;
  name: string;
}

export function CategoryManagement() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadBusinesses();
  }, []);

  useEffect(() => {
    if (selectedBusiness) {
      loadCategories();
    }
  }, [selectedBusiness]);

  const loadBusinesses = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name')
        .eq('owner_id', user?.id)
        .order('name');

      if (error) throw error;

      if (data && data.length > 0) {
        setBusinesses(data);
        setSelectedBusiness(data[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .or(`is_default.eq.true,business_id.eq.${selectedBusiness}`)
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name.trim() || !selectedBusiness) return;

    try {
      setSaving(true);
      setError(null);

      const maxOrder = Math.max(...categories.map(c => c.display_order), 0);

      const { error } = await supabase
        .from('expense_categories')
        .insert({
          business_id: selectedBusiness,
          name: newCategory.name.trim(),
          description: newCategory.description.trim() || null,
          is_default: false,
          display_order: maxOrder + 1,
        });

      if (error) throw error;

      setNewCategory({ name: '', description: '' });
      setShowAddForm(false);
      await loadCategories();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      setSaving(true);
      setError(null);

      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      await loadCategories();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading && businesses.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 size={24} className="animate-spin text-slate-600" />
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Expense Categories</h3>
        <p className="text-slate-600">No businesses found. Create a business first to manage categories.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800">Expense Categories</h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={16} />
          <span>Add Category</span>
        </button>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Business
        </label>
        <select
          value={selectedBusiness}
          onChange={(e) => setSelectedBusiness(e.target.value)}
          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddCategory} className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                required
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="e.g., Vehicle Expenses"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                placeholder="Brief description of this category"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
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

      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-slate-600" />
          </div>
        ) : categories.length === 0 ? (
          <p className="text-center text-slate-600 py-8">No categories found</p>
        ) : (
          <>
            <div className="mb-4">
              <h4 className="text-sm font-medium text-slate-700 mb-2">System Default Categories</h4>
              <div className="space-y-1">
                {categories.filter(c => c.is_default).map((category) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-slate-800">{category.name}</div>
                      {category.description && (
                        <div className="text-sm text-slate-600">{category.description}</div>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded">
                      Default
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {categories.filter(c => !c.is_default).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2">Custom Categories</h4>
                <div className="space-y-1">
                  {categories.filter(c => !c.is_default).map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-slate-800">{category.name}</div>
                        {category.description && (
                          <div className="text-sm text-slate-600">{category.description}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        disabled={saving}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                        title="Delete category"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
