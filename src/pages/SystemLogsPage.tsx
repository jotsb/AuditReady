import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Database, Filter, Search, Download, AlertCircle, X, RefreshCw } from 'lucide-react';

interface SystemLog {
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  category: 'AUTH' | 'DATABASE' | 'API' | 'EDGE_FUNCTION' | 'CLIENT_ERROR' | 'SECURITY' | 'PERFORMANCE';
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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Expanded log state
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

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
  }, [logs, searchTerm, filterLevel, filterCategory, startDate, endDate]);

  const loadSystemLogs = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError('');
      }

      const { data: logsData, error: fetchError } = await supabase
        .from('system_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);

      if (fetchError) throw fetchError;

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
    setStartDate('');
    setEndDate('');
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'DEBUG': return 'bg-slate-100 text-slate-800';
      case 'INFO': return 'bg-blue-100 text-blue-800';
      case 'WARN': return 'bg-yellow-100 text-yellow-800';
      case 'ERROR': return 'bg-red-100 text-red-800';
      case 'CRITICAL': return 'bg-purple-100 text-purple-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'AUTH': return 'bg-green-100 text-green-800';
      case 'DATABASE': return 'bg-blue-100 text-blue-800';
      case 'API': return 'bg-cyan-100 text-cyan-800';
      case 'EDGE_FUNCTION': return 'bg-indigo-100 text-indigo-800';
      case 'CLIENT_ERROR': return 'bg-red-100 text-red-800';
      case 'SECURITY': return 'bg-orange-100 text-orange-800';
      case 'PERFORMANCE': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const levels = ['all', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
  const categories = ['all', 'AUTH', 'DATABASE', 'API', 'EDGE_FUNCTION', 'CLIENT_ERROR', 'SECURITY', 'PERFORMANCE'];

  if (!isSystemAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto mb-4 text-red-600" size={48} />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Access Denied</h2>
          <p className="text-slate-600">You do not have permission to view system logs.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading system logs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Database className="mr-3 text-blue-600" size={32} />
              <h1 className="text-3xl font-bold text-slate-800">System Logs</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center px-4 py-2 rounded-lg transition ${
                  autoRefresh
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
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
          <p className="text-slate-600">
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
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Filter className="text-slate-500 mr-2" size={20} />
              <h3 className="font-semibold text-slate-800">Filters</h3>
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
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filter Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Level</label>
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {levels.map(level => (
                  <option key={level} value={level}>
                    {level === 'all' ? 'All Levels' : level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Logs Display */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <p className="text-sm text-slate-600">
              Showing {filteredLogs.length} of {logs.length} total logs
            </p>
          </div>

          <div className="divide-y divide-slate-200 max-h-[600px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Database className="mx-auto mb-3 text-slate-300" size={48} />
                <p className="text-slate-500 font-medium">No system logs found</p>
                <p className="text-slate-400 text-sm mt-1">
                  Try adjusting your filters or search criteria
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="px-6 py-4 hover:bg-slate-50 transition">
                  <div className="flex items-start">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <span className={`px-2 py-1 text-xs font-bold rounded ${getLevelColor(log.level)} mr-2`}>
                          {log.level}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getCategoryColor(log.category)}`}>
                          {log.category}
                        </span>
                        {log.execution_time_ms && (
                          <span className="ml-2 text-xs text-slate-500">
                            {log.execution_time_ms}ms
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-medium text-slate-900 mb-1">
                        {log.message}
                      </div>

                      <div className="text-xs text-slate-500 mb-2">
                        {new Date(log.timestamp).toLocaleString()}
                        {log.profiles && <span className="ml-2">• {log.profiles.full_name}</span>}
                        {log.ip_address && <span className="ml-2">• {log.ip_address}</span>}
                      </div>

                      {(log.metadata && Object.keys(log.metadata).length > 0) && (
                        <button
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          {expandedLog === log.id ? 'Hide Details' : 'Show Details'}
                        </button>
                      )}

                      {expandedLog === log.id && (
                        <div className="mt-3 p-3 bg-slate-50 rounded border border-slate-200">
                          <div className="text-xs font-mono text-slate-700">
                            <pre className="whitespace-pre-wrap overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                          {log.stack_trace && (
                            <div className="mt-2 pt-2 border-t border-slate-300">
                              <div className="text-xs font-semibold text-slate-700 mb-1">Stack Trace:</div>
                              <pre className="text-xs text-red-600 whitespace-pre-wrap overflow-x-auto">
                                {log.stack_trace}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
