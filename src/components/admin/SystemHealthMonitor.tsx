import { useState, useEffect } from 'react';
import { Activity, Database, Users, FileText, HardDrive, AlertTriangle, RefreshCw } from 'lucide-react';
import { getSystemHealthSnapshot, type SystemHealth } from '../../lib/adminService';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';

export default function SystemHealthMonitor() {
  const { user } = useAuth();
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadHealth = async () => {
    if (!user) return;

    try {
      setError(null);
      const data = await getSystemHealthSnapshot(user.id);
      setHealth(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHealth();
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHealth();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorAlert message={error} onRetry={loadHealth} />;
  }

  if (!health) {
    return <ErrorAlert message="No health data available" />;
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getHealthStatus = () => {
    const errorRate = health.system.error_rate_24h_percent;
    const criticalErrors = health.system.critical_errors_24h;

    if (criticalErrors > 10 || errorRate > 5) {
      return { color: 'text-red-600 dark:text-red-400', label: 'Critical', icon: AlertTriangle };
    } else if (criticalErrors > 5 || errorRate > 2) {
      return { color: 'text-yellow-600 dark:text-yellow-400', label: 'Warning', icon: AlertTriangle };
    } else {
      return { color: 'text-green-600 dark:text-green-400', label: 'Healthy', icon: Activity };
    }
  };

  const status = getHealthStatus();
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${status.color} bg-opacity-10`}>
            <StatusIcon className={`w-6 h-6 ${status.color}`} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">System Health</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {new Date(health.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status Badge */}
      <div className={`p-4 rounded-lg border-2 ${
        status.label === 'Critical' ? 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700' :
        status.label === 'Warning' ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700' :
        'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700'
      }`}>
        <p className={`text-lg font-semibold ${status.color}`}>
          System Status: {status.label}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {status.label === 'Critical' && 'Immediate attention required. Multiple critical errors detected.'}
          {status.label === 'Warning' && 'System is operational but requires monitoring.'}
          {status.label === 'Healthy' && 'All systems operating normally.'}
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Database */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Database className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Database</h3>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Size</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {health.database.size_gb.toFixed(2)} GB
              </p>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatBytes(health.database.size_bytes)}
            </div>
          </div>
        </div>

        {/* Users */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Users</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{health.users.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Active (24h)</span>
              <span className="text-sm font-medium text-green-600 dark:text-green-400">{health.users.active_24h}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Suspended</span>
              <span className="text-sm font-medium text-red-600 dark:text-red-400">{health.users.suspended}</span>
            </div>
          </div>
        </div>

        {/* Businesses */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Businesses</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{health.businesses.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Suspended</span>
              <span className="text-sm font-medium text-red-600 dark:text-red-400">{health.businesses.suspended}</span>
            </div>
          </div>
        </div>

        {/* Receipts */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Receipts</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{health.receipts.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Pending</span>
              <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">{health.receipts.pending_extraction}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Failed</span>
              <span className="text-sm font-medium text-red-600 dark:text-red-400">{health.receipts.failed_extraction}</span>
            </div>
          </div>
        </div>

        {/* Storage */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <HardDrive className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Storage</h3>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Used</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {health.storage.total_gb.toFixed(2)} GB
              </p>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatBytes(health.storage.total_bytes)}
            </div>
          </div>
        </div>

        {/* System Errors */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-lg ${
              health.system.critical_errors_24h > 10 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <AlertTriangle className={`w-5 h-5 ${
                health.system.critical_errors_24h > 10 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
              }`} />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Errors (24h)</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Error Rate</span>
              <span className={`text-sm font-medium ${
                health.system.error_rate_24h_percent > 5 ? 'text-red-600 dark:text-red-400' :
                health.system.error_rate_24h_percent > 2 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-green-600 dark:text-green-400'
              }`}>
                {health.system.error_rate_24h_percent.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Critical</span>
              <span className="text-sm font-medium text-red-600 dark:text-red-400">{health.system.critical_errors_24h}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Total Logs</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{health.system.total_logs_24h}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
