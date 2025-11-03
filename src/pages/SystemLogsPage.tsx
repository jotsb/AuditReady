import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Database, Download, AlertCircle, RefreshCw, Sliders, Zap, Filter, Pause, Play, ArrowUp } from 'lucide-react';
import { SplunkLogEntry } from '../components/shared/SplunkLogEntry';
import { logger } from '../lib/logger';
import { AdvancedLogFilterPanel, LogFilters } from '../components/audit/AdvancedLogFilterPanel';
import { usePageTracking } from '../hooks/usePageTracking';

interface SystemLog {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  category: 'AUTH' | 'DATABASE' | 'API' | 'EDGE_FUNCTION' | 'CLIENT_ERROR' | 'SECURITY' | 'PERFORMANCE' | 'USER_ACTION' | 'PAGE_VIEW' | 'NAVIGATION';
  message: string;
  metadata: any;
  user_id: string | null;
  session_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  stack_trace: string | null;
  execution_time_ms: number | null;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

const SYSTEM_PRESETS = [
  {
    name: 'Critical Errors',
    icon: '🚨',
    description: 'Critical and error level logs',
    filters: { statuses: ['ERROR', 'CRITICAL'], actions: [], resources: [], roles: [], searchTerm: '', startDate: '', endDate: '', ipAddress: '', userEmail: '' }
  },
  {
    name: 'Security Events',
    icon: '🔐',
    description: 'Security-related system logs',
    filters: { resources: ['SECURITY', 'AUTH'], statuses: [], actions: [], roles: [], searchTerm: '', startDate: '', endDate: '', ipAddress: '', userEmail: '' }
  },
  {
    name: 'Performance Issues',
    icon: '⚡',
    description: 'Slow operations and performance warnings',
    filters: { resources: ['PERFORMANCE'], statuses: ['WARN', 'ERROR'], actions: [], roles: [], searchTerm: 'slow', startDate: '', endDate: '', ipAddress: '', userEmail: '' }
  },
  {
    name: 'Database Operations',
    icon: '🗄️',
    description: 'Database queries and operations',
    filters: { resources: ['DATABASE'], statuses: [], actions: [], roles: [], searchTerm: '', startDate: '', endDate: '', ipAddress: '', userEmail: '' }
  },
  {
    name: 'Client Errors',
    icon: '💥',
    description: 'Frontend errors and exceptions',
    filters: { resources: ['CLIENT_ERROR'], statuses: [], actions: [], roles: [], searchTerm: '', startDate: '', endDate: '', ipAddress: '', userEmail: '' }
  },
  {
    name: 'API Activity',
    icon: '🌐',
    description: 'API calls and edge functions',
    filters: { resources: ['API', 'EDGE_FUNCTION'], statuses: [], actions: [], roles: [], searchTerm: '', startDate: '', endDate: '', ipAddress: '', userEmail: '' }
  },
  {
    name: 'Last Hour',
    icon: '⏱️',
    description: 'Recent logs from past hour',
    filters: {
      startDate: new Date(Date.now() - 3600000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      statuses: [], actions: [], resources: [], roles: [], searchTerm: '', ipAddress: '', userEmail: ''
    }
  },
  {
    name: 'Warnings & Errors',
    icon: '⚠️',
    description: 'All warnings and errors',
    filters: { statuses: ['WARN', 'ERROR', 'CRITICAL'], actions: [], resources: [], roles: [], searchTerm: '', startDate: '', endDate: '', ipAddress: '', userEmail: '' }
  }
];

export function SystemLogsPage() {
  const { isSystemAdmin } = useAuth();
  usePageTracking('System Logs', { section: 'system_logs' });

  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [newLogsCount, setNewLogsCount] = useState(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const pendingLogsRef = useRef<SystemLog[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout>();
  const isAtTopRef = useRef(true);

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
    if (isSystemAdmin) {
      loadSystemLogs();
    }
  }, [isSystemAdmin]);

  useEffect(() => {
    if (!autoRefresh || !isSystemAdmin) return;

    const channel = supabase
      .channel('system-logs-realtime')
      .on('postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'system_logs'
        },
        async (payload) => {
          if (isPaused) {
            setNewLogsCount(prev => prev + 1);
            return;
          }

          const newLog = payload.new as SystemLog;

          if (newLog.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, full_name, email')
              .eq('id', newLog.user_id)
              .maybeSingle();

            if (profile) {
              newLog.profiles = profile;
            }
          }

          pendingLogsRef.current.push(newLog);

          if (batchTimeoutRef.current) {
            clearTimeout(batchTimeoutRef.current);
          }

          batchTimeoutRef.current = setTimeout(() => {
            const logsToAdd = [...pendingLogsRef.current];
            pendingLogsRef.current = [];

            if (isAtTopRef.current) {
              setLogs(prev => [...logsToAdd, ...prev]);
              setTotalCount(prev => prev + logsToAdd.length);
            } else {
              setNewLogsCount(prev => prev + logsToAdd.length);
              setLogs(prev => [...logsToAdd, ...prev]);
              setTotalCount(prev => prev + logsToAdd.length);
            }
          }, 300);
        }
      )
      .subscribe();

    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [autoRefresh, isSystemAdmin, isPaused]);

  useEffect(() => {
    applyFilters();
  }, [logs, filters]);

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

  const loadSystemLogs = async (silent = false) => {
    const startTime = performance.now();
    try {
      if (!silent) {
        setLoading(true);
        setError('');
        logger.info('Loading system logs', { page: 'SystemLogsPage' }, 'DATABASE');
      }

      const { data: logsData, error: fetchError } = await supabase
        .from('system_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);

      if (fetchError) throw fetchError;

      const userIds = [...new Set(logsData?.map(log => log.user_id).filter(Boolean))];
      let profilesMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        profilesMap = (profilesData || []).reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, any>);
      }

      const logsWithProfiles = logsData?.map(log => ({
        ...log,
        profiles: log.user_id ? profilesMap[log.user_id] : null
      })) || [];

      setTotalCount(logsWithProfiles.length);
      setLogs(logsWithProfiles);

      const duration = performance.now() - startTime;
      if (!silent) {
        logger.info('System logs loaded successfully', {
          page: 'SystemLogsPage',
          totalLogs: logsWithProfiles.length,
          duration: `${duration.toFixed(2)}ms`
        }, 'PERFORMANCE');
      }
    } catch (err: any) {
      if (!silent) {
        setError(err.message);
        logger.error('Failed to load system logs', {
          page: 'SystemLogsPage',
          error: err.message
        }, 'DATABASE');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(term) ||
        log.level.toLowerCase().includes(term) ||
        log.category.toLowerCase().includes(term) ||
        log.profiles?.full_name?.toLowerCase().includes(term) ||
        log.profiles?.email?.toLowerCase().includes(term) ||
        log.ip_address?.toLowerCase().includes(term) ||
        JSON.stringify(log.metadata).toLowerCase().includes(term)
      );
    }

    if (filters.statuses.length > 0) {
      filtered = filtered.filter(log => filters.statuses.includes(log.level));
    }

    if (filters.resources.length > 0) {
      filtered = filtered.filter(log => filters.resources.includes(log.category));
    }

    if (filters.startDate) {
      filtered = filtered.filter(log => new Date(log.timestamp) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      filtered = filtered.filter(log => new Date(log.timestamp) <= new Date(filters.endDate + 'T23:59:59'));
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
    const headers = ['Timestamp', 'Level', 'Category', 'Message', 'User', 'IP Address', 'Execution Time', 'Metadata'];
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.level,
      log.category,
      log.message,
      log.profiles?.email || 'N/A',
      log.ip_address || 'N/A',
      log.execution_time_ms ? `${log.execution_time_ms}ms` : 'N/A',
      JSON.stringify(log.metadata)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    logger.info('Exported system logs to CSV', {
      page: 'SystemLogsPage',
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

  const levelOptions = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
  const categoryOptions = ['AUTH', 'DATABASE', 'API', 'EDGE_FUNCTION', 'CLIENT_ERROR', 'SECURITY', 'PERFORMANCE', 'USER_ACTION', 'PAGE_VIEW', 'NAVIGATION'];

  const hasActiveFilters =
    filters.searchTerm ||
    filters.statuses.length > 0 ||
    filters.resources.length > 0 ||
    filters.startDate ||
    filters.endDate ||
    filters.ipAddress ||
    filters.userEmail;

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  if (!isSystemAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto mb-4 text-red-600" size={48} />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Access Denied</h2>
          <p className="text-slate-600 dark:text-gray-400">You do not have permission to view system logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="text-blue-600 dark:text-blue-400" size={32} />
            <div>
              <h1 className="text-3xl font-bold text-slate-800 dark:text-white">System Logs</h1>
              <p className="text-slate-600 dark:text-gray-400">
                Application-wide logging and monitoring
              </p>
            </div>
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
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-300 dark:hover:bg-gray-600'
              }`}
            >
              <RefreshCw size={18} className={autoRefresh && !isPaused ? 'animate-spin' : ''} />
              {autoRefresh ? 'Realtime ON' : 'Realtime OFF'}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="mr-2" size={20} />
            {error}
          </div>
        )}

        {/* Filter Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
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
              {filters.statuses.length > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-sm">
                  <Zap size={14} />
                  {filters.statuses.length} level{filters.statuses.length !== 1 ? 's' : ''}
                </span>
              )}
              {filters.resources.length > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                  <Filter size={14} />
                  {filters.resources.length} categor{filters.resources.length !== 1 ? 'ies' : 'y'}
                </span>
              )}
              {(filters.startDate || filters.endDate) && (
                <span className="inline-flex items-center px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-full text-sm">
                  Date range
                </span>
              )}
              {filters.ipAddress && (
                <span className="inline-flex items-center px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700">
            <p className="text-sm text-slate-600 dark:text-gray-400">
              Showing {filteredLogs.length} of {totalCount} total logs
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
                <div className="hidden lg:grid lg:grid-cols-[auto_minmax(140px,1fr)_auto_minmax(120px,1fr)_minmax(200px,2fr)_minmax(120px,1fr)_auto] gap-2 px-4 py-2 bg-slate-100 dark:bg-gray-700 border-b border-slate-300 dark:border-gray-600 text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase sticky top-0 z-10">
                  <div className="flex items-center justify-center w-6"></div>
                  <div className="">Time</div>
                  <div className="">Level</div>
                  <div className="">Category</div>
                  <div className="">Message</div>
                  <div className="">User</div>
                  <div className="">IP</div>
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
            ) : filteredLogs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Database className="mx-auto mb-3 text-slate-300" size={48} />
                <p className="text-slate-500 dark:text-gray-400 font-medium">No system logs found</p>
                <p className="text-slate-400 text-sm mt-1">
                  {hasActiveFilters ? 'Try adjusting your filters' : 'No logs available yet'}
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800">
                <div className="hidden lg:grid lg:grid-cols-[auto_minmax(140px,1fr)_auto_minmax(120px,1fr)_minmax(200px,2fr)_minmax(120px,1fr)_auto] gap-2 px-4 py-2 bg-slate-100 dark:bg-gray-700 border-b border-slate-300 dark:border-gray-600 text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase sticky top-0 z-10">
                  <div className="flex items-center justify-center w-6"></div>
                  <div className="">Time</div>
                  <div className="">Level</div>
                  <div className="">Category</div>
                  <div className="">Message</div>
                  <div className="">User</div>
                  <div className="">IP</div>
                </div>

                {paginatedLogs.map((log) => (
                  <SplunkLogEntry key={log.id} log={{ ...log, type: 'system' as const }} />
                ))}
              </div>
            )}
          </div>

          {filteredLogs.length > itemsPerPage && (
            <div className="flex flex-col items-center gap-3 px-6 py-4 border-t border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-gray-800">
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
            filterType="system"
            filters={filters}
            onChange={setFilters}
            onClear={clearFilters}
            onClose={() => setShowAdvancedFilters(false)}
            actionOptions={levelOptions}
            resourceOptions={categoryOptions}
            roleOptions={[]}
            presets={SYSTEM_PRESETS}
          />
        )}
      </div>
    </div>
  );
}
