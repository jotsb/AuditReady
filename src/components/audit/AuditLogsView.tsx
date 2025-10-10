import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, Filter, Download, AlertCircle, Sliders, Zap } from 'lucide-react';
import { SplunkLogEntry } from '../shared/SplunkLogEntry';
import { logger } from '../../lib/logger';
import { AdvancedLogFilterPanel, LogFilters } from './AdvancedLogFilterPanel';

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

const AUDIT_PRESETS = [
  {
    name: 'Failed Actions',
    icon: '⚠️',
    description: 'All failed operations',
    filters: { statuses: ['failure'], actions: [], resources: [], roles: [], searchTerm: '', startDate: '', endDate: '', ipAddress: '', userEmail: '' }
  },
  {
    name: 'Security Events',
    icon: '🔒',
    description: 'Access denied and authentication failures',
    filters: { statuses: ['denied', 'failure'], actions: [], resources: [], roles: [], searchTerm: 'auth', startDate: '', endDate: '', ipAddress: '', userEmail: '' }
  },
  {
    name: 'Admin Activity',
    icon: '👑',
    description: 'Actions by system administrators',
    filters: { roles: ['system_admin'], statuses: [], actions: [], resources: [], searchTerm: '', startDate: '', endDate: '', ipAddress: '', userEmail: '' }
  },
  {
    name: 'User Management',
    icon: '👥',
    description: 'User creation, updates, and deletions',
    filters: { resources: ['user', 'business_member'], statuses: [], actions: [], roles: [], searchTerm: '', startDate: '', endDate: '', ipAddress: '', userEmail: '' }
  },
  {
    name: 'Last 24 Hours',
    icon: '⏰',
    description: 'Recent activity from yesterday',
    filters: {
      startDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      statuses: [], actions: [], resources: [], roles: [], searchTerm: '', ipAddress: '', userEmail: ''
    }
  },
  {
    name: 'Business Operations',
    icon: '🏢',
    description: 'Business and collection changes',
    filters: { resources: ['business', 'collection'], statuses: [], actions: [], roles: [], searchTerm: '', startDate: '', endDate: '', ipAddress: '', userEmail: '' }
  },
  {
    name: 'Data Modifications',
    icon: '✏️',
    description: 'Updates and deletions',
    filters: { actions: ['update', 'delete'], statuses: [], resources: [], roles: [], searchTerm: '', startDate: '', endDate: '', ipAddress: '', userEmail: '' }
  },
  {
    name: 'Last Week',
    icon: '📅',
    description: 'Activity from past 7 days',
    filters: {
      startDate: new Date(Date.now() - 604800000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      statuses: [], actions: [], resources: [], roles: [], searchTerm: '', ipAddress: '', userEmail: ''
    }
  }
];

export function AuditLogsView({ scope, businessId, showTitle = true, showBorder = true }: AuditLogsViewProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;

  const [filters, setFilters] = useState<LogFilters>({
    searchTerm: '',
    actions: [],
    resources: [],
    statuses: [],
    roles: [],
    startDate: '',
    endDate: '',
    ipAddress: '',
    userEmail: ''
  });

  useEffect(() => {
    if (scope === 'system' || (scope === 'business' && businessId)) {
      setCurrentPage(1);
      loadAuditLogs();
    }
  }, [scope, businessId]);

  useEffect(() => {
    applyFilters();
  }, [logs, filters]);

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

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(term) ||
        log.resource_type.toLowerCase().includes(term) ||
        log.profiles?.full_name?.toLowerCase().includes(term) ||
        log.profiles?.email?.toLowerCase().includes(term) ||
        log.ip_address?.toLowerCase().includes(term) ||
        JSON.stringify(log.details).toLowerCase().includes(term)
      );
    }

    if (filters.actions.length > 0) {
      filtered = filtered.filter(log => filters.actions.includes(log.action));
    }

    if (filters.resources.length > 0) {
      filtered = filtered.filter(log => filters.resources.includes(log.resource_type));
    }

    if (filters.statuses.length > 0) {
      filtered = filtered.filter(log => filters.statuses.includes(log.status));
    }

    if (filters.roles.length > 0) {
      filtered = filtered.filter(log => filters.roles.includes(log.actor_role));
    }

    if (filters.startDate) {
      filtered = filtered.filter(log => new Date(log.created_at) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      filtered = filtered.filter(log => new Date(log.created_at) <= new Date(filters.endDate + 'T23:59:59'));
    }

    if (filters.ipAddress) {
      filtered = filtered.filter(log => log.ip_address?.includes(filters.ipAddress));
    }

    if (filters.userEmail) {
      filtered = filtered.filter(log => log.profiles?.email?.toLowerCase().includes(filters.userEmail.toLowerCase()));
    }

    setFilteredLogs(filtered);
    setCurrentPage(1);
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
    setFilters({
      searchTerm: '',
      actions: [],
      resources: [],
      statuses: [],
      roles: [],
      startDate: '',
      endDate: '',
      ipAddress: '',
      userEmail: ''
    });
  };

  const actionOptions = [...new Set(logs.map(log => log.action))].sort();
  const resourceOptions = [...new Set(logs.map(log => log.resource_type))].sort();
  const roleOptions = [...new Set(logs.map(log => log.actor_role).filter(Boolean))].sort();

  const hasActiveFilters =
    filters.searchTerm ||
    filters.actions.length > 0 ||
    filters.resources.length > 0 ||
    filters.statuses.length > 0 ||
    filters.roles.length > 0 ||
    filters.startDate ||
    filters.endDate ||
    filters.ipAddress ||
    filters.userEmail;

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

      {/* Filter Controls */}
      <div className={`bg-white dark:bg-gray-800 ${showBorder ? 'rounded-lg shadow-md' : ''} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdvancedFilters(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <Sliders size={18} />
              Advanced Filters
              {hasActiveFilters && (
                <span className="bg-white text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold">
                  ON
                </span>
              )}
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition text-sm font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>

          <button
            onClick={exportToCSV}
            disabled={filteredLogs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-4 flex flex-wrap gap-2">
            {filters.actions.length > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                <Zap size={14} />
                {filters.actions.length} action{filters.actions.length !== 1 ? 's' : ''}
              </span>
            )}
            {filters.resources.length > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm">
                <Filter size={14} />
                {filters.resources.length} resource{filters.resources.length !== 1 ? 's' : ''}
              </span>
            )}
            {filters.statuses.length > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
                {filters.statuses.length} status{filters.statuses.length !== 1 ? 'es' : ''}
              </span>
            )}
            {filters.roles.length > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm">
                {filters.roles.length} role{filters.roles.length !== 1 ? 's' : ''}
              </span>
            )}
            {(filters.startDate || filters.endDate) && (
              <span className="inline-flex items-center px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full text-sm">
                Date range
              </span>
            )}
            {filters.ipAddress && (
              <span className="inline-flex items-center px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm">
                IP: {filters.ipAddress}
              </span>
            )}
            {filters.userEmail && (
              <span className="inline-flex items-center px-3 py-1 bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 rounded-full text-sm">
                User: {filters.userEmail}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Logs Display */}
      <div className={`bg-white dark:bg-gray-800 ${showBorder ? 'rounded-lg shadow-md' : ''} overflow-hidden`}>
        <div className="px-6 py-4 bg-slate-50 dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700">
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Showing {filteredLogs.length} of {totalCount} total logs
            {hasActiveFilters && ' (filtered)'}
          </p>
        </div>

        <div className="max-h-[600px] overflow-y-auto">
          {filteredLogs.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Activity className="mx-auto mb-3 text-slate-300" size={48} />
              <p className="text-slate-500 dark:text-gray-400 font-medium">No audit logs found</p>
              <p className="text-slate-400 text-sm mt-1">
                {hasActiveFilters ? 'Try adjusting your filters' : 'No logs available yet'}
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800">
              <div className="hidden lg:grid lg:grid-cols-[auto_minmax(140px,1fr)_auto_minmax(120px,1fr)_minmax(100px,1fr)_minmax(120px,1.5fr)_auto] gap-2 px-4 py-2 bg-slate-100 dark:bg-gray-700 border-b border-slate-300 dark:border-gray-600 text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase sticky top-0 z-10">
                <div className="flex items-center justify-center w-6"></div>
                <div className="col-span-2">Time</div>
                <div className="">Status</div>
                <div className="">Action</div>
                <div className="">Resource</div>
                <div className="">User</div>
                <div className="">IP</div>
              </div>

              {paginatedLogs.map((log) => (
                <SplunkLogEntry key={log.id} log={{ ...log, type: 'audit' as const }} />
              ))}
            </div>
          )}
        </div>

        {filteredLogs.length > itemsPerPage && (
          <div className="flex flex-col items-center gap-3 px-6 py-4 border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800 flex-shrink-0">
            <div className="flex gap-2">
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

      {/* Advanced Filter Panel */}
      {showAdvancedFilters && (
        <AdvancedLogFilterPanel
          filterType="audit"
          filters={filters}
          onChange={setFilters}
          onClear={clearFilters}
          onClose={() => setShowAdvancedFilters(false)}
          actionOptions={actionOptions}
          resourceOptions={resourceOptions}
          roleOptions={roleOptions}
          presets={AUDIT_PRESETS}
        />
      )}
    </div>
  );
}
