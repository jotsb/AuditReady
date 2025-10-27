import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Clock, User, Mail, Code, FileText, Zap, Database } from 'lucide-react';

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
  category: 'AUTH' | 'DATABASE' | 'API' | 'EDGE_FUNCTION' | 'CLIENT_ERROR' | 'SECURITY' | 'PERFORMANCE' | 'USER_ACTION' | 'PAGE_VIEW' | 'NAVIGATION';
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

export function SplunkLogEntry({ log }: LogEntryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isAuditLog = log.type === 'audit';
  const isSystemLog = log.type === 'system';

  // Calculate differences between before and after snapshots
  const differences = useMemo(() => {
    if (!isAuditLog) return new Set<string>();
    const auditLog = log as AuditLog;
    if (!auditLog.snapshot_before || !auditLog.snapshot_after) return new Set<string>();

    const diffs = new Set<string>();
    const before = auditLog.snapshot_before;
    const after = auditLog.snapshot_after;

    // Compare all keys from both objects
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    allKeys.forEach(key => {
      const beforeValue = JSON.stringify(before[key]);
      const afterValue = JSON.stringify(after[key]);
      if (beforeValue !== afterValue) {
        diffs.add(key);
      }
    });

    return diffs;
  }, [log, isAuditLog]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'DEBUG': return 'text-slate-500 dark:text-gray-400';
      case 'INFO': return 'text-blue-600 dark:text-blue-400';
      case 'WARN': return 'text-yellow-600 dark:text-yellow-400';
      case 'ERROR': return 'text-red-600 dark:text-red-400';
      case 'CRITICAL': return 'text-purple-600 dark:text-purple-400';
      default: return 'text-slate-600 dark:text-gray-400';
    }
  };

  const getLevelBg = (level: string) => {
    switch (level) {
      case 'DEBUG': return 'bg-slate-100 dark:bg-gray-700';
      case 'INFO': return 'bg-blue-50 dark:bg-blue-900/20';
      case 'WARN': return 'bg-yellow-50 dark:bg-yellow-900/20';
      case 'ERROR': return 'bg-red-50 dark:bg-red-900/20';
      case 'CRITICAL': return 'bg-purple-50 dark:bg-purple-900/20';
      default: return 'bg-slate-50 dark:bg-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600 dark:text-green-400';
      case 'failure': return 'text-red-600 dark:text-red-400';
      case 'denied': return 'text-orange-600 dark:text-orange-400';
      default: return 'text-slate-600 dark:text-gray-400';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'AUTH': return 'text-green-700 dark:text-green-400';
      case 'DATABASE': return 'text-blue-700 dark:text-blue-400';
      case 'API': return 'text-cyan-700 dark:text-cyan-400';
      case 'EDGE_FUNCTION': return 'text-indigo-700 dark:text-indigo-400';
      case 'CLIENT_ERROR': return 'text-red-700 dark:text-red-400';
      case 'SECURITY': return 'text-orange-700 dark:text-orange-400';
      case 'PERFORMANCE': return 'text-yellow-700 dark:text-yellow-400';
      case 'USER_ACTION': return 'text-purple-700 dark:text-purple-400';
      case 'PAGE_VIEW': return 'text-teal-700 dark:text-teal-400';
      case 'NAVIGATION': return 'text-pink-700 dark:text-pink-400';
      default: return 'text-slate-700 dark:text-gray-400';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Render JSON with highlighted differences
  const renderHighlightedJSON = (obj: any, type: 'before' | 'after') => {
    if (!obj) return null;

    const lines: JSX.Element[] = [];
    const jsonString = JSON.stringify(obj, null, 2);
    const jsonLines = jsonString.split('\n');

    jsonLines.forEach((line, index) => {
      // Extract the key name from the line
      const keyMatch = line.match(/"([^"]+)":/);
      const key = keyMatch ? keyMatch[1] : null;
      const isDifferent = key && differences.has(key);

      lines.push(
        <div
          key={index}
          className={`${
            isDifferent
              ? type === 'before'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 font-semibold'
                : 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-200 font-semibold'
              : ''
          }`}
        >
          {line}
        </div>
      );
    });

    return <>{lines}</>;
  };

  const renderSystemLogRow = (systemLog: SystemLog) => {
    const metadata = systemLog.metadata || {};
    const pageName = metadata.page || metadata.pageName || '-';
    const process = metadata.process || systemLog.category;
    const functionName = metadata.function || metadata.functionName || '-';

    return (
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-700/50 transition-colors border-b border-slate-200 dark:border-gray-700 ${
          isExpanded ? getLevelBg(systemLog.level) : ''
        }`}
      >
        {/* Collapsed Row - Desktop */}
        <div className="hidden lg:grid lg:grid-cols-[auto_minmax(140px,1fr)_auto_minmax(120px,1fr)_minmax(200px,2fr)_minmax(120px,1fr)_auto] gap-2 px-4 py-2.5 items-center text-sm">
          {/* Expand Icon */}
          <div className="flex items-center justify-center w-6">
            {isExpanded ? (
              <ChevronDown size={16} className="text-slate-500 dark:text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight size={16} className="text-slate-500 dark:text-gray-400 flex-shrink-0" />
            )}
          </div>

          {/* Timestamp */}
          <div className="text-slate-600 dark:text-gray-400 font-mono text-xs whitespace-nowrap overflow-hidden text-ellipsis">
            {formatTimestamp(systemLog.timestamp)}
          </div>

          {/* Level */}
          <div className="flex items-center min-w-[60px]">
            <span className={`font-semibold text-xs whitespace-nowrap ${getLevelColor(systemLog.level)}`}>
              {systemLog.level}
            </span>
          </div>

          {/* Category */}
          <div className="flex items-center min-w-[100px]">
            <span className={`text-xs font-medium whitespace-nowrap ${getCategoryColor(systemLog.category)}`}>
              {systemLog.category}
            </span>
          </div>

          {/* Message */}
          <div className="text-slate-700 dark:text-gray-300 overflow-hidden text-ellipsis whitespace-nowrap">
            {systemLog.message}
          </div>

          {/* User */}
          <div className="text-slate-600 dark:text-gray-400 text-xs overflow-hidden text-ellipsis whitespace-nowrap">
            {systemLog.profiles?.email || 'System'}
          </div>

          {/* IP Address */}
          <div className="text-slate-500 dark:text-gray-500 text-xs font-mono whitespace-nowrap min-w-[60px]">
            {systemLog.ip_address?.split('.').slice(0, 2).join('.') || '-'}
          </div>
        </div>

        {/* Collapsed Row - Mobile/Tablet */}
        <div className="lg:hidden px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              {isExpanded ? (
                <ChevronDown size={14} className="text-slate-500 dark:text-gray-400 mt-0.5" />
              ) : (
                <ChevronRight size={14} className="text-slate-500 dark:text-gray-400 mt-0.5" />
              )}
              <span className={`font-semibold text-xs ${getLevelColor(systemLog.level)}`}>
                {systemLog.level}
              </span>
              <span className={`text-[10px] font-medium ${getCategoryColor(systemLog.category)}`}>
                {systemLog.category}
              </span>
            </div>
            <div className="text-slate-600 dark:text-gray-400 font-mono text-[10px] whitespace-nowrap">
              {formatTimestamp(systemLog.timestamp).split(',')[0]}
            </div>
          </div>
          <div className="text-sm text-slate-700 dark:text-gray-300 break-words">
            {systemLog.message}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-gray-400">
            <span className="truncate">{systemLog.profiles?.email || 'System'}</span>
            {systemLog.execution_time_ms && (
              <span className="text-slate-500 dark:text-gray-500 ml-2 flex-shrink-0">{systemLog.execution_time_ms}ms</span>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 bg-white dark:bg-gray-800 border-t border-slate-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              {/* Left Column */}
              <div className="space-y-2">
                <div className="flex items-start">
                  <FileText size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">Page Name</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300 font-mono break-all">{pageName}</div>
                  </div>
                </div>

                <div className="flex items-start">
                  <Database size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">Process</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300 break-all">{process}</div>
                  </div>
                </div>

                <div className="flex items-start">
                  <Code size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">Function Name</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300 font-mono break-all">{functionName}</div>
                  </div>
                </div>

                <div className="flex items-start">
                  <FileText size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">File Name</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300 font-mono break-all">
                      {metadata.fileName || metadata.file || '-'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start">
                  <User size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">User Email</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300 break-all">
                      {systemLog.profiles?.email || 'System'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start">
                  <Mail size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">Email Address</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300 break-all">
                      {systemLog.profiles?.email || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-2">
                <div className="flex items-start">
                  <Clock size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">Duration</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300">
                      {systemLog.execution_time_ms ? `${systemLog.execution_time_ms}ms` : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start">
                  <Zap size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">Session ID</div>
                    <div className="text-xs text-slate-600 dark:text-gray-400 font-mono break-all">
                      {systemLog.metadata?.sessionId || '-'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start">
                  <Database size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">IP Address</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300 font-mono break-all">
                      {systemLog.ip_address || '-'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Parameters */}
            {metadata.parameters && (
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase mb-1">Parameters</div>
                <pre className="text-xs bg-slate-100 dark:bg-gray-900 p-2 rounded overflow-x-auto text-slate-700 dark:text-gray-300 font-mono">
                  {JSON.stringify(metadata.parameters, null, 2)}
                </pre>
              </div>
            )}

            {/* Request */}
            {metadata.request && (
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase mb-1">Request Sent</div>
                <pre className="text-xs bg-slate-100 dark:bg-gray-900 p-2 rounded overflow-x-auto text-slate-700 dark:text-gray-300 font-mono">
                  {JSON.stringify(metadata.request, null, 2)}
                </pre>
              </div>
            )}

            {/* Response */}
            {metadata.response && (
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase mb-1">Response Received</div>
                <pre className="text-xs bg-slate-100 dark:bg-gray-900 p-2 rounded overflow-x-auto text-slate-700 dark:text-gray-300 font-mono">
                  {JSON.stringify(metadata.response, null, 2)}
                </pre>
              </div>
            )}

            {/* Full Metadata */}
            {metadata && Object.keys(metadata).length > 0 && (
              <div>
                <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase mb-1">Full Metadata</div>
                <pre className="text-xs bg-slate-100 dark:bg-gray-900 p-2 rounded overflow-x-auto text-slate-700 dark:text-gray-300 font-mono max-h-64">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
              </div>
            )}

            {/* Stack Trace */}
            {systemLog.stack_trace && (
              <div>
                <div className="text-xs font-medium text-red-600 dark:text-red-400 uppercase mb-1">Stack Trace</div>
                <pre className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded overflow-x-auto text-red-700 dark:text-red-300 font-mono max-h-64">
                  {systemLog.stack_trace}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderAuditLogRow = (auditLog: AuditLog) => {
    return (
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className={`cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-700/50 transition-colors border-b border-slate-200 dark:border-gray-700 ${
          isExpanded ? 'bg-slate-50 dark:bg-gray-800' : ''
        }`}
      >
        {/* Collapsed Row - Desktop */}
        <div className="hidden lg:grid lg:grid-cols-[auto_minmax(140px,1fr)_auto_minmax(120px,1fr)_minmax(100px,1fr)_minmax(120px,1.5fr)_auto] gap-2 px-4 py-2.5 items-center text-sm">
          {/* Expand Icon */}
          <div className="flex items-center justify-center w-6">
            {isExpanded ? (
              <ChevronDown size={16} className="text-slate-500 dark:text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight size={16} className="text-slate-500 dark:text-gray-400 flex-shrink-0" />
            )}
          </div>

          {/* Timestamp */}
          <div className="text-slate-600 dark:text-gray-400 font-mono text-xs whitespace-nowrap overflow-hidden text-ellipsis">
            {formatTimestamp(auditLog.created_at)}
          </div>

          {/* Status */}
          <div className="flex items-center min-w-[70px]">
            <span className={`font-semibold uppercase text-xs whitespace-nowrap ${getStatusColor(auditLog.status)}`}>
              {auditLog.status}
            </span>
          </div>

          {/* Action */}
          <div className="font-medium text-slate-700 dark:text-gray-300 text-xs overflow-hidden text-ellipsis whitespace-nowrap">
            {auditLog.action.replace(/_/g, ' ').toUpperCase()}
          </div>

          {/* Resource Type */}
          <div className="text-slate-600 dark:text-gray-400 text-xs overflow-hidden text-ellipsis whitespace-nowrap">
            {auditLog.resource_type}
          </div>

          {/* User */}
          <div className="text-slate-600 dark:text-gray-400 text-xs overflow-hidden text-ellipsis whitespace-nowrap">
            {auditLog.profiles?.email || 'System'}
          </div>

          {/* IP */}
          <div className="text-slate-500 dark:text-gray-500 text-xs font-mono whitespace-nowrap min-w-[60px]">
            {auditLog.ip_address?.split('.').slice(0, 2).join('.') || '-'}
          </div>
        </div>

        {/* Collapsed Row - Mobile/Tablet */}
        <div className="lg:hidden px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-shrink-0">
              {isExpanded ? (
                <ChevronDown size={14} className="text-slate-500 dark:text-gray-400 mt-0.5" />
              ) : (
                <ChevronRight size={14} className="text-slate-500 dark:text-gray-400 mt-0.5" />
              )}
              <span className={`font-semibold uppercase text-xs ${getStatusColor(auditLog.status)}`}>
                {auditLog.status}
              </span>
            </div>
            <div className="text-slate-600 dark:text-gray-400 font-mono text-[10px] whitespace-nowrap">
              {formatTimestamp(auditLog.created_at).split(',')[0]}
            </div>
          </div>
          <div className="text-sm font-medium text-slate-700 dark:text-gray-300">
            {auditLog.action.replace(/_/g, ' ').toUpperCase()}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-gray-400">
            <span className="truncate">{auditLog.resource_type}</span>
            <span className="truncate ml-2">{auditLog.profiles?.email || 'System'}</span>
          </div>
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-3 bg-white dark:bg-gray-800 border-t border-slate-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
              {/* Left Column */}
              <div className="space-y-2">
                <div className="flex items-start">
                  <User size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">User Email</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300 break-all">
                      {auditLog.profiles?.email || 'System'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start">
                  <Mail size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">Email Address</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300 break-all">
                      {auditLog.profiles?.email || '-'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start">
                  <Database size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">Role</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300 break-all">
                      {auditLog.actor_role || '-'}
                    </div>
                  </div>
                </div>

                <div className="flex items-start">
                  <Database size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">IP Address</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300 font-mono break-all">
                      {auditLog.ip_address || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-2">
                <div className="flex items-start">
                  <FileText size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">Action</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300 break-all">
                      {auditLog.action}
                    </div>
                  </div>
                </div>

                <div className="flex items-start">
                  <Database size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">Resource Type</div>
                    <div className="text-sm text-slate-700 dark:text-gray-300 break-all">
                      {auditLog.resource_type}
                    </div>
                  </div>
                </div>

                <div className="flex items-start">
                  <Zap size={16} className="mr-2 mt-0.5 text-slate-500 dark:text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-500 dark:text-gray-500 uppercase">Status</div>
                    <div className={`text-sm font-semibold break-all ${getStatusColor(auditLog.status)}`}>
                      {auditLog.status.toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {auditLog.error_message && (
              <div>
                <div className="text-xs font-medium text-red-600 dark:text-red-400 uppercase mb-1">Error Message</div>
                <pre className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded text-red-700 dark:text-red-300 break-words whitespace-pre-wrap">
                  {auditLog.error_message}
                </pre>
              </div>
            )}

            {/* Before/After Comparison */}
            {(auditLog.snapshot_before || auditLog.snapshot_after) && (
              <div className="mt-2 border-t border-slate-200 dark:border-gray-700 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-semibold text-slate-700 dark:text-gray-300">Data Changes</div>
                  {differences.size > 0 && (
                    <div className="flex items-center gap-3 text-xs">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded"></div>
                        <span className="text-slate-600 dark:text-gray-400">Changed</span>
                      </div>
                      <span className="text-slate-400 dark:text-gray-600">|</span>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded"></div>
                        <span className="text-slate-600 dark:text-gray-400">New Value</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="border border-slate-300 dark:border-gray-600 rounded-lg overflow-hidden">
                  {/* Header */}
                  <div className="grid grid-cols-2 bg-slate-100 dark:bg-gray-700 border-b border-slate-300 dark:border-gray-600">
                    <div className="px-3 py-2 text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase border-r border-slate-300 dark:border-gray-600 flex items-center">
                      <span className="mr-2">◀</span> Before
                    </div>
                    <div className="px-3 py-2 text-xs font-semibold text-green-600 dark:text-green-400 uppercase flex items-center">
                      <span className="mr-2">▶</span> After
                    </div>
                  </div>

                  {/* Content - Single Scrollable View */}
                  <div className="grid grid-cols-1 md:grid-cols-2 max-h-96 overflow-y-auto bg-white dark:bg-gray-800">
                    {/* Before Column */}
                    <div className="border-r border-slate-300 dark:border-gray-600 bg-orange-50/20 dark:bg-orange-900/5">
                      {auditLog.snapshot_before ? (
                        <pre className="text-xs p-3 text-slate-700 dark:text-gray-300 font-mono">
                          {renderHighlightedJSON(auditLog.snapshot_before, 'before')}
                        </pre>
                      ) : (
                        <div className="p-3 text-xs text-slate-500 dark:text-gray-500 italic">
                          No data
                        </div>
                      )}
                    </div>

                    {/* After Column */}
                    <div className="bg-green-50/20 dark:bg-green-900/5">
                      {auditLog.snapshot_after ? (
                        <pre className="text-xs p-3 text-slate-700 dark:text-gray-300 font-mono">
                          {renderHighlightedJSON(auditLog.snapshot_after, 'after')}
                        </pre>
                      ) : (
                        <div className="p-3 text-xs text-slate-500 dark:text-gray-500 italic">
                          No data
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return isSystemLog ? renderSystemLogRow(log as SystemLog) : renderAuditLogRow(log as AuditLog);
}
