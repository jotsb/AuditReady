import { useEffect, useState } from 'react';
import { Plus, FolderOpen, Users, Calendar, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Business {
  id: string;
  name: string;
}

interface Collection {
  id: string;
  name: string;
  description: string | null;
  year: number;
  business_id: string;
  created_at: string;
}

export function CollectionsPage() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<string>('');
  const [showNewBusinessForm, setShowNewBusinessForm] = useState(false);
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newBusinessName, setNewBusinessName] = useState('');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionYear, setNewCollectionYear] = useState(new Date().getFullYear());
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedBusiness) {
      loadCollections(selectedBusiness);
    }
  }, [selectedBusiness]);

  const loadData = async () => {
    try {
      const { data: businessData, error } = await supabase
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBusinesses(businessData || []);
      if (businessData && businessData.length > 0) {
        setSelectedBusiness(businessData[0].id);
      }
    } catch (error) {
      console.error('Error loading businesses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async (businessId: string) => {
    try {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('business_id', businessId)
        .order('year', { ascending: false });

      if (error) throw error;
      setCollections(data || []);
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  };

  const createBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('businesses')
        .insert({
          owner_id: user.id,
          name: newBusinessName,
        })
        .select()
        .single();

      if (error) throw error;

      setBusinesses([data, ...businesses]);
      setSelectedBusiness(data.id);
      setNewBusinessName('');
      setShowNewBusinessForm(false);
    } catch (error) {
      console.error('Error creating business:', error);
    }
  };

  const createCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedBusiness) return;

    try {
      const { data, error } = await supabase
        .from('collections')
        .insert({
          business_id: selectedBusiness,
          name: newCollectionName,
          description: newCollectionDesc || null,
          year: newCollectionYear,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setCollections([data, ...collections]);
      setNewCollectionName('');
      setNewCollectionDesc('');
      setNewCollectionYear(new Date().getFullYear());
      setShowNewCollectionForm(false);
    } catch (error) {
      console.error('Error creating collection:', error);
    }
  };

  const deleteBusiness = async (businessId: string) => {
    if (!confirm('Are you sure you want to delete this business? You must delete all collections first.')) {
      return;
    }

    try {
      setDeleteError(null);
      const { error } = await supabase
        .from('businesses')
        .delete()
        .eq('id', businessId);

      if (error) {
        if (error.code === '23503') {
          setDeleteError('Cannot delete business. Please delete all collections for this business first.');
        } else {
          throw error;
        }
        return;
      }

      const updatedBusinesses = businesses.filter(b => b.id !== businessId);
      setBusinesses(updatedBusinesses);
      if (selectedBusiness === businessId) {
        setSelectedBusiness(updatedBusinesses[0]?.id || '');
      }
    } catch (error) {
      console.error('Error deleting business:', error);
      setDeleteError('Failed to delete business. Please try again.');
    }
  };

  const deleteCollection = async (collectionId: string, collectionName: string) => {
    if (!confirm(`Are you sure you want to delete "${collectionName}"? This will permanently delete all receipts and files in this collection.`)) {
      return;
    }

    try {
      setDeleteError(null);

      // First, get all receipts in this collection
      const { data: receipts, error: fetchError } = await supabase
        .from('receipts')
        .select('file_path')
        .eq('collection_id', collectionId);

      if (fetchError) throw fetchError;

      // Delete all files from storage
      if (receipts && receipts.length > 0) {
        const filePaths = receipts
          .map(r => r.file_path)
          .filter((path): path is string => path !== null);

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('receipts')
            .remove(filePaths);

          if (storageError) {
            console.warn('Some files could not be deleted from storage:', storageError);
          }
        }
      }

      // Now delete the collection (which will cascade to delete receipts)
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionId);

      if (error) throw error;

      setCollections(collections.filter(c => c.id !== collectionId));
    } catch (error) {
      console.error('Error deleting collection:', error);
      setDeleteError('Failed to delete collection. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-600">Loading collections...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {deleteError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{deleteError}</span>
          <button
            onClick={() => setDeleteError(null)}
            className="text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-800">Businesses</h3>
          <button
            onClick={() => setShowNewBusinessForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            <span>New Business</span>
          </button>
        </div>

        {showNewBusinessForm && (
          <form onSubmit={createBusiness} className="mb-6 p-4 border border-slate-200 rounded-lg">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={newBusinessName}
                  onChange={(e) => setNewBusinessName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="My Business Inc."
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewBusinessForm(false)}
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="flex gap-2 flex-wrap">
          {businesses.map((business) => (
            <div key={business.id} className="flex items-center gap-1">
              <button
                onClick={() => setSelectedBusiness(business.id)}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedBusiness === business.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {business.name}
              </button>
              <button
                onClick={() => deleteBusiness(business.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                title="Delete business"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        {businesses.length === 0 && !showNewBusinessForm && (
          <div className="text-center py-8 text-slate-500">
            No businesses yet. Create your first business to get started!
          </div>
        )}
      </div>

      {selectedBusiness && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-800">Collections</h3>
            <button
              onClick={() => setShowNewCollectionForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={20} />
              <span>New Collection</span>
            </button>
          </div>

          {showNewCollectionForm && (
            <form onSubmit={createCollection} className="mb-6 p-4 border border-slate-200 rounded-lg">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Collection Name
                  </label>
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="2025 Tax Year"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Year
                  </label>
                  <input
                    type="number"
                    value={newCollectionYear}
                    onChange={(e) => setNewCollectionYear(parseInt(e.target.value))}
                    required
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description (Optional)
                  </label>
                  <textarea
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add notes about this collection..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCollectionForm(false)}
                    className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-2 md:px-0">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="p-6 border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-md transition relative group"
              >
                <button
                  onClick={() => deleteCollection(collection.id, collection.name)}
                  className="absolute top-4 right-4 p-2 text-red-600 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                  title="Delete collection"
                >
                  <Trash2 size={16} />
                </button>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <FolderOpen size={24} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-800 mb-1">{collection.name}</h4>
                    {collection.description && (
                      <p className="text-sm text-slate-600 mb-3">{collection.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>{collection.year}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users size={14} />
                        <span>1 member</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {collections.length === 0 && !showNewCollectionForm && (
            <div className="text-center py-8 text-slate-500">
              No collections yet. Create your first collection to organize receipts!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
