import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, FolderOpen, ChevronDown, ChevronRight, Users, Receipt, Calendar, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Database } from '../../lib/database.types';
import { ExportJobsManager } from './ExportJobsManager';

type Business = Database['public']['Tables']['businesses']['Row'];
type Collection = Database['public']['Tables']['collections']['Row'];

interface BusinessWithDetails extends Business {
  member_count?: number;
  collection_count?: number;
  receipt_count?: number;
}

interface CollectionWithDetails extends Collection {
  receipt_count?: number;
}

const CURRENCIES = [
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
];

export function BusinessCollectionManagement() {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<BusinessWithDetails[]>([]);
  const [expandedBusinesses, setExpandedBusinesses] = useState<Set<string>>(new Set());
  const [businessCollections, setBusinessCollections] = useState<Record<string, CollectionWithDetails[]>>({});
  const [loadingCollections, setLoadingCollections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showCreateBusinessModal, setShowCreateBusinessModal] = useState(false);
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);
  const [selectedBusinessForCollection, setSelectedBusinessForCollection] = useState<string | null>(null);
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [businessFormData, setBusinessFormData] = useState({
    name: '',
    tax_id: '',
    currency: 'CAD',
  });
  const [collectionFormData, setCollectionFormData] = useState({
    name: '',
    description: '',
    year: new Date().getFullYear(),
    business_id: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadBusinesses();
    }
  }, [user]);

  const loadBusinesses = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const [ownedResult, memberResult] = await Promise.all([
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

      if (ownedResult.error) throw ownedResult.error;
      if (memberResult.error) throw memberResult.error;

      const ownedBusinesses = ownedResult.data || [];
      const memberBusinesses = memberResult.data?.map((m: any) => m.businesses).filter(Boolean) || [];

      const allBusinesses = [...ownedBusinesses, ...memberBusinesses];
      const uniqueBusinesses = Array.from(
        new Map(allBusinesses.map(b => [b.id, b])).values()
      );

      const enrichedBusinesses = await Promise.all(
        uniqueBusinesses.map(async (business: any) => {
          const [memberCount, collectionCount, receiptCount] = await Promise.all([
            supabase
              .from('business_members')
              .select('id', { count: 'exact', head: true })
              .eq('business_id', business.id)
              .then(res => res.count || 0),

            supabase
              .from('collections')
              .select('id', { count: 'exact', head: true })
              .eq('business_id', business.id)
              .then(res => res.count || 0),

            supabase
              .from('receipts')
              .select('id', { count: 'exact', head: true })
              .eq('business_id', business.id)
              .then(res => res.count || 0),
          ]);

          return {
            ...business,
            member_count: memberCount,
            collection_count: collectionCount,
            receipt_count: receiptCount,
          };
        })
      );

      setBusinesses(enrichedBusinesses);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleBusiness = async (businessId: string) => {
    const newExpanded = new Set(expandedBusinesses);
    if (newExpanded.has(businessId)) {
      newExpanded.delete(businessId);
      setExpandedBusinesses(newExpanded);
    } else {
      newExpanded.add(businessId);
      setExpandedBusinesses(newExpanded);
      
      if (!businessCollections[businessId]) {
        setLoadingCollections(new Set([...loadingCollections, businessId]));
        try {
          const { data, error: fetchError } = await supabase
            .from('collections')
            .select('*')
            .eq('business_id', businessId)
            .order('created_at', { ascending: false });

          if (!fetchError && data) {
            const enrichedCollections = await Promise.all(
              data.map(async (collection) => {
                const { count } = await supabase
                  .from('receipts')
                  .select('id', { count: 'exact', head: true })
                  .eq('collection_id', collection.id);

                return {
                  ...collection,
                  receipt_count: count || 0,
                };
              })
            );

            setBusinessCollections({
              ...businessCollections,
              [businessId]: enrichedCollections,
            });
          }
        } catch (err) {
          console.error('Error loading collections:', err);
        } finally {
          const newLoading = new Set(loadingCollections);
          newLoading.delete(businessId);
          setLoadingCollections(newLoading);
        }
      }
    }
  };

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setError(null);
      setSuccess(null);

      const { error: insertError } = await supabase.from('businesses').insert({
        name: businessFormData.name,
        tax_id: businessFormData.tax_id || null,
        currency: businessFormData.currency,
        owner_id: user.id,
      });

      if (insertError) throw insertError;

      setSuccess('Business created successfully!');
      setShowCreateBusinessModal(false);
      resetBusinessForm();
      await loadBusinesses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setError(null);
      setSuccess(null);

      const businessId = selectedBusinessForCollection || collectionFormData.business_id;
      if (!businessId) {
        setError('Please select a business');
        return;
      }

      const { error: insertError } = await supabase.from('collections').insert({
        name: collectionFormData.name,
        description: collectionFormData.description || null,
        year: collectionFormData.year,
        business_id: businessId,
        created_by: user.id,
      });

      if (insertError) throw insertError;

      setSuccess('Collection created successfully!');
      setShowCreateCollectionModal(false);
      setSelectedBusinessForCollection(null);
      resetCollectionForm();
      
      delete businessCollections[businessId];
      await loadBusinesses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteBusiness = async (businessId: string) => {
    if (!confirm('Are you sure? This will delete all collections and receipts in this business.')) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from('businesses')
        .delete()
        .eq('id', businessId);

      if (deleteError) throw deleteError;

      setSuccess('Business deleted successfully!');
      await loadBusinesses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteCollection = async (collectionId: string, businessId: string) => {
    if (!confirm('Are you sure? This will delete all receipts in this collection.')) return;

    try {
      setError(null);
      const { error: deleteError } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionId);

      if (deleteError) throw deleteError;

      setSuccess('Collection deleted successfully!');
      
      delete businessCollections[businessId];
      await loadBusinesses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetBusinessForm = () => {
    setBusinessFormData({ name: '', tax_id: '', currency: 'CAD' });
    setEditingBusiness(null);
  };

  const resetCollectionForm = () => {
    setCollectionFormData({ name: '', description: '', year: new Date().getFullYear(), business_id: '' });
    setEditingCollection(null);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-slate-600 dark:text-gray-400 mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">My Businesses & Collections</h2>
          <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
            Manage your businesses and their collections
          </p>
        </div>
        <button
          onClick={() => setShowCreateBusinessModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={18} />
          New Business
        </button>
      </div>

      {businesses.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center border border-slate-200 dark:border-gray-700">
          <Building2 className="mx-auto mb-4 text-slate-300 dark:text-gray-600" size={48} />
          <p className="text-slate-600 dark:text-gray-400 font-medium mb-2">No businesses yet</p>
          <p className="text-slate-500 dark:text-gray-500 text-sm mb-4">Create your first business to get started</p>
          <button
            onClick={() => setShowCreateBusinessModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={18} />
            Create Business
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {businesses.map((business) => {
            const isExpanded = expandedBusinesses.has(business.id);
            const collections = businessCollections[business.id] || [];
            const isLoading = loadingCollections.has(business.id);
            const isOwner = business.owner_id === user?.id;

            return (
              <div
                key={business.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-slate-200 dark:border-gray-700"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => toggleBusiness(business.id)}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <Building2 className="text-blue-600 dark:text-blue-400" size={20} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{business.name}</h3>
                          {business.tax_id && (
                            <p className="text-xs text-slate-500 dark:text-gray-400">Tax ID: {business.tax_id}</p>
                          )}
                        </div>
                        {isOwner && (
                          <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                            Owner
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded">
                            <Users className="text-blue-600" size={14} />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-gray-400">Members</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">{business.member_count || 0}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-purple-50 dark:bg-purple-900/20 rounded">
                            <FolderOpen className="text-purple-600" size={14} />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-gray-400">Collections</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">{business.collection_count || 0}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-green-50 dark:bg-green-900/20 rounded">
                            <Receipt className="text-green-600" size={14} />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-gray-400">Receipts</p>
                            <p className="text-sm font-semibold text-slate-800 dark:text-white">{business.receipt_count || 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {isOwner && (
                        <>
                          <button
                            onClick={() => handleDeleteBusiness(business.id)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                            title="Delete Business"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => toggleBusiness(business.id)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition"
                      >
                        {isExpanded ? (
                          <ChevronDown className="text-slate-600 dark:text-gray-400" size={20} />
                        ) : (
                          <ChevronRight className="text-slate-600 dark:text-gray-400" size={20} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Export/Download Section */}
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-gray-700">
                    <ExportJobsManager businessId={business.id} businessName={business.name} />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                        <FolderOpen size={18} className="text-purple-600" />
                        Collections ({collections.length})
                      </h4>
                      <button
                        onClick={() => {
                          setSelectedBusinessForCollection(business.id);
                          setShowCreateCollectionModal(true);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition"
                      >
                        <Plus size={16} />
                        New Collection
                      </button>
                    </div>

                    {isLoading ? (
                      <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                        <p className="text-slate-600 dark:text-gray-400 text-sm mt-2">Loading collections...</p>
                      </div>
                    ) : collections.length === 0 ? (
                      <div className="text-center py-8">
                        <FolderOpen className="mx-auto mb-2 text-slate-300 dark:text-gray-600" size={32} />
                        <p className="text-slate-600 dark:text-gray-400 text-sm">No collections yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {collections.map((collection) => (
                          <div
                            key={collection.id}
                            className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-slate-200 dark:border-gray-700 hover:shadow-md transition group"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2 flex-1">
                                <FolderOpen className="text-purple-600 flex-shrink-0" size={16} />
                                <h5 className="font-semibold text-slate-800 dark:text-white text-sm">{collection.name}</h5>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                <button
                                  onClick={() => handleDeleteCollection(collection.id, business.id)}
                                  className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {collection.description && (
                              <p className="text-xs text-slate-600 dark:text-gray-400 mb-3">{collection.description}</p>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-500 dark:text-gray-400 flex items-center gap-1">
                                <Calendar size={12} />
                                {collection.year}
                              </span>
                              <span className="inline-flex items-center px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
                                <Receipt size={10} className="mr-1" />
                                {collection.receipt_count}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showCreateBusinessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Create New Business</h3>
            <form onSubmit={handleCreateBusiness} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  value={businessFormData.name}
                  onChange={(e) => setBusinessFormData({ ...businessFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Tax ID (Optional)
                </label>
                <input
                  type="text"
                  value={businessFormData.tax_id}
                  onChange={(e) => setBusinessFormData({ ...businessFormData, tax_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Currency *
                </label>
                <select
                  value={businessFormData.currency}
                  onChange={(e) => setBusinessFormData({ ...businessFormData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateBusinessModal(false);
                    resetBusinessForm();
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateCollectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Create New Collection</h3>
            <form onSubmit={handleCreateCollection} className="space-y-4">
              {!selectedBusinessForCollection && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                    Business *
                  </label>
                  <select
                    required
                    value={collectionFormData.business_id}
                    onChange={(e) => setCollectionFormData({ ...collectionFormData, business_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="">Select a business</option>
                    {businesses.map((business) => (
                      <option key={business.id} value={business.id}>
                        {business.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Collection Name *
                </label>
                <input
                  type="text"
                  required
                  value={collectionFormData.name}
                  onChange={(e) => setCollectionFormData({ ...collectionFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={collectionFormData.description}
                  onChange={(e) => setCollectionFormData({ ...collectionFormData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Year *
                </label>
                <input
                  type="number"
                  required
                  min="2000"
                  max="2100"
                  value={collectionFormData.year}
                  onChange={(e) => setCollectionFormData({ ...collectionFormData, year: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateCollectionModal(false);
                    setSelectedBusinessForCollection(null);
                    resetCollectionForm();
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
