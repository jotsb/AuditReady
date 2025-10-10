import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, Filter, Search, Download, AlertCircle, X } from 'lucide-react';
import { SplunkLogEntry } from '../shared/SplunkLogEntry';
import { logger } from '../../lib/logger';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: any;
  snapshot_before: any;
  snapshot_after: any;
  actor_role: string;
  ip_address: string;
  user_agent: string;
  status: 'success' | 'failure' | 'denied';
  error_message: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

interface AuditLogsViewProps {
  scope: 'system' | 'business';
  businessId?: string;
  showTitle?: boolean;
  showBorder?: boolean;
}

export function AuditLogsView({ scope, businessId, showTitle = true, showBorder = true }: AuditLogsViewProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
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
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;

  useEffect(() => {
    if (scope === 'system' || (scope === 'business' && businessId)) {
      setCurrentPage(1);
      loadAuditLogs();
    }
  }, [scope, businessId]);

  useEffect(() => {
    if (scope === 'system' || (scope === 'business' && businessId)) {
      loadAuditLogs();
    }
  }, [currentPage]);

  useEffect(() => {
    applyFilters();
  }, [logs, searchTerm, filterAction, filterResource, filterStatus, filterRole, startDate, endDate]);

  const loadAuditLogs = async () => {
    if (scope === 'business' && !businessId) return;

    const startTime = performance.now();
    try {
      setLoading(true);
      setError('');

      logger.info('Loading audit logs', {
        component: 'AuditLogsView',
        scope,
        businessId,
        currentPage
      }, 'DATABASE');

      const { data: allData, error: fetchError } = await supabase
        .from('audit_logs')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      let scopedLogs = allData || [];

      // Filter by business scope if needed
      if (scope === 'business' && businessId) {
        scopedLogs = allData?.filter(log => {
          if (log.resource_type === 'business') {
            return log.resource_id === businessId;
          }
          if (log.resource_type === 'collection') {
            return log.details?.business_id === businessId;
          }
          if (log.resource_type === 'receipt' && log.details?.collection_id) {
            return true;
          }
          if (log.resource_type === 'business_member') {
            return log.details?.business_id === businessId;
          }
          return false;
        }) || [];
      }

      setTotalCount(scopedLogs.length);
      setLogs(scopedLogs);

      const duration = performance.now() - startTime;
      logger.info('Audit logs loaded successfully', {
        component: 'AuditLogsView',
        scope,
        totalLogs: scopedLogs.length,
        duration: `${duration.toFixed(2)}ms`
      }, 'PERFORMANCE');

    } catch (err: any) {
      setError(err.message);
      logger.error('Failed to load audit logs', {
        component: 'AuditLogsView',
        scope,
        error: err.message
      }, 'DATABASE');
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
        log.ip_address?.toLowerCase().includes(term) ||
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
    const headers = ['Timestamp', 'User', 'Email', 'Role', 'Action', 'Resource Type', 'Status', 'IP Address', 'Details'];
    const rows = filteredLogs.map(log => [
      new Date(log.created_at).toLocaleString(),
      log.profiles?.full_name || 'Unknown',
      log.profiles?.email || 'N/A',
      log.actor_role || 'N/A',
      log.action,
      log.resource_type,
      log.status,
      log.ip_address || 'N/A',
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
    a.download = `audit-logs-${scope}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    logger.info('Exported audit logs to CSV', {
      component: 'AuditLogsView',
      scope,
      exportedCount: filteredLogs.length
    }, 'USER_ACTION');
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

  const actionTypes = ['all', ...new Set(logs.map(log => log.action))];
  const resourceTypes = ['all', ...new Set(logs.map(log => log.resource_type))];
  const statuses = ['all', 'success', 'failure', 'denied'];
  const roles = ['all', ...new Set(logs.map(log => log.actor_role).filter(Boolean))];

  // Paginate filtered logs
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className={`bg-white dark:bg-gray-800 ${showBorder ? 'rounded-lg shadow-md' : ''} p-6`}>
        <div className="text-center text-slate-600 dark:text-gray-400">Loading audit logs...</div>
      </div>
    );
  }

  if (scope === 'business' && !businessId) {
    return (
      <div className={`bg-white dark:bg-gray-800 ${showBorder ? 'rounded-lg shadow-md' : ''} p-6`}>
        <div className="text-center text-slate-600 dark:text-gray-400">Select a business to view audit logs</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showTitle && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              {scope === 'system' ? 'System Audit Logs' : 'Business Audit Logs'}
            </h2>
            <p className="text-slate-600 dark:text-gray-400 mt-1">
              {scope === 'system'
                ? 'Complete audit trail of all system activities'
                : 'Activity log for this business'}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle className="mr-2" size={20} />
          {error}
        </div>
      )}

      {/* Filters */}
      <div className={`bg-white dark:bg-gray-800 ${showBorder ? 'rounded-lg shadow-md' : ''} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-slate-600 dark:text-gray-400" />
            <h3 className="font-semibold text-slate-800 dark:text-white">Filters</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 text-sm text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition flex items-center gap-1"
            >
              <X size={16} />
              Clear
            </button>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search */}
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              <Search size={16} className="inline mr-1" />
              Search
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by user, action, resource, IP, or details..."
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Action</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {actionTypes.map(action => (
                <option key={action} value={action}>
                  {action === 'all' ? 'All Actions' : action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Resource Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Resource Type</label>
            <select
              value={filterResource}
              onChange={(e) => setFilterResource(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {resourceTypes.map(resource => (
                <option key={resource} value={resource}>
                  {resource === 'all' ? 'All Resources' : resource.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Role</label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              {roles.map(role => (
                <option key={role} value={role}>
                  {role === 'all' ? 'All Roles' : role}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Logs Display */}
      <div className={`bg-white dark:bg-gray-800 ${showBorder ? 'rounded-lg shadow-md' : ''} overflow-hidden`}>
        <div className="px-6 py-4 bg-slate-50 dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700">
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Showing {filteredLogs.length} of {totalCount} total logs
          </p>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Activity className="mx-auto mb-3 text-slate-300" size={48} />
              <p className="text-slate-500 dark:text-gray-400 font-medium">No audit logs found</p>
              <p className="text-slate-400 text-sm mt-1">
                Try adjusting your filters or search criteria
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800">
              {/* Header Row - Desktop Only */}
              <div className="hidden lg:grid lg:grid-cols-[auto_minmax(140px,1fr)_auto_minmax(120px,1fr)_minmax(100px,1fr)_minmax(120px,1.5fr)_auto] gap-2 px-4 py-2 bg-slate-100 dark:bg-gray-700 border-b border-slate-300 dark:border-gray-600 text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase sticky top-0 z-10">
                <div className="flex items-center justify-center w-6"></div>
                <div className="col-span-2">Time</div>
                <div className="">Status</div>
                <div className="">Action</div>
                <div className="">Resource</div>
                <div className="">User</div>
                <div className="">IP</div>
              </div>

              {/* Log Rows */}
              {paginatedLogs.map((log) => (
                <SplunkLogEntry key={log.id} log={{ ...log, type: 'audit' as const }} />
              ))}
            </div>
          )}
        </div>

        {filteredLogs.length > itemsPerPage && (
          <div className="flex flex-col items-center gap-3 px-6 py-4 border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 flex-shrink-0 pointer-events-auto">
            <div className="flex gap-2 pointer-events-auto">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.ceil(filteredLogs.length / itemsPerPage) }, (_, i) => i + 1)
                  .filter(page => {
                    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
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
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredLogs.length / itemsPerPage), p + 1))}
                disabled={currentPage >= Math.ceil(filteredLogs.length / itemsPerPage)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
            <div className="text-sm text-slate-600 dark:text-gray-400">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
