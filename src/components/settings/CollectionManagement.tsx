import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Users, FolderOpen } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { Database } from '../../lib/database.types';

type Collection = Database['public']['Tables']['collections']['Row'];
type Business = Database['public']['Tables']['businesses']['Row'];

interface CollectionWithBusiness extends Collection {
  business?: Business;
}

export function CollectionManagement() {
  const { user, selectedBusiness } = useAuth();
  const { showConfirm } = useAlert();
  const [collections, setCollections] = useState<CollectionWithBusiness[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    year: new Date().getFullYear(),
    business_id: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const [ownedBusinessesRes, memberBusinessesRes] = await Promise.all([
        supabase
          .from('businesses')
          .select('*')
          .eq('owner_id', user.id)
          .order('name', { ascending: true }),
        supabase
          .from('business_members')
          .select('business_id, businesses(*)')
          .eq('user_id', user.id)
      ]);

      if (ownedBusinessesRes.error) throw ownedBusinessesRes.error;
      if (memberBusinessesRes.error) throw memberBusinessesRes.error;

      const ownedBusinesses = ownedBusinessesRes.data || [];
      const memberBusinesses = memberBusinessesRes.data?.map((m: any) => m.businesses).filter(Boolean) || [];
      const allBusinesses = [...ownedBusinesses, ...memberBusinesses];
      const uniqueBusinesses = Array.from(
        new Map(allBusinesses.map((b: any) => [b.id, b])).values()
      );

      setBusinesses(uniqueBusinesses);

      if (uniqueBusinesses.length > 0) {
        const businessIds = uniqueBusinesses.map((b: any) => b.id);
        const { data: collectionsData, error: collectionsError } = await supabase
          .from('collections')
          .select('*, business:businesses(*)')
          .in('business_id', businessIds)
          .order('created_at', { ascending: false });

        if (collectionsError) throw collectionsError;
        setCollections(collectionsData || []);
      } else {
        setCollections([]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setError(null);
      setSuccess(null);

      const { error: insertError } = await supabase.from('collections').insert({
        name: formData.name,
        description: formData.description || null,
        year: formData.year,
        business_id: formData.business_id,
        created_by: user.id,
      });

      if (insertError) throw insertError;

      setSuccess('Collection created successfully!');
      setShowCreateModal(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCollection) return;

    try {
      setError(null);
      setSuccess(null);

      const { error: updateError } = await supabase
        .from('collections')
        .update({
          name: formData.name,
          description: formData.description || null,
          year: formData.year,
          business_id: formData.business_id,
        })
        .eq('id', editingCollection.id);

      if (updateError) throw updateError;

      setSuccess('Collection updated successfully!');
      setEditingCollection(null);
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (collectionId: string) => {
    const confirmed = await showConfirm({
      variant: 'error',
      title: 'Delete Collection',
      message: 'Are you sure you want to delete this collection? All receipts in this collection will also be deleted.',
      confirmText: 'Delete Collection',
      cancelText: 'Cancel'
    });
    if (!confirmed) return;

    try {
      setError(null);
      setSuccess(null);

      const { error: deleteError } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionId);

      if (deleteError) throw deleteError;

      setSuccess('Collection deleted successfully!');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const startEdit = (collection: Collection) => {
    setEditingCollection(collection);
    setFormData({
      name: collection.name,
      description: collection.description || '',
      year: collection.year,
      business_id: collection.business_id,
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      year: new Date().getFullYear(),
      business_id: businesses[0]?.id || '',
    });
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingCollection(null);
    resetForm();
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
        <p className="text-amber-800">
          You need to create a business first before creating collections.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Collections</h3>
          <p className="text-sm text-slate-600 mt-1">
            Organize receipts by year, department, or project
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} />
          New Collection
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 text-sm">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ">
        {collections.map((collection) => (
          <div
            key={collection.id}
            className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FolderOpen size={20} className="text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-white">{collection.name}</h4>
                  <p className="text-sm text-slate-500 dark:text-gray-400">Year: {collection.year}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(collection)}
                  className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  title="Edit / Rename"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(collection.id)}
                  className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {collection.description && (
              <p className="text-sm text-slate-600 mb-3">{collection.description}</p>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-gray-400">
                <Users size={14} />
                <span>{collection.business?.name || 'Unknown Business'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {collections.length === 0 && (
        <div className="text-center py-12 bg-slate-50 dark:bg-gray-800 rounded-lg border border-slate-200">
          <FolderOpen size={48} className="mx-auto text-slate-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No collections yet</h3>
          <p className="text-slate-600 mb-4">Create your first collection to start organizing receipts</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            Create Collection
          </button>
        </div>
      )}

      {(showCreateModal || editingCollection) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-slate-800 mb-4">
              {editingCollection ? 'Edit Collection' : 'Create New Collection'}
            </h3>

            <form onSubmit={editingCollection ? handleUpdate : handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Collection Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="e.g., 2025 Expenses"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Year *
                </label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  required
                  min="2000"
                  max="2100"
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Business *
                </label>
                <select
                  value={formData.business_id}
                  onChange={(e) => setFormData({ ...formData, business_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-white border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a business</option>
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  {editingCollection ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
