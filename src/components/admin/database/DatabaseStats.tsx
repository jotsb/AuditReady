import { useState, useEffect } from 'react';
import {
  Database, HardDrive, Gauge, Zap, Users, Clock,
  RefreshCw, BarChart3, Table2, Layers, TrendingUp
} from 'lucide-react';
import { getDatabaseStats, getTableInfo, type DatabaseStats as StatsType, type TableInfo } from '../../../lib/dbManagementService';
import { LoadingSpinner } from '../../shared/LoadingSpinner';

export default function DatabaseStats() {
  const [stats, setStats] = useState<StatsType | null>(null);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setError(null);
      const [s, t] = await Promise.all([getDatabaseStats(), getTableInfo()]);
      setStats(s);
      setTables(t);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  if (loading) {
    return <div className="flex justify-center items-center p-12"><LoadingSpinner size="lg" /></div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  const topTables = [...tables].sort((a, b) => b.size_bytes - a.size_bytes).slice(0, 8);
  const maxTableSize = topTables[0]?.size_bytes || 1;
  const uptimeStr = formatUptime(stats.uptime);
  const connectionPercent = Math.round((stats.total_connections / stats.max_connections) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Database Statistics</h3>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<HardDrive className="w-5 h-5" />}
          label="Database Size"
          value={stats.database_size}
          color="blue"
        />
        <StatCard
          icon={<Table2 className="w-5 h-5" />}
          label="Tables"
          value={stats.table_count.toString()}
          sublabel={`${stats.index_count} indexes`}
          color="green"
        />
        <StatCard
          icon={<BarChart3 className="w-5 h-5" />}
          label="Total Rows"
          value={stats.total_rows_estimate.toLocaleString()}
          sublabel={`${stats.dead_tuples.toLocaleString()} dead tuples`}
          color="amber"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Uptime"
          value={uptimeStr}
          color="teal"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-blue-500" />
            Performance
          </h4>
          <div className="space-y-4">
            <PerformanceGauge
              label="Cache Hit Ratio"
              value={stats.cache_hit_ratio}
              target={99}
              description="Higher is better. Below 95% indicates need for more memory."
            />
            <PerformanceGauge
              label="Index Hit Ratio"
              value={stats.index_hit_ratio}
              target={99}
              description="Higher is better. Low ratio means missing indexes."
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            Connections
          </h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Active</span>
              <span className="text-sm font-semibold text-green-600 dark:text-green-400">{stats.active_connections}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Idle</span>
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">{stats.idle_connections}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Total / Max</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.total_connections} / {stats.max_connections}
              </span>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">Connection Usage</span>
                <span className="text-xs font-medium text-gray-900 dark:text-white">{connectionPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    connectionPercent > 80 ? 'bg-red-500' : connectionPercent > 60 ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${connectionPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          Largest Tables
        </h4>
        <div className="space-y-3">
          {topTables.map((table) => {
            const pct = (table.size_bytes / maxTableSize) * 100;
            return (
              <div key={table.table_name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-mono text-gray-700 dark:text-gray-300">{table.table_name}</span>
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>{table.row_estimate.toLocaleString()} rows</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{table.size_pretty}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-500" />
          Server Info
        </h4>
        <pre className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-900/50 p-3 rounded overflow-x-auto">
          {stats.postgres_version}
        </pre>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sublabel,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className={`inline-flex p-2 rounded-lg ${colorMap[color]} mb-3`}>
        {icon}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sublabel && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sublabel}</p>}
    </div>
  );
}

function PerformanceGauge({
  label,
  value,
  target,
  description,
}: {
  label: string;
  value: number;
  target: number;
  description: string;
}) {
  const isGood = value >= target - 2;
  const isWarning = value >= target - 5 && value < target - 2;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
        <span className={`text-sm font-bold ${
          isGood ? 'text-green-600 dark:text-green-400' :
          isWarning ? 'text-amber-600 dark:text-amber-400' :
          'text-red-600 dark:text-red-400'
        }`}>
          {value}%
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${
            isGood ? 'bg-green-500' : isWarning ? 'bg-amber-500' : 'bg-red-500'
          }`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{description}</p>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
