import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Building2, Users, Receipt, TrendingUp, AlertCircle, Activity, Database, BarChart3, UserCog, Search, Filter as FilterIcon, Download, FolderOpen, ChevronDown, ChevronRight, Calendar, Mail } from 'lucide-react';
import { LogEntry } from '../components/shared/LogEntry';
import { usePageTracking } from '../hooks/usePageTracking';
import { UserManagement } from '../components/admin/UserManagement';
import { AuditLogsView } from '../components/audit/AuditLogsView';

interface AdminStats {
  totalUsers: number;
  totalBusinesses: number;
  totalReceipts: number;
  systemAdmins: number;
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

export function AdminPage() {
  const { isSystemAdmin, user } = useAuth();

  usePageTracking('Admin', { section: 'admin' });

  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalBusinesses: 0,
    totalReceipts: 0,
    systemAdmins: 0,
  });
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'businesses' | 'logs' | 'analytics' | 'bulk-ops'>('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBusinesses, setTotalBusinesses] = useState(0);
  const itemsPerPage = 20;

  useEffect(() => {
    if (isSystemAdmin) {
      loadAdminData();
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    if (isSystemAdmin) {
      loadAdminData();
    }
  }, [currentPage]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      setError('');

      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage - 1;

      const [businessesCountResult, businessesResult, receiptsResult, systemRolesResult, allBusinessesResult] = await Promise.all([
        supabase
          .from('businesses')
          .select('*', { count: 'exact', head: true }),

        supabase
          .from('businesses')
          .select('id, name, created_at, owner_id')
          .order('created_at', { ascending: false })
          .range(startIndex, endIndex),

        supabase
          .from('receipts')
          .select('id', { count: 'exact', head: true }),

        supabase
          .from('system_roles')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin'),

        supabase
          .from('businesses')
          .select('owner_id')
      ]);

      if (businessesResult.error) throw businessesResult.error;
      if (receiptsResult.error) throw receiptsResult.error;
      if (systemRolesResult.error) throw systemRolesResult.error;

      const businessesData = businessesResult.data || [];
      const uniqueOwners = new Set(allBusinessesResult.data?.map(b => b.owner_id) || []).size;
      setTotalBusinesses(businessesCountResult.count || 0);

      const enrichedBusinesses = await Promise.all(
        businessesData.map(async (business) => {
          const [receiptCount, memberCount, collectionCount, ownerEmail] = await Promise.all([
            supabase
              .from('receipts')
              .select('id', { count: 'exact', head: true })
              .eq('business_id', business.id)
              .then(res => res.count || 0),

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
              .from('profiles')
              .select('email')
              .eq('id', business.owner_id)
              .maybeSingle()
              .then(res => res.data?.email || 'Unknown')
          ]);

          return {
            ...business,
            owner_email: ownerEmail,
            receipt_count: receiptCount,
            member_count: memberCount,
            collection_count: collectionCount,
          };
        })
      );

      setStats({
        totalUsers: uniqueOwners,
        totalBusinesses: businessesCountResult.count || 0,
        totalReceipts: receiptsResult.count || 0,
        systemAdmins: systemRolesResult.count || 0,
      });

      setBusinesses(enrichedBusinesses);
    } catch (err: any) {
      console.error('Error loading admin data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isSystemAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto mb-4 text-red-600" size={48} />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Access Denied</h2>
          <p className="text-slate-600 dark:text-gray-400">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-800 flex items-center justify-center">
        <div className="text-slate-600 dark:text-gray-400">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto py-8">
        <div className="mb-8 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">System Administration</h1>
          <p className="text-slate-600 dark:text-gray-400">Manage all businesses and users across the platform</p>
        </div>

        <div className="mb-6 px-4 sm:px-6 lg:px-8">
          <div className="border-b border-slate-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:text-gray-300 hover:border-slate-300'
                }`}
              >
                <Building2 className="inline mr-2" size={18} />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('businesses')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === 'businesses'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:text-gray-300 hover:border-slate-300'
                }`}
              >
                <Building2 className="inline mr-2" size={18} />
                Businesses & Collections
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:text-gray-300 hover:border-slate-300'
                }`}
              >
                <UserCog className="inline mr-2" size={18} />
                Users
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === 'logs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:text-gray-300 hover:border-slate-300'
                }`}
              >
                <Activity className="inline mr-2" size={18} />
                Audit Logs
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === 'analytics'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:text-gray-300 hover:border-slate-300'
                }`}
              >
                <BarChart3 className="inline mr-2" size={18} />
                Analytics
              </button>
              <button
                onClick={() => setActiveTab('bulk-ops')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === 'bulk-ops'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:text-gray-300 hover:border-slate-300'
                }`}
              >
                <Activity className="inline mr-2" size={18} />
                Bulk Operations
              </button>
            </nav>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mx-4 sm:mx-6 lg:mx-8">
            {error}
          </div>
        )}

        <div className="px-4 sm:px-6 lg:px-8">
        {activeTab === 'overview' && (
          <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="text-blue-600" size={24} />
              </div>
              <TrendingUp className="text-blue-600" size={20} />
            </div>
            <h3 className="text-slate-600 dark:text-gray-400 text-sm font-medium mb-1">Total Businesses</h3>
            <p className="text-3xl font-bold text-slate-800 dark:text-white">{stats.totalBusinesses}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="text-green-600" size={24} />
              </div>
              <TrendingUp className="text-green-600" size={20} />
            </div>
            <h3 className="text-slate-600 dark:text-gray-400 text-sm font-medium mb-1">Total Users</h3>
            <p className="text-3xl font-bold text-slate-800 dark:text-white">{stats.totalUsers}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Receipt className="text-purple-600" size={24} />
              </div>
              <TrendingUp className="text-purple-600" size={20} />
            </div>
            <h3 className="text-slate-600 dark:text-gray-400 text-sm font-medium mb-1">Total Receipts</h3>
            <p className="text-3xl font-bold text-slate-800 dark:text-white">{stats.totalReceipts}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Users className="text-red-600" size={24} />
              </div>
            </div>
            <h3 className="text-slate-600 dark:text-gray-400 text-sm font-medium mb-1">System Admins</h3>
            <p className="text-3xl font-bold text-slate-800 dark:text-white">{stats.systemAdmins}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">All Businesses</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-800 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    Business Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    Owner Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    Members
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    Collections
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    Receipts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {businesses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-gray-400">
                      No businesses found
                    </td>
                  </tr>
                ) : (
                  businesses.map((business) => (
                    <tr key={business.id} className="hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900 dark:text-white">{business.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600 dark:text-gray-400">{business.owner_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600 dark:text-gray-400">{business.member_count}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600 dark:text-gray-400">{business.collection_count}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600 dark:text-gray-400">{business.receipt_count}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600 dark:text-gray-400">
                          {new Date(business.created_at).toLocaleDateString()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalBusinesses > itemsPerPage && (
            <div className="flex flex-col items-center gap-3 px-6 py-4 border-t border-slate-200">
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(totalBusinesses / itemsPerPage) }, (_, i) => i + 1)
                    .filter(page => {
                      const totalPages = Math.ceil(totalBusinesses / itemsPerPage);
                      if (totalPages <= 7) return true;
                      if (page === 1 || page === totalPages) return true;
                      if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                      return false;
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
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalBusinesses / itemsPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(totalBusinesses / itemsPerPage)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
              <div className="text-sm text-slate-600 dark:text-gray-400">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalBusinesses)} of {totalBusinesses} businesses
              </div>
            </div>
          )}
        </div>
          </>
        )}

        {activeTab === 'businesses' && (
          <BusinessesTab businesses={businesses} totalBusinesses={totalBusinesses} currentPage={currentPage} setCurrentPage={setCurrentPage} itemsPerPage={itemsPerPage} />
        )}

        {activeTab === 'users' && (
          <UserManagement />
        )}

        {activeTab === 'logs' && (
          <AuditLogsTab />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab />
        )}

        {activeTab === 'bulk-ops' && (
          <BulkOperationsTab />
        )}
        </div>
      </div>
    </div>
  );
}

