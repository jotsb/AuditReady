import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Activity, Filter } from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: any;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export function AuditLogsPage() {
  const { user, selectedBusiness } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterResource, setFilterResource] = useState<string>('all');

  useEffect(() => {
    if (selectedBusiness) {
      loadAuditLogs();
    }
  }, [selectedBusiness]);

  const loadAuditLogs = async () => {
    if (!selectedBusiness) return;

    try {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('audit_logs')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(200);

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

  const actionTypes = ['all', ...new Set(logs.map(log => log.action))];
  const resourceTypes = ['all', ...new Set(logs.map(log => log.resource_type))];

  const filteredLogs = logs.filter(log => {
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    const matchesResource = filterResource === 'all' || log.resource_type === filterResource;
    return matchesAction && matchesResource;
  });

  const getActionColor = (action: string) => {
    if (action.startsWith('create')) return 'bg-green-100 text-green-800';
    if (action.startsWith('update')) return 'bg-blue-100 text-blue-800';
    if (action.startsWith('delete')) return 'bg-red-100 text-red-800';
    return 'bg-slate-100 text-slate-800';
  };

  const formatActionName = (action: string) => {
    return action.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatDetails = (log: AuditLog) => {
    if (log.action === 'create_receipt' || log.action === 'delete_receipt') {
      return `${log.details?.vendor_name || 'N/A'} - $${log.details?.total_amount || '0'}`;
    }
    if (log.action === 'update_receipt' && log.details?.changes) {
      const changes = log.details.changes;
      const changeKeys = Object.keys(changes);
      if (changeKeys.length > 0) {
        return `Changed: ${changeKeys.join(', ')}`;
      }
    }
    if (log.action.includes('business') || log.action.includes('collection')) {
      return log.details?.name || 'N/A';
    }
    return 'Action performed';
  };

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
          <div className="flex items-center mb-2">
            <Activity className="mr-3 text-blue-600" size={32} />
            <h1 className="text-3xl font-bold text-slate-800">Audit Logs</h1>
          </div>
          <p className="text-slate-600">
            View all activity and changes for {selectedBusiness.name}
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div className="flex flex-wrap gap-4 items-center">
              <Filter className="text-slate-500" size={20} />
              <div className="flex-1 min-w-[200px]">
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
              <div className="flex-1 min-w-[200px]">
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
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Resource
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Activity className="mx-auto mb-3 text-slate-300" size={48} />
                      <p className="text-slate-500 font-medium">No audit logs found</p>
                      <p className="text-slate-400 text-sm mt-1">
                        Activity will appear here as actions are performed
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">
                          {log.profiles?.full_name || 'Unknown User'}
                        </div>
                        <div className="text-xs text-slate-500">
                          {log.profiles?.email || log.user_id}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getActionColor(log.action)}`}>
                          {formatActionName(log.action)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-600 capitalize">{log.resource_type}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          {log.resource_id?.substring(0, 8)}...
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-600 max-w-md">
                          {formatDetails(log)}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredLogs.length > 0 && (
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
              <p className="text-sm text-slate-600">
                Showing {filteredLogs.length} of {logs.length} total logs
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
