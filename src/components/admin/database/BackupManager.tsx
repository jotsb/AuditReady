import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Download, Trash2, RefreshCw, Archive, Clock, CheckCircle,
  XCircle, Loader, AlertCircle, HardDrive, Plus, RotateCcw, Upload, Shield, AlertTriangle
} from 'lucide-react';
import {
  getBackups, createBackup, downloadBackup, deleteBackup, getTableInfo,
  isBackupStale, isBackupActive,
  type BackupRecord, type TableInfo, type BackupProgress
} from '../../../lib/dbManagementService';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import RestoreModal from './RestoreModal';

const BACKUP_LIMIT = 25;
const POLL_INTERVAL_MS = 4000;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatElapsed(startedAt: string | null): string {
  if (!startedAt) return '';
  const seconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning';
  message: string;
}

export default function BackupManager() {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<BackupRecord | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showUploadRestore, setShowUploadRestore] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  }, []);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const [b, t] = await Promise.all([getBackups(), getTableInfo()]);
      setBackups(b);
      setTables(t);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  }, []);

  const pollBackups = useCallback(async () => {
    try {
      const b = await getBackups();

      for (const backup of b) {
        const prevStatus = prevStatusRef.current.get(backup.id);
        if (prevStatus && (prevStatus === 'in_progress' || prevStatus === 'pending')) {
          if (backup.status === 'completed') {
            addToast('success', `Backup "${backup.name}" completed successfully`);
          } else if (backup.status === 'completed_with_errors') {
            addToast('warning', `Backup "${backup.name}" completed with some table errors`);
          } else if (backup.status === 'failed') {
            addToast('error', `Backup "${backup.name}" failed: ${backup.error_message || 'Unknown error'}`);
          }
        }
      }

      prevStatusRef.current = new Map(b.map(bk => [bk.id, bk.status]));
      setBackups(b);
    } catch {
      // Silently fail polling
    }
  }, [addToast]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    };
    init();
  }, [loadData]);

  useEffect(() => {
    if (backups.length > 0 && !prevStatusRef.current.size) {
      prevStatusRef.current = new Map(backups.map(b => [b.id, b.status]));
    }
  }, [backups]);

  useEffect(() => {
    const hasActive = backups.some(b => isBackupActive(b));

    if (hasActive && !pollRef.current) {
      pollRef.current = setInterval(pollBackups, POLL_INTERVAL_MS);
    } else if (!hasActive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [backups, pollBackups]);

  const handleDownload = async (backup: BackupRecord) => {
    try {
      const blob = await downloadBackup(backup.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = backup.storage_path?.endsWith('.zip') ? '.zip' : '.json';
      a.download = `${backup.name.replace(/\s+/g, '_')}_${new Date(backup.created_at).toISOString().split('T')[0]}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup? This cannot be undone.')) return;
    try {
      await deleteBackup(backupId);
      setBackups(prev => prev.filter(b => b.id !== backupId));
      prevStatusRef.current.delete(backupId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateBackup = async (name: string, description: string, selectedTables: string[]) => {
    try {
      await createBackup(name, description, selectedTables);
      addToast('success', `Backup "${name}" started - processing in background`);
      setShowCreateModal(false);
      await loadData();
    } catch (err: unknown) {
      throw err;
    }
  };

  const completedCount = backups.filter(b => b.status !== 'in_progress' && b.status !== 'pending').length;

  if (loading) {
    return <div className="flex justify-center items-center p-12"><LoadingSpinner size="lg" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastNotification key={toast.id} toast={toast} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Database Backups</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create logical backups of your database tables as compressed ZIP exports
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {backups.length} backup{backups.length !== 1 ? 's' : ''}
              </span>
            </div>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {completedCount} / {BACKUP_LIMIT} limit
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
          onSubmit={handleCreateBackup}
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

function ToastNotification({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const config = {
    success: { icon: CheckCircle, bg: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700', text: 'text-green-800 dark:text-green-200', iconColor: 'text-green-500' },
    error: { icon: XCircle, bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700', text: 'text-red-800 dark:text-red-200', iconColor: 'text-red-500' },
    warning: { icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700', text: 'text-amber-800 dark:text-amber-200', iconColor: 'text-amber-500' },
  }[toast.type];

  const Icon = config.icon;

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg max-w-sm animate-[slideIn_0.3s_ease-out] ${config.bg}`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
      <p className={`text-sm flex-1 ${config.text}`}>{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className={`flex-shrink-0 ${config.text} opacity-60 hover:opacity-100 transition`}
      >
        <XCircle className="w-4 h-4" />
      </button>
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
  const stale = isBackupStale(backup);

  const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
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

  const displayStatus = stale ? 'failed' : backup.status;
  const config = statusConfig[displayStatus] || statusConfig.pending;
  const StatusIcon = config.icon;
  const typeInfo = typeConfig[backup.backup_type] || typeConfig.manual;

  const isRestorable = (backup.status === 'completed' || backup.status === 'completed_with_errors')
    && backup.backup_type !== 'restore';

  const progress = backup.progress;
  const isActive = backup.status === 'in_progress' && !stale;

  return (
    <div className="px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-lg ${backup.backup_type === 'pre_restore' ? 'bg-amber-100 dark:bg-amber-900/30' : backup.backup_type === 'restore' ? 'bg-teal-100 dark:bg-teal-900/30' : stale ? 'bg-red-100 dark:bg-red-900/30' : config.bg.split(' ')[0] + ' dark:' + config.bg.split(' ')[1]}`}>
          {backup.backup_type === 'pre_restore' ? (
            <Shield className="w-5 h-5 text-amber-500" />
          ) : backup.backup_type === 'restore' ? (
            <RotateCcw className="w-5 h-5 text-teal-500" />
          ) : stale ? (
            <AlertTriangle className="w-5 h-5 text-red-500" />
          ) : (
            <StatusIcon className={`w-5 h-5 ${config.color}`} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-gray-900 dark:text-white">{backup.name}</span>
            {stale ? (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                stalled
              </span>
            ) : (
              <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${config.bg}`}>
                {backup.status}
              </span>
            )}
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${typeInfo.bg}`}>
              {typeInfo.label}
            </span>
            {backup.restore_strategy && (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                {backup.restore_strategy}
              </span>
            )}
          </div>

          {stale && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              Backup process stopped responding (last heartbeat: {backup.last_heartbeat_at ? new Date(backup.last_heartbeat_at).toLocaleTimeString() : 'never'})
            </p>
          )}
          {!stale && backup.status === 'failed' && backup.error_message && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5 truncate" title={backup.error_message}>
              {backup.error_message}
            </p>
          )}
          {!stale && backup.status !== 'failed' && backup.description && (
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
            {isActive && backup.started_at && (
              <span className="text-blue-500 dark:text-blue-400">
                {formatElapsed(backup.started_at)} elapsed
              </span>
            )}
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
          {(backup.status === 'completed' || backup.status === 'completed_with_errors') && (
            <button
              onClick={onDownload}
              className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Download backup"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          {!isActive && (
            <button
              onClick={onDelete}
              className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Delete backup"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isActive && progress && (
        <BackupProgressBar progress={progress} />
      )}
    </div>
  );
}

function BackupProgressBar({ progress }: { progress: BackupProgress }) {
  const stages = ['initializing', 'fetching', 'compressing', 'uploading'];
  const stageLabels: Record<string, string> = {
    initializing: 'Initializing',
    fetching: 'Fetching tables',
    compressing: 'Compressing',
    uploading: 'Uploading',
  };

  const currentIdx = stages.indexOf(progress.stage);

  let percent = 0;
  if (progress.stage === 'fetching' && progress.total_tables) {
    const tableProgress = (progress.tables_completed || 0) / progress.total_tables;
    percent = (1 + tableProgress * 2) / 4 * 100;
  } else if (currentIdx >= 0) {
    percent = ((currentIdx + 1) / stages.length) * 100;
  }

  const message = progress.stage === 'fetching' && progress.current_table
    ? `Fetching ${progress.current_table} (${progress.tables_completed || 0}/${progress.total_tables || '?'})`
    : stageLabels[progress.stage] || progress.stage;

  return (
    <div className="mt-3 ml-12">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{message}</span>
        {progress.total_rows != null && progress.total_rows > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {progress.total_rows.toLocaleString()} rows fetched
          </span>
        )}
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div
          className="bg-blue-600 h-1.5 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(percent, 98)}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        {stages.map((stage, idx) => {
          const isActive = currentIdx === idx;
          const isDone = currentIdx > idx;
          return (
            <span
              key={stage}
              className={`text-[10px] font-medium ${
                isActive ? 'text-blue-600 dark:text-blue-400' :
                isDone ? 'text-green-600 dark:text-green-400' :
                'text-gray-400 dark:text-gray-500'
              }`}
            >
              {isDone ? '\u2713 ' : ''}{stageLabels[stage]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function CreateBackupModal({
  tables,
  onClose,
  onSubmit,
}: {
  tables: TableInfo[];
  onClose: () => void;
  onSubmit: (name: string, description: string, tables: string[]) => Promise<void>;
}) {
  const [name, setName] = useState(`Backup ${new Date().toLocaleDateString()}`);
  const [description, setDescription] = useState('');
  const LOG_TABLES = new Set(['system_logs', 'audit_logs', 'audit_logs_summary', 'log_level_config', 'rate_limit_attempts', 'failed_login_attempts', 'account_lockouts']);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set(tables.filter(t => !LOG_TABLES.has(t.table_name)).map(t => t.table_name)));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTable = (tableName: string) => {
    const next = new Set(selectedTables);
    if (next.has(tableName)) next.delete(tableName); else next.add(tableName);
    setSelectedTables(next);
  };

  const selectAll = () => setSelectedTables(new Set(tables.map(t => t.table_name)));
  const selectNone = () => setSelectedTables(new Set());

  const handleCreate = async () => {
    if (!name.trim() || selectedTables.size === 0) {
      setError('Name and at least one table are required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit(name, description, Array.from(selectedTables));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Database Backup</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Export selected tables as a compressed backup file. The backup runs in the background.
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
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || selectedTables.size === 0 || submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Archive className="w-4 h-4" />
            )}
            {submitting ? 'Starting...' : 'Create Backup'}
          </button>
        </div>
      </div>
    </div>
  );
}
