import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Database, Filter, Search, Download, AlertCircle, RefreshCw } from 'lucide-react';
import { SplunkLogEntry } from '../components/shared/SplunkLogEntry';
import { logger } from '../lib/logger';

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

export function SystemLogsPage() {
  const { isSystemAdmin } = useAuth();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterUserId, setFilterUserId] = useState<string>('all');
  const [filterSessionId, setFilterSessionId] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 50;

  useEffect(() => {
    loadSystemLogs();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        loadSystemLogs(true);
      }, 5000); // Refresh every 5 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  useEffect(() => {
    applyFilters();
  }, [logs, searchTerm, filterLevel, filterCategory, filterUserId, filterSessionId, startDate, endDate]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterLevel, filterCategory, filterUserId, filterSessionId, startDate, endDate]);

  const loadSystemLogs = async (silent = false) => {
    const startTime = performance.now();
    try {
      if (!silent) {
        setLoading(true);
        setError('');
        logger.info('Loading system logs', { page: 'SystemLogsPage' }, 'DATABASE');
      }

      // Load all logs (up to a reasonable limit)
      const { data: logsData, error: fetchError, count } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false })
        .limit(1000); // Reasonable limit to prevent loading too much

      if (fetchError) throw fetchError;

      const loadTime = performance.now() - startTime;
      if (!silent) {
        logger.performance('System logs loaded', loadTime, {
          page: 'SystemLogsPage',
          logCount: logsData?.length || 0,
          totalCount: count
        });
      }

      // Fetch user profiles separately for logs that have user_id
      const userIds = [...new Set(logsData?.map(log => log.user_id).filter(Boolean))];

      let profilesMap: Record<string, { full_name: string; email: string }> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);

        if (profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = { full_name: profile.full_name, email: profile.email };
            return acc;
          }, {} as Record<string, { full_name: string; email: string }>);
        }
      }

      // Merge profiles into logs
      const logsWithProfiles = logsData?.map(log => ({
        ...log,
        profiles: log.user_id ? profilesMap[log.user_id] : undefined
      })) || [];

      setLogs(logsWithProfiles);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Error loading system logs:', err);
      setError(err.message);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const applyFilters = () => {
    let filtered = [...logs];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(term) ||
        log.category.toLowerCase().includes(term) ||
        log.level.toLowerCase().includes(term) ||
        log.profiles?.full_name?.toLowerCase().includes(term) ||
        log.profiles?.email?.toLowerCase().includes(term) ||
        JSON.stringify(log.metadata).toLowerCase().includes(term)
      );
    }

    // Level filter
    if (filterLevel !== 'all') {
      filtered = filtered.filter(log => log.level === filterLevel);
    }

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(log => log.category === filterCategory);
    }

    // User filter
    if (filterUserId !== 'all') {
      filtered = filtered.filter(log => log.user_id === filterUserId);
    }

    // Session filter
    if (filterSessionId !== 'all') {
      filtered = filtered.filter(log => log.session_id === filterSessionId);
    }

    // Date range filter
    if (startDate) {
      filtered = filtered.filter(log => new Date(log.timestamp) >= new Date(startDate));
    }
    if (endDate) {
      filtered = filtered.filter(log => new Date(log.timestamp) <= new Date(endDate + 'T23:59:59'));
    }

    setFilteredLogs(filtered);
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Level', 'Category', 'Message', 'User', 'IP Address', 'Execution Time (ms)', 'Metadata'];
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.level,
      log.category,
      log.message,
      log.profiles?.full_name || 'System',
      log.ip_address || 'N/A',
      log.execution_time_ms?.toString() || 'N/A',
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
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilterLevel('all');
    setFilterCategory('all');
    setFilterUserId('all');
    setFilterSessionId('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const levels = ['all', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
  const categories = ['all', 'AUTH', 'DATABASE', 'API', 'EDGE_FUNCTION', 'CLIENT_ERROR', 'SECURITY', 'PERFORMANCE', 'USER_ACTION', 'PAGE_VIEW', 'NAVIGATION'];

  const uniqueUsers = ['all', ...new Set(logs.map(log => log.user_id).filter(Boolean) as string[])];
  const uniqueSessions = ['all', ...new Set(logs.map(log => log.session_id).filter(Boolean) as string[])];

  if (!isSystemAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto mb-4 text-red-600" size={48} />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Access Denied</h2>
          <p className="text-slate-600 dark:text-gray-400">You do not have permission to view system logs.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-800 flex items-center justify-center">
        <div className="text-slate-600 dark:text-gray-400">Loading system logs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-800 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Database className="mr-3 text-blue-600" size={32} />
              <h1 className="text-3xl font-bold text-slate-800 dark:text-white">System Logs</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center px-4 py-2 rounded-lg transition ${
                  autoRefresh
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 hover:bg-slate-300'
                }`}
              >
                <RefreshCw size={18} className={`mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                {autoRefresh ? 'Live' : 'Auto-Refresh'}
              </button>
              <button
                onClick={exportToCSV}
                disabled={filteredLogs.length === 0}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={18} className="mr-2" />
                Export CSV
              </button>
            </div>
          </div>
          <p className="text-slate-600 dark:text-gray-400">
            Infrastructure and application logs
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="mr-2" size={20} />
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Filter className="text-slate-500 dark:text-gray-400 mr-2" size={20} />
              <h3 className="font-semibold text-slate-800 dark:text-white">Filters</h3>
            </div>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear All
            </button>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-gray-500" size={20} />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Level</label>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {levels.map(level => (
                  <option key={level} value={level}>
                    {level === 'all' ? 'All Levels' : level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">User</label>
              <select
                value={filterUserId}
                onChange={(e) => setFilterUserId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Users</option>
                {uniqueUsers.slice(1).map(userId => {
                  const profile = logs.find(log => log.user_id === userId)?.profiles;
                  return (
                    <option key={userId} value={userId}>
                      {profile?.full_name || profile?.email || userId.substring(0, 8)}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Session</label>
              <select
                value={filterSessionId}
                onChange={(e) => setFilterSessionId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Sessions</option>
                {uniqueSessions.slice(1).map(sessionId => (
                  <option key={sessionId} value={sessionId}>
                    {sessionId.substring(0, 20)}...
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden flex flex-col">
          <div className="px-6 py-4 bg-slate-50 dark:bg-gray-800 border-b border-slate-200 flex-shrink-0">
            <p className="text-sm text-slate-600 dark:text-gray-400">
              {filteredLogs.length > 0
                ? `Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, filteredLogs.length)} of ${filteredLogs.length} filtered logs`
                : `No logs found (Total in database: ${totalCount})`
              }
            </p>
          </div>

          <div className="overflow-y-auto flex-1" style={{ maxHeight: '600px' }}>
            {filteredLogs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Database className="mx-auto mb-3 text-slate-300" size={48} />
                <p className="text-slate-500 dark:text-gray-400 font-medium">No system logs found</p>
                <p className="text-slate-400 text-sm mt-1">
                  Try adjusting your filters or search criteria
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800">
                {/* Header Row - Desktop Only */}
                <div className="hidden lg:grid lg:grid-cols-[auto_minmax(140px,1fr)_auto_auto_minmax(200px,2fr)_minmax(100px,1fr)_auto] gap-2 px-4 py-2 bg-slate-100 dark:bg-gray-700 border-b border-slate-300 dark:border-gray-600 text-xs font-semibold text-slate-600 dark:text-gray-400 uppercase sticky top-0 z-10">
                  <div className="flex items-center justify-center w-6"></div>
                  <div>Time</div>
                  <div className="min-w-[60px]">Level</div>
                  <div className="min-w-[100px]">Category</div>
                  <div>Message</div>
                  <div>User</div>
                  <div className="text-right min-w-[60px]">Duration</div>
                </div>

                {/* Log Rows - Paginated */}
                {filteredLogs
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((log) => (
                    <SplunkLogEntry key={log.id} log={{ ...log, type: 'system' as const }} />
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
                Page {currentPage} of {Math.ceil(filteredLogs.length / itemsPerPage)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