function BulkOperationsTab() {
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBulkOperations();
  }, []);

  const loadBulkOperations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .in('category', ['USER_ACTION'])
        .ilike('message', '%bulk%')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setOperations(data || []);
    } catch (error) {
      console.error('Error loading bulk operations:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('delete')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    if (action.includes('categorize')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    if (action.includes('move')) return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    if (action.includes('export')) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    return 'bg-slate-100 text-slate-800 dark:bg-gray-700 dark:text-gray-300';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-slate-600 dark:text-gray-400">Loading bulk operations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Bulk Operations Monitor</h2>
          <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
            Track bulk actions performed by users ({operations.length} operations)
          </p>
        </div>
        <button
          onClick={loadBulkOperations}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Refresh
        </button>
      </div>

      {operations.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700">
          <Activity size={48} className="mx-auto text-slate-400 dark:text-gray-500 mb-4" />
          <p className="text-slate-600 dark:text-gray-400">No bulk operations recorded yet</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-900 border-b border-slate-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-gray-300 uppercase">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-gray-300 uppercase">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-gray-300 uppercase">
                    Message
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-gray-300 uppercase">
                    Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-gray-300 uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                {operations.map((op) => {
                  const action = op.metadata?.action || 'unknown';
                  const isError = op.level === 'ERROR';
                  return (
                    <tr key={op.id} className="hover:bg-slate-50 dark:hover:bg-gray-700 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400">
                        {formatDate(op.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getActionBadgeColor(action)}`}>
                          {action}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-800 dark:text-white">
                        {op.message}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-gray-400">
                        {op.metadata?.receipt_count && (
                          <div>Receipts: {op.metadata.receipt_count}</div>
                        )}
                        {op.metadata?.execution_time_ms && (
                          <div>Time: {op.metadata.execution_time_ms}ms</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          isError
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        }`}>
                          {isError ? 'Failed' : 'Success'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditLogsTab() {
  return <AuditLogsView scope="system" showTitle={false} showBorder={false} />;
}

function AnalyticsTab() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      const [
        businessesResult,
        receiptsResult,
        usersResult,
        categoriesResult,
        collectionsResult
      ] = await Promise.all([
        supabase.from('businesses').select('created_at'),
        supabase.from('receipts').select('created_at, amount'),
        supabase.from('profiles').select('created_at'),
        supabase.from('receipts').select('category'),
        supabase.from('collections').select('id')
      ]);

      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recentBusinesses = businessesResult.data?.filter(
        b => new Date(b.created_at) > last30Days
      ).length || 0;

      const recentUsers = usersResult.data?.filter(
        u => new Date(u.created_at) > last30Days
      ).length || 0;

      const recentReceipts = receiptsResult.data?.filter(
        r => new Date(r.created_at) > last7Days
      ).length || 0;

      const totalReceiptAmount = receiptsResult.data?.reduce(
        (sum, r) => sum + (r.amount || 0), 0
      ) || 0;

      const categoryCounts = categoriesResult.data?.reduce((acc, r) => {
        const cat = r.category || 'Uncategorized';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const topCategories = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      setAnalytics({
        recentBusinesses,
        recentUsers,
        recentReceipts,
        totalReceiptAmount,
        topCategories,
        totalBusinesses: businessesResult.data?.length || 0,
        totalReceipts: receiptsResult.data?.length || 0,
        totalUsers: usersResult.data?.length || 0,
        totalCollections: collectionsResult.data?.length || 0
      });
    } catch (err: any) {
      console.error('Error loading analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="text-center text-slate-600 dark:text-gray-400">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="text-center text-slate-600 dark:text-gray-400">No analytics data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Platform Analytics</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="text-sm text-blue-600 font-medium mb-1">New Businesses (30d)</div>
            <div className="text-3xl font-bold text-blue-700">{analytics.recentBusinesses}</div>
            <div className="text-xs text-blue-500 mt-1">of {analytics.totalBusinesses} total</div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="text-sm text-green-600 font-medium mb-1">New Users (30d)</div>
            <div className="text-3xl font-bold text-green-700">{analytics.recentUsers}</div>
            <div className="text-xs text-green-500 mt-1">of {analytics.totalUsers} total</div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="text-sm text-purple-600 font-medium mb-1">New Receipts (7d)</div>
            <div className="text-3xl font-bold text-purple-700">{analytics.recentReceipts}</div>
            <div className="text-xs text-purple-500 mt-1">of {analytics.totalReceipts} total</div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg p-4 border border-amber-200">
            <div className="text-sm text-amber-600 font-medium mb-1">Total Receipt Value</div>
            <div className="text-3xl font-bold text-amber-700">
              ${analytics.totalReceiptAmount.toLocaleString()}
            </div>
            <div className="text-xs text-amber-500 mt-1">across all businesses</div>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Top Categories</h3>
          <div className="space-y-3">
            {analytics.topCategories.map(([category, count]: [string, number], index: number) => {
              const maxCount = analytics.topCategories[0][1];
              const percentage = (count / maxCount) * 100;
              const colors = [
                'bg-blue-500',
                'bg-green-500',
                'bg-purple-500',
                'bg-amber-500',
                'bg-pink-500'
              ];

              return (
                <div key={category}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{category}</span>
                    <span className="text-sm text-slate-600 dark:text-gray-400">{count} receipts</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className={`${colors[index]} h-2.5 rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Growth Metrics</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-800 rounded-lg">
              <span className="text-slate-600 dark:text-gray-400">Avg Receipts per Business</span>
              <span className="font-bold text-slate-800 dark:text-white">
                {(analytics.totalReceipts / analytics.totalBusinesses || 0).toFixed(1)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-800 rounded-lg">
              <span className="text-slate-600 dark:text-gray-400">Total Collections</span>
              <span className="font-bold text-slate-800 dark:text-white">{analytics.totalCollections}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Activity Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-800 rounded-lg">
              <span className="text-slate-600 dark:text-gray-400">Businesses Created Today</span>
              <span className="font-bold text-slate-800 dark:text-white">
                {analytics.recentBusinesses > 0 ? '🔥' : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-800 rounded-lg">
              <span className="text-slate-600 dark:text-gray-400">Platform Status</span>
              <span className="font-bold text-green-600">Operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BusinessesTab({ businesses, totalBusinesses, currentPage, setCurrentPage, itemsPerPage }: {
  businesses: Business[];
  totalBusinesses: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredBusinesses, setFilteredBusinesses] = useState(businesses);
  const [expandedBusinesses, setExpandedBusinesses] = useState<Set<string>>(new Set());
  const [businessCollections, setBusinessCollections] = useState<Record<string, Collection[]>>({});
  const [loadingCollections, setLoadingCollections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (searchTerm) {
      const filtered = businesses.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.owner_email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredBusinesses(filtered);
    } else {
      setFilteredBusinesses(businesses);
    }
  }, [searchTerm, businesses]);

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
          const { data, error } = await supabase
            .from('collections')
            .select(`
              *,
              business:businesses(name, owner_id, owner:profiles!businesses_owner_id_fkey(email))
            `)
            .eq('business_id', businessId)
            .order('created_at', { ascending: false });

          if (!error && data) {
            const enrichedCollections = await Promise.all(
              data.map(async (collection: any) => {
                const { count } = await supabase
                  .from('receipts')
                  .select('id', { count: 'exact', head: true })
                  .eq('collection_id', collection.id);

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

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-gray-500" size={20} />
          <input
            type="text"
            placeholder="Search businesses by name or owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredBusinesses.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-12 text-center">
            <Building2 className="mx-auto mb-4 text-slate-300 dark:text-gray-600" size={48} />
            <p className="text-slate-600 dark:text-gray-400 font-medium">No businesses found</p>
            <p className="text-slate-400 dark:text-gray-500 text-sm mt-1">Try adjusting your search</p>
          </div>
        ) : (
          filteredBusinesses.map((business) => {
            const isExpanded = expandedBusinesses.has(business.id);
            const collections = businessCollections[business.id] || [];
            const isLoading = loadingCollections.has(business.id);

            return (
              <div
                key={business.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-slate-200 dark:border-gray-700 hover:shadow-lg transition"
              >
                <div
                  className="p-6 cursor-pointer"
                  onClick={() => toggleBusiness(business.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <Building2 className="text-blue-600 dark:text-blue-400" size={24} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-800 dark:text-white">{business.name}</h3>
                          <div className="flex items-center gap-2 mt-1 text-sm text-slate-600 dark:text-gray-400">
                            <Mail size={14} />
                            <span>{business.owner_email}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                            <Users className="text-blue-600" size={16} />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-gray-400">Members</p>
                            <p className="text-lg font-semibold text-slate-800 dark:text-white">{business.member_count}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                            <FolderOpen className="text-purple-600" size={16} />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-gray-400">Collections</p>
                            <p className="text-lg font-semibold text-slate-800 dark:text-white">{business.collection_count}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
                            <Receipt className="text-green-600" size={16} />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-gray-400">Receipts</p>
                            <p className="text-lg font-semibold text-slate-800 dark:text-white">{business.receipt_count}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-slate-50 dark:bg-gray-700 rounded">
                            <Calendar className="text-slate-600 dark:text-gray-400" size={16} />
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 dark:text-gray-400">Created</p>
                            <p className="text-sm font-medium text-slate-800 dark:text-white">
                              {new Date(business.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button className="ml-4 p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition">
                      {isExpanded ? (
                        <ChevronDown className="text-slate-600 dark:text-gray-400" size={24} />
                      ) : (
                        <ChevronRight className="text-slate-600 dark:text-gray-400" size={24} />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-900 p-6">
                    {isLoading ? (
                      <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
                          <FolderOpen size={18} className="text-purple-600" />
                          Collections ({collections.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {collections.map((collection) => (
                            <div
                              key={collection.id}
                              className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-slate-200 dark:border-gray-700 hover:shadow-md transition"
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <FolderOpen className="text-purple-600 flex-shrink-0" size={18} />
                                  <h5 className="font-semibold text-slate-800 dark:text-white">{collection.name}</h5>
                                </div>
                                <span className="px-2 py-1 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 text-xs font-medium rounded">
                                  {collection.year}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-500 dark:text-gray-400">
                                  {new Date(collection.created_at).toLocaleDateString()}
                                </span>
                                <span className="inline-flex items-center px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-medium rounded-full">
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
        <div className="flex flex-col items-center gap-3 bg-white dark:bg-gray-800 rounded-lg shadow-md px-6 py-4">
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(Math.ceil(totalBusinesses / itemsPerPage), currentPage + 1))}
              disabled={currentPage >= Math.ceil(totalBusinesses / itemsPerPage)}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
          <div className="text-sm text-slate-600 dark:text-gray-400">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalBusinesses)} of {totalBusinesses}
          </div>
        </div>
      )}
    </div>
  );
}
