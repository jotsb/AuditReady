import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, Filter, Download, AlertCircle, Sliders, Zap, Pause, Play, ArrowUp, RefreshCw } from 'lucide-react';
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
  business_id: string | null;
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

const EMPTY_FILTERS: LogFilters = {
  searchTerm: '',
  actions: [],
  resources: [],
  statuses: [],
  roles: [],
  startDate: '',
  endDate: '',
  ipAddress: '',
  userEmail: ''
};

const AUDIT_PRESETS = [
  {
    name: 'Failed Actions',
    icon: '!',
    description: 'All failed operations',
    filters: { ...EMPTY_FILTERS, statuses: ['failure'] }
  },
  {
    name: 'Security Events',
    icon: 'S',
    description: 'Access denied and authentication failures',
    filters: { ...EMPTY_FILTERS, statuses: ['denied', 'failure'], searchTerm: 'auth' }
  },
  {
    name: 'Admin Activity',
    icon: 'A',
    description: 'Actions by system administrators',
    filters: { ...EMPTY_FILTERS, roles: ['system_admin'] }
  },
  {
    name: 'User Management',
    icon: 'U',
    description: 'User creation, updates, and deletions',
    filters: { ...EMPTY_FILTERS, resources: ['user', 'business_member'] }
  },
  {
    name: 'Last 24 Hours',
    icon: 'T',
    description: 'Recent activity from yesterday',
    filters: {
      ...EMPTY_FILTERS,
      startDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  },
  {
    name: 'Business Operations',
    icon: 'B',
    description: 'Business and collection changes',
    filters: { ...EMPTY_FILTERS, resources: ['business', 'collection'] }
  },
  {
    name: 'Data Modifications',
    icon: 'D',
    description: 'Updates and deletions',
    filters: { ...EMPTY_FILTERS, actions: ['update', 'delete'] }
  },
  {
    name: 'Last Week',
    icon: 'W',
    description: 'Activity from past 7 days',
    filters: {
      ...EMPTY_FILTERS,
      startDate: new Date(Date.now() - 604800000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  }
];

const ACTION_OPTIONS = ['create', 'update', 'delete', 'view', 'export', 'login', 'logout', 'invite', 'approve', 'reject'];
const RESOURCE_OPTIONS = ['receipt', 'collection', 'business', 'business_member', 'user', 'invitation', 'export_job', 'category'];
const ROLE_OPTIONS = ['owner', 'manager', 'member', 'system_admin'];

function buildServerQuery(scope: string, businessId: string | undefined, filters: LogFilters, page: number, itemsPerPage: number) {
  const start = (page - 1) * itemsPerPage;
  const end = start + itemsPerPage - 1;

  let query = supabase
    .from('audit_logs')
    .select('*, profiles(full_name, email)', { count: 'exact' });

  if (scope === 'business' && businessId) {
    query = query.eq('business_id', businessId);
  }

  if (filters.actions.length > 0) {
    query = query.in('action', filters.actions);
  }
  if (filters.resources.length > 0) {
    query = query.in('resource_type', filters.resources);
  }
  if (filters.statuses.length > 0) {
    query = query.in('status', filters.statuses);
  }
  if (filters.roles.length > 0) {
    query = query.in('actor_role', filters.roles);
  }
  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate + 'T23:59:59');
  }
  if (filters.ipAddress) {
    query = query.ilike('ip_address', `%${filters.ipAddress}%`);
  }

  query = query.order('created_at', { ascending: false }).range(start, end);

  return query;
}

export function AuditLogsView({ scope, businessId, showTitle = true, showBorder = true }: AuditLogsViewProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [newLogsCount, setNewLogsCount] = useState(0);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const pendingLogsRef = useRef<AuditLog[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout>();
  const isAtTopRef = useRef(true);
  const filtersRef = useRef<LogFilters>(EMPTY_FILTERS);

  const [filters, setFilters] = useState<LogFilters>(EMPTY_FILTERS);

  const loadAuditLogs = useCallback(async (page: number, activeFilters: LogFilters) => {
    if (scope === 'business' && !businessId) return;

    const startTime = performance.now();
    try {
      setLoading(true);
      setError('');

      const { data, error: fetchError, count } = await buildServerQuery(scope, businessId, activeFilters, page, itemsPerPage);

      if (fetchError) throw fetchError;

      setLogs(data || []);
      setTotalCount(count || 0);

      const duration = performance.now() - startTime;
      logger.info('Audit logs loaded', {
        component: 'AuditLogsView',
        scope,
        count: count || 0,
        page,
        duration: `${duration.toFixed(0)}ms`
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
  }, [scope, businessId]);

  useEffect(() => {
    if (scope === 'system' || (scope === 'business' && businessId)) {
      setCurrentPage(1);
      loadAuditLogs(1, filters);
    }
  }, [scope, businessId]);

  useEffect(() => {
    filtersRef.current = filters;
    setCurrentPage(1);
    loadAuditLogs(1, filters);
  }, [filters, loadAuditLogs]);

  useEffect(() => {
    if (currentPage > 1) {
      loadAuditLogs(currentPage, filtersRef.current);
    }
  }, [currentPage, loadAuditLogs]);

  useEffect(() => {
    if (!autoRefresh) {
      setRealtimeStatus('disconnected');
      return;
    }
    if (scope === 'business' && !businessId) return;

    setRealtimeStatus('connecting');

    const channel = supabase
      .channel('audit-logs-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        async (payload) => {
          if (isPaused) {
            setNewLogsCount(prev => prev + 1);
            return;
          }

          const newLog = payload.new as AuditLog;

          if (scope === 'business' && businessId && newLog.business_id !== businessId) {
            return;
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', newLog.user_id)
            .maybeSingle();

          if (profile) {
            newLog.profiles = profile;
          }

          pendingLogsRef.current.push(newLog);

          if (batchTimeoutRef.current) {
            clearTimeout(batchTimeoutRef.current);
          }

          batchTimeoutRef.current = setTimeout(() => {
            const logsToAdd = [...pendingLogsRef.current];
            pendingLogsRef.current = [];

            setLogs(prev => [...logsToAdd, ...prev].slice(0, itemsPerPage));
            setTotalCount(prev => prev + logsToAdd.length);

            if (!isAtTopRef.current) {
              setNewLogsCount(prev => prev + logsToAdd.length);
            }
          }, 300);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('error');
        } else if (status === 'CLOSED') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [autoRefresh, scope, businessId, isPaused]);

  useEffect(() => {
    const container = logsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      isAtTopRef.current = container.scrollTop < 100;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    logsContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    setNewLogsCount(0);
  };

  const togglePause = () => {
    setIsPaused(prev => !prev);
    if (isPaused) {
      setNewLogsCount(0);
    }
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'User', 'Email', 'Role', 'Action', 'Resource Type', 'Status', 'IP Address', 'Details'];
    const rows = logs.map(log => [
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
      exportedCount: logs.length
    }, 'USER_ACTION');
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
  };

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

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  if (scope === 'business' && !businessId && !loading) {
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
          <div className="flex items-center gap-3">
            {autoRefresh && (
              <button
                onClick={togglePause}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium ${
                  isPaused
                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                title={isPaused ? 'Resume realtime updates' : 'Pause realtime updates'}
              >
                {isPaused ? <Play size={18} /> : <Pause size={18} />}
                {isPaused ? 'Paused' : 'Live'}
              </button>
            )}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium ${
                autoRefresh
                  ? realtimeStatus === 'connected'
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : realtimeStatus === 'error'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : 'bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-300 dark:hover:bg-gray-600'
              }`}
              title={autoRefresh ? `Status: ${realtimeStatus}` : 'Click to enable realtime'}
            >
              <RefreshCw size={18} className={autoRefresh && !isPaused && realtimeStatus === 'connecting' ? 'animate-spin' : ''} />
              {autoRefresh ? (
                realtimeStatus === 'connected' ? 'Realtime ON' :
                realtimeStatus === 'error' ? 'Connection Failed' :
                realtimeStatus === 'connecting' ? 'Connecting...' : 'Disconnected'
              ) : 'Realtime OFF'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle className="mr-2" size={20} />
          {error}
        </div>
      )}

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
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>

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
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full text-sm">
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

      <div className={`bg-white dark:bg-gray-800 ${showBorder ? 'rounded-lg shadow-md' : ''} overflow-hidden`}>
        <div className="px-6 py-4 bg-slate-50 dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700">
          <p className="text-sm text-slate-600 dark:text-gray-400">
            {totalCount > 0 ? (
              <>Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} logs</>
            ) : (
              <>0 logs</>
            )}
            {hasActiveFilters && ' (filtered)'}
          </p>
        </div>

        <div ref={logsContainerRef} className="max-h-[600px] overflow-y-auto relative">
          {newLogsCount > 0 && (
            <div className="sticky top-2 left-0 right-0 z-20 flex justify-center">
              <button
                onClick={scrollToTop}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all transform hover:scale-105 font-medium animate-bounce"
              >
                <ArrowUp size={18} />
                {newLogsCount} New Log{newLogsCount !== 1 ? 's' : ''}
              </button>
            </div>
          )}
          {loading ? (
            <div className="bg-white dark:bg-gray-800">
              <div className="hidden lg:grid lg:grid-cols-[auto_minmax(140px,1fr)_auto_minmax(120px,1fr)_minmax(100px,1fr)_minmax(120px,1.5fr)_auto] gap-2 px-4 py-2 bg-slate-100 dark:bg-gray-700 border-b border-slate-300 dark:border-gray-600 text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase sticky top-0 z-10">
                <div className="flex items-center justify-center w-6"></div>
                <div>Time</div>
                <div>Status</div>
                <div>Action</div>
                <div>Resource</div>
                <div>User</div>
                <div>IP</div>
              </div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`skeleton-${i}`} className="p-4 border-b border-slate-200 dark:border-gray-700">
                  <div className="flex items-start gap-4">
                    <div className="w-6 h-6 bg-slate-200 dark:bg-gray-700 rounded-full animate-pulse" />
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-4">
                        <div className="h-4 w-32 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="h-5 w-20 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                      <div className="h-4 w-64 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                      <div className="flex gap-2">
                        <div className="h-3 w-24 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="h-3 w-32 bg-slate-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
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
                <div>Time</div>
                <div>Status</div>
                <div>Action</div>
                <div>Resource</div>
                <div>User</div>
                <div>IP</div>
              </div>

              {logs.map((log) => (
                <SplunkLogEntry key={log.id} log={{ ...log, type: 'audit' as const }} />
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
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
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
            <div className="text-sm text-slate-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </div>
          </div>
        )}
      </div>

      {showAdvancedFilters && (
        <AdvancedLogFilterPanel
          filterType="audit"
          filters={filters}
          onChange={setFilters}
          onClear={clearFilters}
          onClose={() => setShowAdvancedFilters(false)}
          actionOptions={ACTION_OPTIONS}
          resourceOptions={RESOURCE_OPTIONS}
          roleOptions={ROLE_OPTIONS}
          presets={AUDIT_PRESETS}
        />
      )}
    </div>
  );
}
