import { useEffect, useState } from 'react';
import { Building2, Users, Receipt, FolderOpen, Search, ChevronDown, ChevronRight, Calendar, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { BusinessAdminActions } from './BusinessAdminActions';

interface Business {
  id: string;
  name: string;
  created_at: string;
  owner_id: string;
  owner_email?: string;
  receipt_count: number;
  member_count: number;
  collection_count: number;
  suspended?: boolean;
  soft_deleted?: boolean;
}

interface Collection {
  id: string;
  name: string;
  year: number;
  business_id: string;
  business_name: string;
  business_owner: string;
  receipt_count: number;
  created_at: string;
}

export function AdminBusinessesTab() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBusinesses, setTotalBusinesses] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedBusinesses, setExpandedBusinesses] = useState<Set<string>>(new Set());
  const [businessCollections, setBusinessCollections] = useState<Record<string, Collection[]>>({});
  const [loadingCollections, setLoadingCollections] = useState<Set<string>>(new Set());
  const itemsPerPage = 20;

  useEffect(() => {
    loadBusinesses();
  }, [currentPage]);

  const loadBusinesses = async () => {
    try {
      setLoading(true);
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage - 1;

      const [countResult, businessesResult] = await Promise.all([
        supabase.from('businesses').select('*', { count: 'exact', head: true }),
        supabase
          .from('businesses')
          .select('id, name, created_at, owner_id, suspended, suspension_reason, soft_deleted, deletion_reason, storage_used_bytes, storage_limit_bytes')
          .order('created_at', { ascending: false })
          .range(startIndex, endIndex),
      ]);

      if (businessesResult.error) throw businessesResult.error;
      setTotalBusinesses(countResult.count || 0);

      const enriched = await Promise.all(
        (businessesResult.data || []).map(async (business) => {
          const [receiptCount, memberCount, collectionCount, ownerEmail] = await Promise.all([
            supabase
              .from('collections')
              .select('id')
              .eq('business_id', business.id)
              .then(async (res) => {
                if (!res.data || res.data.length === 0) return 0;
                const ids = res.data.map((c) => c.id);
                const r = await supabase.from('receipts').select('id', { count: 'exact', head: true }).is('parent_receipt_id', null).in('collection_id', ids);
                return r.count || 0;
              }),
            supabase.from('business_members').select('id', { count: 'exact', head: true }).eq('business_id', business.id).then((r) => r.count || 0),
            supabase.from('collections').select('id', { count: 'exact', head: true }).eq('business_id', business.id).then((r) => r.count || 0),
            supabase.from('profiles').select('email').eq('id', business.owner_id).maybeSingle().then((r) => r.data?.email || 'Unknown'),
          ]);
          return { ...business, owner_email: ownerEmail, receipt_count: receiptCount, member_count: memberCount, collection_count: collectionCount };
        })
      );

      setBusinesses(enriched);
    } catch (err: any) {
      logger.error('Error loading businesses', err as Error, { page: 'AdminBusinessesTab', operation: 'load' });
    } finally {
      setLoading(false);
    }
  };

  const filteredBusinesses = searchTerm
    ? businesses.filter((b) => b.name.toLowerCase().includes(searchTerm.toLowerCase()) || b.owner_email?.toLowerCase().includes(searchTerm.toLowerCase()))
    : businesses;

  const toggleBusiness = async (businessId: string) => {
    const newExpanded = new Set(expandedBusinesses);
    if (newExpanded.has(businessId)) {
      newExpanded.delete(businessId);
      setExpandedBusinesses(newExpanded);
      return;
    }

    newExpanded.add(businessId);
    setExpandedBusinesses(newExpanded);

    if (!businessCollections[businessId]) {
      setLoadingCollections(new Set([...loadingCollections, businessId]));
      try {
        const { data, error } = await supabase
          .from('collections')
          .select(`*, business:businesses(name, owner_id, owner:profiles!businesses_owner_id_fkey(email))`)
          .eq('business_id', businessId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const enriched = await Promise.all(
            data.map(async (collection: any) => {
              const { count } = await supabase.from('receipts').select('id', { count: 'exact', head: true }).is('parent_receipt_id', null).eq('collection_id', collection.id);
              return {
                id: collection.id,
                name: collection.name,
                year: collection.year,
                business_id: collection.business_id,
                business_name: collection.business?.name || 'Unknown',
                business_owner: collection.business?.owner?.email || 'Unknown',
                receipt_count: count || 0,
                created_at: collection.created_at,
              };
            })
          );
          setBusinessCollections((prev) => ({ ...prev, [businessId]: enriched }));
        }
      } catch (err) {
        logger.error('Error loading collections', err as Error, { businessId, page: 'AdminBusinessesTab' });
      } finally {
        setLoadingCollections((prev) => {
          const next = new Set(prev);
          next.delete(businessId);
          return next;
        });
      }
    }
  };

  if (loading && businesses.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-slate-600 dark:text-gray-400">Loading businesses...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search businesses by name or owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredBusinesses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-12 text-center">
            <Building2 className="mx-auto mb-4 text-slate-300 dark:text-gray-600" size={48} />
            <p className="text-slate-600 dark:text-gray-400 font-medium">No businesses found</p>
            <p className="text-slate-400 dark:text-gray-500 text-sm mt-1">Try adjusting your search</p>
          </div>
        ) : (
          filteredBusinesses.map((business) => {
            const isExpanded = expandedBusinesses.has(business.id);
            const collections = businessCollections[business.id] || [];
            const isLoadingCols = loadingCollections.has(business.id);

            return (
              <div key={business.id} className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden hover:shadow-md transition">
                <div className="p-6 cursor-pointer" onClick={() => toggleBusiness(business.id)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <Building2 className="text-blue-600 dark:text-blue-400" size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">{business.name}</h3>
                            {business.suspended && <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 text-xs font-semibold rounded-full">SUSPENDED</span>}
                            {business.soft_deleted && <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-semibold rounded-full">DELETED</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 dark:text-gray-400">
                            <Mail size={14} />
                            <span>{business.owner_email}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <MetricPill icon={<Users className="text-blue-600" size={16} />} bg="bg-blue-50 dark:bg-blue-900/20" label="Members" value={business.member_count} />
                        <MetricPill icon={<FolderOpen className="text-teal-600" size={16} />} bg="bg-teal-50 dark:bg-teal-900/20" label="Collections" value={business.collection_count} />
                        <MetricPill icon={<Receipt className="text-emerald-600" size={16} />} bg="bg-emerald-50 dark:bg-emerald-900/20" label="Receipts" value={business.receipt_count} />
                        <MetricPill icon={<Calendar className="text-slate-600 dark:text-gray-400" size={16} />} bg="bg-slate-50 dark:bg-gray-700" label="Created" value={new Date(business.created_at).toLocaleDateString()} />
                      </div>

                      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-gray-700">
                        <BusinessAdminActions business={business} onRefresh={loadBusinesses} />
                      </div>
                    </div>

                    <button className="ml-4 p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition flex-shrink-0">
                      {isExpanded ? <ChevronDown className="text-slate-600 dark:text-gray-400" size={24} /> : <ChevronRight className="text-slate-600 dark:text-gray-400" size={24} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900 p-6">
                    {isLoadingCols ? (
                      <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                        <p className="text-slate-600 dark:text-gray-400 mt-2">Loading collections...</p>
                      </div>
                    ) : collections.length === 0 ? (
                      <div className="text-center py-8">
                        <FolderOpen className="mx-auto mb-2 text-slate-300 dark:text-gray-600" size={32} />
                        <p className="text-slate-600 dark:text-gray-400">No collections yet</p>
                      </div>
                    ) : (
                      <div>
                        <h4 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                          <FolderOpen size={18} className="text-teal-600" />
                          Collections ({collections.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {collections.map((collection) => (
                            <div key={collection.id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-slate-200 dark:border-gray-700 hover:shadow-md transition">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <FolderOpen className="text-teal-600 flex-shrink-0" size={18} />
                                  <h5 className="font-semibold text-slate-800 dark:text-white">{collection.name}</h5>
                                </div>
                                <span className="px-2 py-1 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 text-xs font-medium rounded">{collection.year}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 dark:text-gray-400">{new Date(collection.created_at).toLocaleDateString()}</span>
                                <span className="inline-flex items-center px-2 py-1 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-full">
                                  <Receipt size={12} className="mr-1" />
                                  {collection.receipt_count}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {totalBusinesses > itemsPerPage && (
        <div className="flex flex-col items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm px-6 py-4">
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition">Previous</button>
            <button onClick={() => setCurrentPage(Math.min(Math.ceil(totalBusinesses / itemsPerPage), currentPage + 1))} disabled={currentPage >= Math.ceil(totalBusinesses / itemsPerPage)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition">Next</button>
          </div>
          <div className="text-sm text-slate-600 dark:text-gray-400">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalBusinesses)} of {totalBusinesses}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricPill({ icon, bg, label, value }: { icon: React.ReactNode; bg: string; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`p-2 ${bg} rounded`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-semibold text-slate-800 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
