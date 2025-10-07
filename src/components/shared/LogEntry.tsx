import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertCircle, AlertTriangle } from 'lucide-react';

type AuditLog = {
  type: 'audit';
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

type SystemLog = {
  type: 'system';
  id: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  category: 'AUTH' | 'DATABASE' | 'API' | 'EDGE_FUNCTION' | 'CLIENT_ERROR' | 'SECURITY' | 'PERFORMANCE';
  message: string;
  metadata: any;
  user_id: string | null;
  ip_address: string | null;
  stack_trace: string | null;
  execution_time_ms: number | null;
  profiles?: {
    full_name: string;
    email: string;
  };
};

type LogEntryProps = {
  log: AuditLog | SystemLog;
};

export function LogEntry({ log }: LogEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isAuditLog = log.type === 'audit';
  const isSystemLog = log.type === 'system';

  // Common styling functions
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

  const formatActionName = (action: string) => {
    return action.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Render audit log snapshot comparison
  const renderAuditDetails = (auditLog: AuditLog) => {
    if (!auditLog.snapshot_before && !auditLog.snapshot_after) {
      return <div className="text-sm text-slate-500 italic">No snapshot data available</div>;
    }

    const before = auditLog.snapshot_before || {};
    const after = auditLog.snapshot_after || {};
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

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

  // Render system log details
  const renderSystemDetails = (sysLog: SystemLog) => {
    const hasDetails = (sysLog.metadata && Object.keys(sysLog.metadata).length > 0) || sysLog.stack_trace;

    if (!hasDetails) {
      return <div className="text-sm text-slate-500 italic">No additional details</div>;
    }

    return (
      <div className="space-y-3">
        {sysLog.metadata && Object.keys(sysLog.metadata).length > 0 && (
          <div className="p-3 bg-slate-50 rounded border border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-2">Metadata</div>
            <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(sysLog.metadata, null, 2)}
            </pre>
          </div>
        )}

        {sysLog.stack_trace && (
          <div className="p-3 bg-red-50 rounded border border-red-200">
            <div className="text-xs font-semibold text-red-700 mb-2">Stack Trace</div>
            <pre className="text-xs font-mono text-red-600 whitespace-pre-wrap overflow-x-auto">
              {sysLog.stack_trace}
            </pre>
          </div>
        )}
      </div>
    );
  };

  // Determine if log has expandable content
  const hasExpandableContent = isAuditLog
    ? (log.snapshot_before || log.snapshot_after)
    : ((log as SystemLog).metadata && Object.keys((log as SystemLog).metadata).length > 0) || (log as SystemLog).stack_trace;

  // Get primary and secondary badges
  const getPrimaryBadge = () => {
    if (isAuditLog) {
      const auditLog = log as AuditLog;
      return (
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getActionColor(auditLog.action)}`}>
          {formatActionName(auditLog.action)}
        </span>
      );
    } else {
      const sysLog = log as SystemLog;
      return (
        <span className={`px-2 py-1 text-xs font-bold rounded ${getLevelColor(sysLog.level)}`}>
          {sysLog.level}
        </span>
      );
    }
  };

  const getSecondaryBadges = () => {
    if (isAuditLog) {
      const auditLog = log as AuditLog;
      return (
        <>
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(auditLog.status)}`}>
            {auditLog.status}
          </span>
          {auditLog.actor_role && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
              {auditLog.actor_role}
            </span>
          )}
        </>
      );
    } else {
      const sysLog = log as SystemLog;
      return (
        <>
          <span className={`px-2 py-1 text-xs font-medium rounded ${getCategoryColor(sysLog.category)}`}>
            {sysLog.category}
          </span>
          {sysLog.execution_time_ms && (
            <span className="px-2 py-1 text-xs font-medium rounded bg-slate-100 text-slate-700">
              {sysLog.execution_time_ms}ms
            </span>
          )}
        </>
      );
    }
  };

  const getMainText = () => {
    if (isAuditLog) {
      const auditLog = log as AuditLog;
      return (
        <>
          {auditLog.profiles?.full_name || 'Unknown User'}
          <span className="text-slate-500 font-normal"> • {auditLog.resource_type}</span>
        </>
      );
    } else {
      const sysLog = log as SystemLog;
      return sysLog.message;
    }
  };

  const getTimestamp = () => {
    if (isAuditLog) {
      return new Date((log as AuditLog).created_at).toLocaleString();
    } else {
      return new Date((log as SystemLog).timestamp).toLocaleString();
    }
  };

  const getSecondaryInfo = () => {
    const profile = log.profiles;
    const ipAddress = log.ip_address;

    return (
      <>
        {profile && <span>• {profile.full_name}</span>}
        {ipAddress && <span className="ml-2">• {ipAddress}</span>}
      </>
    );
  };

  const showWarningIcon = () => {
    if (isAuditLog) {
      return (log as AuditLog).error_message;
    } else {
      const sysLog = log as SystemLog;
      return sysLog.level === 'ERROR' || sysLog.level === 'CRITICAL';
    }
  };

  return (
    <div className="border-b border-slate-200 hover:bg-slate-50 transition">
      <button
        onClick={() => hasExpandableContent && setIsExpanded(!isExpanded)}
        className={`w-full px-6 py-4 text-left ${hasExpandableContent ? 'cursor-pointer' : 'cursor-default'}`}
        disabled={!hasExpandableContent}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center flex-1 min-w-0">
            {hasExpandableContent ? (
              isExpanded ? (
                <ChevronDown size={20} className="text-slate-400 mr-3 flex-shrink-0" />
              ) : (
                <ChevronRight size={20} className="text-slate-400 mr-3 flex-shrink-0" />
              )
            ) : (
              <div className="w-8 mr-3 flex-shrink-0" />
            )}

            <div className="flex items-center flex-wrap gap-2 mr-4 flex-shrink-0">
              {getPrimaryBadge()}
              {getSecondaryBadges()}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">
                {getMainText()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {getTimestamp()}
                {getSecondaryInfo()}
              </div>
            </div>
          </div>

          {showWarningIcon() && (
            isAuditLog ? (
              <AlertCircle size={18} className="text-red-600 ml-2 flex-shrink-0" />
            ) : (
              <AlertTriangle size={18} className="text-red-600 ml-2 flex-shrink-0" />
            )
          )}
        </div>
      </button>

      {isExpanded && hasExpandableContent && (
        <div className="px-6 pb-4">
          <div className="pl-8 space-y-3">
            {isAuditLog && (log as AuditLog).profiles && (
              <div className="text-xs text-slate-600">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-medium">Email:</span> {(log as AuditLog).profiles?.email || 'N/A'}
                  </div>
                </div>
              </div>
            )}

            {isAuditLog && (log as AuditLog).error_message && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                <span className="font-medium">Error:</span> {(log as AuditLog).error_message}
              </div>
            )}

            {isAuditLog ? renderAuditDetails(log as AuditLog) : renderSystemDetails(log as SystemLog)}
          </div>
        </div>
      )}
    </div>
  );
}
