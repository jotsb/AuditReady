import { useState, useEffect } from 'react';
import {
  Download, Trash2, RefreshCw, Archive, Clock, CheckCircle,
  XCircle, Loader, AlertCircle, HardDrive, Plus, RotateCcw, Upload, Shield
} from 'lucide-react';
import {
  getBackups, createBackup, downloadBackup, deleteBackup, getTableInfo,
  type BackupRecord, type TableInfo
} from '../../../lib/dbManagementService';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import RestoreModal from './RestoreModal';

export default function BackupManager() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupRecord | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showUploadRestore, setShowUploadRestore] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [b, t] = await Promise.all([getBackups(), getTableInfo()]);
      setBackups(b);
      setTables(t);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (backup: BackupRecord) => {
    try {
      const blob = await downloadBackup(backup.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${backup.name.replace(/\s+/g, '_')}_${new Date(backup.created_at).toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup? This cannot be undone.')) return;
    try {
      await deleteBackup(backupId);
      setBackups(backups.filter(b => b.id !== backupId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center p-12"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Database Backups</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create logical backups of your database tables as JSON exports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => setShowUploadRestore(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition"
          >
            <Upload className="w-4 h-4" />
            Upload & Restore
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            Create Backup
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {backups.length} backup{backups.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
            <Archive className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" />
            <p className="font-medium">No backups yet</p>
            <p className="text-sm mt-1">Create your first backup to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {backups.map((backup) => (
              <BackupRow
                key={backup.id}
                backup={backup}
                onDownload={() => handleDownload(backup)}
                onDelete={() => handleDelete(backup.id)}
                onRestore={() => {
                  setRestoreTarget(backup);
                  setShowRestoreModal(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateBackupModal
          tables={tables}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            loadData();
          }}
        />
      )}

      {showRestoreModal && restoreTarget && (
        <RestoreModal
          backup={restoreTarget}
          onClose={() => {
            setShowRestoreModal(false);
            setRestoreTarget(null);
          }}
          onRestored={loadData}
        />
      )}

      {showUploadRestore && (
        <RestoreModal
          backup={null}
          onClose={() => setShowUploadRestore(false)}
          onRestored={loadData}
        />
      )}
    </div>
  );
}

function BackupRow({
  backup,
  onDownload,
  onDelete,
  onRestore,
}: {
  backup: BackupRecord;
  onDownload: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const statusConfig = {
    completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
    completed_with_errors: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
    failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
    in_progress: { icon: Loader, color: 'text-blue-500 animate-spin', bg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
    pending: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300' },
  };

  const typeConfig: Record<string, { label: string; bg: string }> = {
    manual: { label: 'manual', bg: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
    scheduled: { label: 'scheduled', bg: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
    pre_migration: { label: 'pre-migration', bg: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400' },
    restore: { label: 'restore', bg: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300' },
    pre_restore: { label: 'safety snapshot', bg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  };

  const config = statusConfig[backup.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = config.icon;
  const typeInfo = typeConfig[backup.backup_type] || typeConfig.manual;

  const isRestorable = backup.status === 'completed'
    && backup.backup_type !== 'restore';

  return (
    <div className="px-4 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
      <div className={`p-2 rounded-lg ${backup.backup_type === 'pre_restore' ? 'bg-amber-100 dark:bg-amber-900/30' : backup.backup_type === 'restore' ? 'bg-teal-100 dark:bg-teal-900/30' : config.bg.split(' ')[0] + ' dark:' + config.bg.split(' ')[1]}`}>
        {backup.backup_type === 'pre_restore' ? (
          <Shield className="w-5 h-5 text-amber-500" />
        ) : backup.backup_type === 'restore' ? (
          <RotateCcw className="w-5 h-5 text-teal-500" />
        ) : (
          <StatusIcon className={`w-5 h-5 ${config.color}`} />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-gray-900 dark:text-white">{backup.name}</span>
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${config.bg}`}>
            {backup.status}
          </span>
          <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${typeInfo.bg}`}>
            {typeInfo.label}
          </span>
          {backup.restore_strategy && (
            <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {backup.restore_strategy}
            </span>
          )}
        </div>
        {backup.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{backup.description}</p>
        )}
        <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(backup.created_at).toLocaleString()}
          </span>
          {backup.size_bytes > 0 && (
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {formatBytes(backup.size_bytes)}
            </span>
          )}
          <span>{backup.tables_included.length} tables</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {isRestorable && (
          <button
            onClick={onRestore}
            className="p-2 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Restore from this backup"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        {backup.status === 'completed' && (
          <button
            onClick={onDownload}
            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Download backup"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          title="Delete backup"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function CreateBackupModal({
  tables,
  onClose,
  onCreated,
}: {
  tables: TableInfo[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(`Backup ${new Date().toLocaleDateString()}`);
  const [description, setDescription] = useState('');
  const LOG_TABLES = new Set(['system_logs', 'audit_logs', 'audit_logs_summary', 'log_level_config', 'rate_limit_attempts', 'failed_login_attempts', 'account_lockouts']);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set(tables.filter(t => !LOG_TABLES.has(t.table_name)).map(t => t.table_name)));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTable = (tableName: string) => {
    const next = new Set(selectedTables);
    if (next.has(tableName)) {
      next.delete(tableName);
    } else {
      next.add(tableName);
    }
    setSelectedTables(next);
  };

  const selectAll = () => setSelectedTables(new Set(tables.map(t => t.table_name)));
  const selectNone = () => setSelectedTables(new Set());

  const handleCreate = async () => {
    if (!name.trim()) return;
    if (selectedTables.size === 0) {
      setError('Select at least one table');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      await createBackup(name, description, Array.from(selectedTables));
      onCreated();
    } catch (err: any) {
      setError(err.message);
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Database Backup</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Export selected tables as a JSON backup file
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Backup Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Tables ({selectedTables.size}/{tables.length})
              </label>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                  Select All
                </button>
                <button onClick={selectNone} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">
                  Clear
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg divide-y divide-gray-100 dark:divide-gray-700/50">
              {tables.map((table) => (
                <label
                  key={table.table_name}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTables.has(table.table_name)}
                      onChange={() => toggleTable(table.table_name)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-mono text-gray-900 dark:text-white">{table.table_name}</span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {table.row_estimate.toLocaleString()} rows
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={creating}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim() || selectedTables.size === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {creating ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Archive className="w-4 h-4" />
                Create Backup
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
