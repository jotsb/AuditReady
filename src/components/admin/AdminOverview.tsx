import { useEffect, useState } from 'react';
import { Building2, Users, Receipt, TrendingUp, HardDrive, Database } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

interface AdminStats {
  totalUsers: number;
  totalBusinesses: number;
  totalReceipts: number;
  systemAdmins: number;
  totalStorageBytes: number;
  totalStorageGB: number;
}

interface Business {
  id: string;
  name: string;
  created_at: string;
  owner_id: string;
  owner_email?: string;
  receipt_count: number;
  member_count: number;
  collection_count: number;
  storage_used_bytes?: number;
}

export function AdminOverview() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalBusinesses: 0,
    totalReceipts: 0,
    systemAdmins: 0,
    totalStorageBytes: 0,
    totalStorageGB: 0,
  });
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBusinesses, setTotalBusinesses] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    loadData();
  }, [currentPage]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage - 1;

      const [businessesCountResult, businessesResult, receiptsResult, systemRolesResult, allBusinessesResult] = await Promise.all([
        supabase.from('businesses').select('*', { count: 'exact', head: true }),
        supabase
          .from('businesses')
          .select('id, name, created_at, owner_id, suspended, suspension_reason, soft_deleted, deletion_reason, storage_used_bytes, storage_limit_bytes')
          .order('created_at', { ascending: false })
          .range(startIndex, endIndex),
        supabase.from('receipts').select('id', { count: 'exact', head: true }).is('parent_receipt_id', null),
        supabase.from('system_roles').select('id', { count: 'exact', head: true }).eq('role', 'admin'),
        supabase.from('businesses').select('owner_id'),
      ]);

      if (businessesResult.error) throw businessesResult.error;
      if (receiptsResult.error) throw receiptsResult.error;
      if (systemRolesResult.error) throw systemRolesResult.error;

      const businessesData = businessesResult.data || [];
      const uniqueOwners = new Set(allBusinessesResult.data?.map((b) => b.owner_id) || []).size;
      setTotalBusinesses(businessesCountResult.count || 0);

      const enrichedBusinesses = await Promise.all(
        businessesData.map(async (business) => {
          const [receiptCount, memberCount, collectionCount, ownerEmail] = await Promise.all([
            supabase
              .from('collections')
              .select('id')
              .eq('business_id', business.id)
              .then(async (collectionsRes) => {
                if (!collectionsRes.data || collectionsRes.data.length === 0) return 0;
                const collectionIds = collectionsRes.data.map((c) => c.id);
                const receiptsRes = await supabase
                  .from('receipts')
                  .select('id', { count: 'exact', head: true })
                  .is('parent_receipt_id', null)
                  .in('collection_id', collectionIds);
                return receiptsRes.count || 0;
              }),
            supabase.from('business_members').select('id', { count: 'exact', head: true }).eq('business_id', business.id).then((res) => res.count || 0),
            supabase.from('collections').select('id', { count: 'exact', head: true }).eq('business_id', business.id).then((res) => res.count || 0),
            supabase.from('profiles').select('email').eq('id', business.owner_id).maybeSingle().then((res) => res.data?.email || 'Unknown'),
          ]);
          return { ...business, owner_email: ownerEmail, receipt_count: receiptCount, member_count: memberCount, collection_count: collectionCount };
        })
      );

      const totalStorageBytes = enrichedBusinesses.reduce((sum, b) => sum + (b.storage_used_bytes || 0), 0);

      setStats({
        totalUsers: uniqueOwners,
        totalBusinesses: businessesCountResult.count || 0,
        totalReceipts: receiptsResult.count || 0,
        systemAdmins: systemRolesResult.count || 0,
        totalStorageBytes,
        totalStorageGB: Math.round((totalStorageBytes / 1073741824) * 100) / 100,
      });
      setBusinesses(enrichedBusinesses);
    } catch (err: any) {
      logger.error('Error loading admin data', err as Error, { page: 'AdminOverview', operation: 'load_admin_data' });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard icon={<Building2 className="text-blue-600" size={22} />} bgColor="bg-blue-50 dark:bg-blue-900/30" label="Total Businesses" value={stats.totalBusinesses} loading={loading} />
        <StatCard icon={<Users className="text-emerald-600" size={22} />} bgColor="bg-emerald-50 dark:bg-emerald-900/30" label="Total Users" value={stats.totalUsers} loading={loading} />
        <StatCard icon={<Receipt className="text-cyan-600" size={22} />} bgColor="bg-cyan-50 dark:bg-cyan-900/30" label="Total Receipts" value={stats.totalReceipts} loading={loading} />
        <StatCard icon={<HardDrive className="text-amber-600" size={22} />} bgColor="bg-amber-50 dark:bg-amber-900/30" label="Total Storage" value={`${stats.totalStorageGB} GB`} loading={loading} />
        <StatCard icon={<Users className="text-rose-600" size={22} />} bgColor="bg-rose-50 dark:bg-rose-900/30" label="System Admins" value={stats.systemAdmins} loading={loading} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">All Businesses</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-gray-900/50 border-b border-slate-200 dark:border-gray-700">
              <tr>
                {['Business Name', 'Owner Email', 'Members', 'Collections', 'Receipts', 'Created At'].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
              {businesses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-gray-400">
                    {loading ? 'Loading...' : 'No businesses found'}
                  </td>
                </tr>
              ) : (
                businesses.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">{b.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400">{b.owner_email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400">{b.member_count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400">{b.collection_count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400">{b.receipt_count}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400">{new Date(b.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalBusinesses > itemsPerPage && (
          <div className="flex flex-col items-center gap-3 px-6 py-4 border-t border-slate-200 dark:border-gray-700">
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(totalBusinesses / itemsPerPage) }, (_, i) => i + 1)
                  .filter((page) => {
                    const totalPages = Math.ceil(totalBusinesses / itemsPerPage);
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    return page >= currentPage - 1 && page <= currentPage + 1;
                  })
                  .map((page, index, array) => {
                    const showEllipsis = index > 0 && page - array[index - 1] > 1;
                    return (
                      <div key={page} className="flex items-center gap-1">
                        {showEllipsis && <span className="px-2 text-slate-400 dark:text-gray-500">...</span>}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 hover:bg-slate-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalBusinesses / itemsPerPage), p + 1))}
                disabled={currentPage >= Math.ceil(totalBusinesses / itemsPerPage)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
            <div className="text-sm text-slate-600 dark:text-gray-400">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalBusinesses)} of {totalBusinesses} businesses
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, bgColor, label, value, loading }: { icon: React.ReactNode; bgColor: string; label: string; value: string | number; loading: boolean }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${bgColor} rounded-lg flex items-center justify-center`}>{icon}</div>
        <TrendingUp className="text-slate-300 dark:text-gray-600" size={16} />
      </div>
      <h3 className="text-slate-500 dark:text-gray-400 text-xs font-medium mb-1">{label}</h3>
      {loading ? (
        <div className="h-8 w-20 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
      ) : (
        <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
      )}
    </div>
  );
}
