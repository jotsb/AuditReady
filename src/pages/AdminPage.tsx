import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Building2, Users, Receipt, TrendingUp, AlertCircle, Activity, Database, BarChart3, UserCog, Search, Filter as FilterIcon, Download } from 'lucide-react';
import { LogEntry } from '../components/shared/LogEntry';
import { usePageTracking } from '../hooks/usePageTracking';
import { UserManagement } from '../components/admin/UserManagement';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'logs' | 'analytics'>('overview');
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
          const [receiptCount, memberCount, ownerEmail] = await Promise.all([
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
          <p className="text-slate-600">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-800 flex items-center justify-center">
        <div className="text-slate-600">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">System Administration</h1>
          <p className="text-slate-600">Manage all businesses and users across the platform</p>
        </div>

        <div className="mb-6">
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
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition ${
                  activeTab === 'users'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:text-gray-300 hover:border-slate-300'
                }`}
              >
                <UserCog className="inline mr-2" size={18} />
                Users Management
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
            </nav>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

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
            <p className="text-3xl font-bold text-slate-800">{stats.totalBusinesses}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="text-green-600" size={24} />
              </div>
              <TrendingUp className="text-green-600" size={20} />
            </div>
            <h3 className="text-slate-600 dark:text-gray-400 text-sm font-medium mb-1">Total Users</h3>
            <p className="text-3xl font-bold text-slate-800">{stats.totalUsers}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Receipt className="text-purple-600" size={24} />
              </div>
              <TrendingUp className="text-purple-600" size={20} />
            </div>
            <h3 className="text-slate-600 dark:text-gray-400 text-sm font-medium mb-1">Total Receipts</h3>
            <p className="text-3xl font-bold text-slate-800">{stats.totalReceipts}</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <Users className="text-red-600" size={24} />
              </div>
            </div>
            <h3 className="text-slate-600 dark:text-gray-400 text-sm font-medium mb-1">System Admins</h3>
            <p className="text-3xl font-bold text-slate-800">{stats.systemAdmins}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-xl font-bold text-slate-800">All Businesses</h2>
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
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      No businesses found
                    </td>
                  </tr>
                ) : (
                  businesses.map((business) => (
                    <tr key={business.id} className="hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">{business.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">{business.owner_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">{business.member_count}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">{business.receipt_count}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">
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
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
              <div className="text-sm text-slate-600">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalBusinesses)} of {totalBusinesses} businesses
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
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
                          {showEllipsis && <span className="px-2 text-slate-400">...</span>}
                          <button
                            onClick={() => setCurrentPage(page)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                              currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-700 dark:text-gray-300 bg-white border border-slate-300 dark:border-gray-600 hover:bg-slate-50'
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
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 dark:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
          </>
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
      </div>
    </div>
  );
}

function AuditLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterResource, setFilterResource] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [logs, searchTerm, filterAction, filterResource, filterStatus, filterRole, startDate, endDate]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(term) ||
        log.resource_type.toLowerCase().includes(term) ||
        log.profiles?.full_name?.toLowerCase().includes(term) ||
        log.profiles?.email?.toLowerCase().includes(term) ||
        JSON.stringify(log.details).toLowerCase().includes(term)
      );
    }

    // Action filter
    if (filterAction !== 'all') {
      filtered = filtered.filter(log => log.action === filterAction);
    }

    // Resource filter
    if (filterResource !== 'all') {
      filtered = filtered.filter(log => log.resource_type === filterResource);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(log => log.status === filterStatus);
    }

    // Role filter
    if (filterRole !== 'all') {
      filtered = filtered.filter(log => log.actor_role === filterRole);
    }

    // Date range filter
    if (startDate) {
      filtered = filtered.filter(log => new Date(log.created_at) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter(log => new Date(log.created_at) <= new Date(endDate + 'T23:59:59'));
    }

    setFilteredLogs(filtered);
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'Email', 'Role', 'Action', 'Resource Type', 'Status', 'Details'];
    const rows = filteredLogs.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.profiles?.full_name || 'Unknown',
      log.profiles?.email || 'N/A',
      log.actor_role || 'N/A',
      log.action,
      log.resource_type,
      log.status,
      JSON.stringify(log.details)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterAction('all');
    setFilterResource('all');
    setFilterStatus('all');
    setFilterRole('all');
    setStartDate('');
    setEndDate('');
  };

  const formatActionName = (action: string) => {
    return action.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const actionTypes = ['all', ...new Set(logs.map(log => log.action))];
  const resourceTypes = ['all', ...new Set(logs.map(log => log.resource_type))];
  const statuses = ['all', 'success', 'failure', 'denied'];
  const roles = ['all', ...new Set(logs.map(log => log.actor_role).filter(Boolean))];

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="text-center text-slate-600">Loading audit logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle className="mr-2" size={20} />
          {error}
        </div>
      )}

      {/* Advanced Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <FilterIcon className="text-slate-500 dark:text-gray-400 mr-2" size={20} />
            <h3 className="font-semibold text-slate-800">Filters</h3>
          </div>
          <div className="flex gap-3">
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear All
            </button>
            <button
              onClick={exportToCSV}
              disabled={filteredLogs.length === 0}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Download size={16} className="mr-2" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Filter Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Action</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {actionTypes.map(action => (
                <option key={action} value={action}>
                  {action === 'all' ? 'All Actions' : formatActionName(action)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Resource Type</label>
            <select
              value={filterResource}
              onChange={(e) => setFilterResource(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {resourceTypes.map(resource => (
                <option key={resource} value={resource}>
                  {resource === 'all' ? 'All Resources' : resource}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Statuses' : status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {roles.map(role => (
                <option key={role} value={role}>
                  {role === 'all' ? 'All Roles' : role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Logs Display */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 dark:bg-gray-800 border-b border-slate-200">
          <p className="text-sm text-slate-600">
            Showing {filteredLogs.length} of {logs.length} total logs
          </p>
        </div>

        <div>
          {filteredLogs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Activity className="mx-auto mb-3 text-slate-300" size={48} />
              <p className="text-slate-500 dark:text-gray-400 font-medium">No audit logs found</p>
              <p className="text-slate-400 text-sm mt-1">
                Try adjusting your filters or search criteria
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <LogEntry key={log.id} log={{ ...log, type: 'audit' as const }} />
            ))
          )}
        </div>
      </div>
    </div>
  );
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
        <div className="text-center text-slate-600">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="text-center text-slate-600">No analytics data available</div>
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
                    <span className="text-sm font-medium text-slate-700">{category}</span>
                    <span className="text-sm text-slate-600">{count} receipts</span>
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
              <span className="text-slate-600">Avg Receipts per Business</span>
              <span className="font-bold text-slate-800">
                {(analytics.totalReceipts / analytics.totalBusinesses || 0).toFixed(1)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-800 rounded-lg">
              <span className="text-slate-600">Total Collections</span>
              <span className="font-bold text-slate-800">{analytics.totalCollections}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Activity Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-800 rounded-lg">
              <span className="text-slate-600">Businesses Created Today</span>
              <span className="font-bold text-slate-800">
                {analytics.recentBusinesses > 0 ? '🔥' : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-800 rounded-lg">
              <span className="text-slate-600">Platform Status</span>
              <span className="font-bold text-green-600">Operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
