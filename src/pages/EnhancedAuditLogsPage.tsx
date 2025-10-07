import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Activity, Filter, Search, Download, X, ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

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

export function EnhancedAuditLogsPage() {
  const { selectedBusiness } = useAuth();
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

  // Expanded log state for snapshot comparison
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    if (selectedBusiness) {
      loadAuditLogs();
    }
  }, [selectedBusiness]);

  useEffect(() => {
    applyFilters();
  }, [logs, searchTerm, filterAction, filterResource, filterStatus, filterRole, startDate, endDate]);

  const loadAuditLogs = async () => {
    if (!selectedBusiness) return;

    try {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('audit_logs')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(500);

      if (fetchError) throw fetchError;

      const businessLogs = data?.filter(log => {
        if (log.resource_type === 'business') {
          return log.resource_id === selectedBusiness.id;
        }
        if (log.resource_type === 'collection') {
          return log.details?.business_id === selectedBusiness.id;
        }
        if (log.resource_type === 'receipt' && log.details?.collection_id) {
          return true;
        }
        if (log.resource_type === 'business_member') {
          return log.details?.business_id === selectedBusiness.id;
        }
        if (log.resource_type === 'invitation') {
          return log.details?.business_id === selectedBusiness.id;
        }
        return false;
      }) || [];

      setLogs(businessLogs);
    } catch (err: any) {
      console.error('Error loading audit logs:', err);
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
    a.download = `audit-logs-${selectedBusiness?.name}-${new Date().toISOString().split('T')[0]}.csv`;
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'failure': return 'bg-red-100 text-red-800';
      case 'denied': return 'bg-orange-100 text-orange-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getActionColor = (action: string) => {
    if (action.startsWith('create')) return 'bg-blue-100 text-blue-800';
    if (action.startsWith('update')) return 'bg-yellow-100 text-yellow-800';
    if (action.startsWith('delete')) return 'bg-red-100 text-red-800';
    if (action.includes('approve')) return 'bg-green-100 text-green-800';
    if (action.includes('reject')) return 'bg-red-100 text-red-800';
    return 'bg-slate-100 text-slate-800';
  };

  const formatActionName = (action: string) => {
    return action.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const renderSnapshotComparison = (log: AuditLog) => {
    if (!log.snapshot_before && !log.snapshot_after) {
      return <div className="text-sm text-slate-500 italic">No snapshot data available</div>;
    }

    const before = log.snapshot_before || {};
    const after = log.snapshot_after || {};
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    return (
      <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
          <h4 className="font-semibold text-slate-700">Snapshot Comparison</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Field</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">Before</th>
                <th className="px-4 py-2 text-left font-medium text-slate-600">After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {Array.from(allKeys).map(key => {
                const beforeValue = before[key];
                const afterValue = after[key];
                const isChanged = JSON.stringify(beforeValue) !== JSON.stringify(afterValue);

                return (
                  <tr key={key} className={isChanged ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-2 font-medium text-slate-700">{key}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {beforeValue !== undefined ? JSON.stringify(beforeValue) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {afterValue !== undefined ? JSON.stringify(afterValue) : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const actionTypes = ['all', ...new Set(logs.map(log => log.action))];
  const resourceTypes = ['all', ...new Set(logs.map(log => log.resource_type))];
  const statuses = ['all', 'success', 'failure', 'denied'];
  const roles = ['all', ...new Set(logs.map(log => log.actor_role).filter(Boolean))];

  if (!selectedBusiness) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="mx-auto mb-4 text-slate-400" size={48} />
          <h2 className="text-xl font-semibold text-slate-700 mb-2">No Business Selected</h2>
          <p className="text-slate-600">Please select a business to view audit logs</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading audit logs...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Activity className="mr-3 text-blue-600" size={32} />
              <h1 className="text-3xl font-bold text-slate-800">Audit Logs</h1>
            </div>
            <button
              onClick={exportToCSV}
              disabled={filteredLogs.length === 0}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={18} className="mr-2" />
              Export CSV
            </button>
          </div>
          <p className="text-slate-600">
            Complete activity history for {selectedBusiness.name}
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <AlertCircle className="mr-2" size={20} />
            {error}
          </div>
        )}

        {/* Advanced Filters */}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {actionTypes.map(action => (
                  <option key={action} value={action}>
                    {action === 'all' ? 'All Actions' : formatActionName(action)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Resource</label>
              <select
                value={filterResource}
                onChange={(e) => setFilterResource(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {resourceTypes.map(resource => (
                  <option key={resource} value={resource}>
                    {resource === 'all' ? 'All Resources' : resource.charAt(0).toUpperCase() + resource.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {statuses.map(status => (
                  <option key={status} value={status}>
                    {status === 'all' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {roles.map(role => (
                  <option key={role} value={role}>
                    {role === 'all' ? 'All Roles' : role.charAt(0).toUpperCase() + role.slice(1)}
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

        {/* Logs Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
            <p className="text-sm text-slate-600">
              Showing {filteredLogs.length} of {logs.length} total logs
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {filteredLogs.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Activity className="mx-auto mb-3 text-slate-300" size={48} />
                <p className="text-slate-500 font-medium">No audit logs found</p>
                <p className="text-slate-400 text-sm mt-1">
                  Try adjusting your filters or search criteria
                </p>
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="px-6 py-4 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <button
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="mr-2 text-slate-400 hover:text-slate-600"
                        >
                          {expandedLog === log.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                        </button>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getActionColor(log.action)} mr-2`}>
                          {formatActionName(log.action)}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                        {log.actor_role && (
                          <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                            {log.actor_role}
                          </span>
                        )}
                      </div>

                      <div className="ml-8">
                        <div className="text-sm font-medium text-slate-900 mb-1">
                          {log.profiles?.full_name || 'Unknown User'}
                          <span className="text-slate-500 font-normal"> • {log.resource_type}</span>
                        </div>
                        <div className="text-xs text-slate-500 mb-1">
                          {log.profiles?.email || log.user_id}
                        </div>
                        <div className="text-xs text-slate-400">
                          {new Date(log.created_at).toLocaleString()}
                          {log.ip_address && <span className="ml-2">• IP: {log.ip_address}</span>}
                        </div>

                        {log.error_message && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                            <span className="font-medium">Error:</span> {log.error_message}
                          </div>
                        )}

                        {expandedLog === log.id && renderSnapshotComparison(log)}
                      </div>
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
