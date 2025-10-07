import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

interface AuditLogEntryProps {
  log: {
    id: string;
    action: string;
    resource_type: string;
    status: 'success' | 'failure' | 'denied';
    actor_role?: string;
    error_message?: string | null;
    created_at: string;
    ip_address?: string | null;
    snapshot_before?: any;
    snapshot_after?: any;
    profiles?: {
      full_name: string;
      email: string;
    };
  };
}

export function AuditLogEntry({ log }: AuditLogEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const renderSnapshotComparison = () => {
    if (!log.snapshot_before && !log.snapshot_after) {
      return <div className="text-sm text-slate-500 italic">No snapshot data available</div>;
    }

    const before = log.snapshot_before || {};
    const after = log.snapshot_after || {};
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    // Filter out system fields that shouldn't be displayed
    const filteredKeys = Array.from(allKeys).filter(key =>
      !['id', 'created_at', 'updated_at'].includes(key)
    );

    if (filteredKeys.length === 0) {
      return <div className="text-sm text-slate-500 italic">No changes to display</div>;
    }

    return (
      <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
          <h4 className="font-semibold text-slate-700">Changes</h4>
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
              {filteredKeys.map(key => {
                const beforeValue = before[key];
                const afterValue = after[key];
                const isChanged = JSON.stringify(beforeValue) !== JSON.stringify(afterValue);

                // Format values for display
                const formatValue = (val: any) => {
                  if (val === null || val === undefined) return <span className="text-slate-400">—</span>;
                  if (typeof val === 'boolean') return val ? 'true' : 'false';
                  if (typeof val === 'object') return JSON.stringify(val);
                  return String(val);
                };

                return (
                  <tr key={key} className={isChanged ? 'bg-yellow-50' : ''}>
                    <td className="px-4 py-2 font-medium text-slate-700">
                      {key.replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {formatValue(beforeValue)}
                    </td>
                    <td className="px-4 py-2 text-slate-600 font-medium">
                      {isChanged && <span className="text-yellow-600 mr-2">→</span>}
                      {formatValue(afterValue)}
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

  return (
    <div className="border-b border-slate-200 hover:bg-slate-50 transition">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-1 min-w-0">
            {isExpanded ? (
              <ChevronDown size={20} className="text-slate-400 mr-3 flex-shrink-0" />
            ) : (
              <ChevronRight size={20} className="text-slate-400 mr-3 flex-shrink-0" />
            )}

            <div className="flex items-center flex-wrap gap-2 mr-4 flex-shrink-0">
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${getActionColor(log.action)}`}>
                {formatActionName(log.action)}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(log.status)}`}>
                {log.status}
              </span>
              {log.actor_role && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                  {log.actor_role}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {log.profiles?.full_name || 'Unknown User'}
                <span className="text-slate-500 font-normal"> • {log.resource_type}</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {new Date(log.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          {log.error_message && (
            <AlertCircle size={18} className="text-red-600 ml-2 flex-shrink-0" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-6 pb-4">
          <div className="pl-8 space-y-3">
            <div className="text-xs text-slate-600">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="font-medium">Email:</span> {log.profiles?.email || 'N/A'}
                </div>
                {log.ip_address && (
                  <div>
                    <span className="font-medium">IP Address:</span> {log.ip_address}
                  </div>
                )}
              </div>
            </div>

            {log.error_message && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                <span className="font-medium">Error:</span> {log.error_message}
              </div>
            )}

            {renderSnapshotComparison()}
          </div>
        </div>
      )}
    </div>
  );
}
