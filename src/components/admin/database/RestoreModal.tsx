import { useState, useRef } from 'react';
import {
  RotateCcw, Upload, AlertTriangle, Shield, Loader, CheckCircle,
  XCircle, Database, Merge, Replace, FileJson, Info, Lock
} from 'lucide-react';
import {
  restoreFromBackup, restoreFromUpload, parseBackupFile,
  type BackupRecord, type RestoreResult, type ParsedBackupFile
} from '../../../lib/dbManagementService';

const IMMUTABLE_TABLES = new Set([
  'system_logs',
  'audit_logs',
  'audit_logs_summary',
]);

interface RestoreModalProps {
  backup: BackupRecord | null;
  onClose: () => void;
  onRestored: () => void;
}

type Strategy = 'merge' | 'replace';
type Phase = 'configure' | 'restoring' | 'done';

export default function RestoreModal({ backup, onClose, onRestored }: RestoreModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedFile, setParsedFile] = useState<ParsedBackupFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<Strategy>('merge');
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [confirmText, setConfirmText] = useState('');
  const [phase, setPhase] = useState<Phase>('configure');
  const [statusMessage, setStatusMessage] = useState('');
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isUploadMode = !backup;

  const allTables = backup
    ? backup.tables_included
    : parsedFile?.tables ?? [];

  const restorableTables = allTables.filter((t) => !IMMUTABLE_TABLES.has(t));
  const immutableInBackup = allTables.filter((t) => IMMUTABLE_TABLES.has(t));

  const backupRowCounts = backup?.row_counts ?? parsedFile?.rowCounts ?? {};

  const totalRows = allTables.reduce((sum, t) => sum + (backupRowCounts[t] || 0), 0);

  const hasSource = !!backup || !!parsedFile;
  const canRestore = hasSource && selectedTables.size > 0 && confirmText === 'RESTORE';

  useState(() => {
    if (backup) {
      setSelectedTables(new Set(backup.tables_included.filter((t) => !IMMUTABLE_TABLES.has(t))));
    }
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setParsedFile(null);
    try {
      const parsed = await parseBackupFile(file);
      setParsedFile(parsed);
      setSelectedTables(new Set(parsed.tables.filter((t) => !IMMUTABLE_TABLES.has(t))));
    } catch (err: any) {
      setFileError(err.message);
    }
  };

  const toggleTable = (t: string) => {
    if (IMMUTABLE_TABLES.has(t)) return;
    const next = new Set(selectedTables);
    if (next.has(t)) next.delete(t); else next.add(t);
    setSelectedTables(next);
  };

  const selectAll = () => setSelectedTables(new Set(restorableTables));
  const clearAll = () => setSelectedTables(new Set());

  const handleRestore = async () => {
    setPhase('restoring');
    setError(null);
    setStatusMessage('Creating safety snapshot...');

    try {
      const tables = Array.from(selectedTables);
      let res: RestoreResult;

      setStatusMessage(`Restoring ${tables.length} tables using ${strategy} strategy...`);

      if (backup) {
        res = await restoreFromBackup(backup.id, strategy, tables);
      } else if (parsedFile) {
        res = await restoreFromUpload(parsedFile.rawData, strategy, tables);
      } else {
        throw new Error('No backup source');
      }

      setResult(res);
      setPhase('done');
    } catch (err: any) {
      setError(err.message);
      setPhase('done');
    }
  };

  const restoreSucceeded = result && result.status === 'completed';
  const restorePartial = result && result.status === 'completed_with_errors';
  const restoreFailed = phase === 'done' && !restoreSucceeded && !restorePartial;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <RotateCcw className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isUploadMode ? 'Upload & Restore' : 'Restore from Backup'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isUploadMode
                  ? 'Upload a previously downloaded backup file to restore'
                  : `Restore data from "${backup.name}"`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {phase === 'configure' && (
            <>
              {isUploadMode && !parsedFile && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Backup File
                  </label>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                    <FileJson className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Select a .json or .zip backup file
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,.zip,application/json,application/zip"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition font-medium"
                    >
                      Choose File
                    </button>
                  </div>
                  {fileError && (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                      <XCircle className="w-4 h-4 flex-shrink-0" />
                      {fileError}
                    </div>
                  )}
                </div>
              )}

              {hasSource && (
                <>
                  <SourceInfoPanel
                    name={backup?.name ?? (parsedFile?.metadata?.name as string) ?? 'Uploaded file'}
                    date={backup?.created_at ?? (parsedFile?.metadata?.created_at as string) ?? ''}
                    tableCount={allTables.length}
                    totalRows={totalRows}
                    sizeBytes={backup?.size_bytes}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Restore Strategy
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <StrategyCard
                        icon={Merge}
                        title="Merge (Upsert)"
                        description="Insert new rows and update existing rows by primary key. Data not in the backup is left untouched."
                        selected={strategy === 'merge'}
                        onClick={() => setStrategy('merge')}
                        variant="safe"
                      />
                      <StrategyCard
                        icon={Replace}
                        title="Replace"
                        description="Delete all existing rows in selected tables, then insert backup data. Data not in the backup is permanently lost."
                        selected={strategy === 'replace'}
                        onClick={() => setStrategy('replace')}
                        variant="destructive"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Tables ({selectedTables.size}/{restorableTables.length} restorable)
                      </label>
                      <div className="flex gap-2">
                        <button onClick={selectAll} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Select All</button>
                        <button onClick={clearAll} className="text-xs text-gray-500 dark:text-gray-400 hover:underline">Clear</button>
                      </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg divide-y divide-gray-100 dark:divide-gray-700/50">
                      {restorableTables.map((table) => (
                        <label
                          key={table}
                          className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedTables.has(table)}
                              onChange={() => toggleTable(table)}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm font-mono text-gray-900 dark:text-white">{table}</span>
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {(backupRowCounts[table] || 0).toLocaleString()} rows
                          </span>
                        </label>
                      ))}
                      {immutableInBackup.length > 0 && (
                        <>
                          <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-900/50">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              Immutable tables (backed up, not restorable)
                            </span>
                          </div>
                          {immutableInBackup.map((table) => (
                            <div
                              key={table}
                              className="flex items-center justify-between px-3 py-2 opacity-50"
                            >
                              <div className="flex items-center gap-2">
                                <Lock className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-sm font-mono text-gray-500 dark:text-gray-400">{table}</span>
                              </div>
                              <span className="text-xs text-gray-400 dark:text-gray-500">
                                {(backupRowCounts[table] || 0).toLocaleString()} rows
                              </span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>

                  <WarningBanner strategy={strategy} tableCount={selectedTables.size} />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Type <span className="font-mono font-bold text-amber-600 dark:text-amber-400">RESTORE</span> to confirm
                    </label>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="RESTORE"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent font-mono"
                    />
                  </div>
                </>
              )}
            </>
          )}

          {phase === 'restoring' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-10 h-10 text-blue-500 animate-spin mb-4" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{statusMessage}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This may take a moment. Do not close this window.</p>
            </div>
          )}

          {phase === 'done' && restoreSucceeded && result && (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="font-semibold text-green-800 dark:text-green-300">Restore Completed</span>
                </div>
                <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <p>{result.tables_restored.length} tables restored using {strategy} strategy</p>
                  <p>Total rows processed: {Object.values(result.row_counts).reduce((s, n) => s + n, 0).toLocaleString()}</p>
                </div>
              </div>

              {result.pre_restore_backup_id && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg flex items-start gap-2">
                  <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-700 dark:text-blue-300">
                    <p className="font-medium">Safety snapshot created</p>
                    <p className="text-xs mt-0.5 text-blue-600 dark:text-blue-400">
                      A pre-restore backup was saved automatically. You can find it in the backup list to undo this restore if needed.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Per-table results</h4>
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg divide-y divide-gray-100 dark:divide-gray-700/50 max-h-40 overflow-y-auto">
                  {result.tables_restored.map((t) => (
                    <div key={t} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-mono text-gray-900 dark:text-white">{t}</span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {(result.row_counts[t] || 0).toLocaleString()} rows
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {phase === 'done' && restorePartial && result && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span className="font-semibold text-amber-800 dark:text-amber-300">Restore Completed with Warnings</span>
                </div>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Most tables were restored successfully, but some had errors. Check the details below.
                </p>
              </div>

              {result.errors && Object.keys(result.errors).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Table errors</h4>
                  <div className="border border-red-200 dark:border-red-700 rounded-lg divide-y divide-red-100 dark:divide-red-800/50 max-h-40 overflow-y-auto">
                    {Object.entries(result.errors).map(([t, msg]) => (
                      <div key={t} className="px-3 py-2 text-sm">
                        <span className="font-mono font-medium text-red-800 dark:text-red-300">{t}</span>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{msg}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Successfully restored</h4>
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg divide-y divide-gray-100 dark:divide-gray-700/50 max-h-40 overflow-y-auto">
                  {result.tables_restored
                    .filter((t) => !result.errors?.[t])
                    .map((t) => (
                      <div key={t} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                          <span className="font-mono text-gray-900 dark:text-white">{t}</span>
                        </div>
                        <span className="text-gray-500 dark:text-gray-400">
                          {(result.row_counts[t] || 0).toLocaleString()} rows
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {result.pre_restore_backup_id && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg flex items-start gap-2">
                  <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    A pre-restore safety snapshot was saved. You can restore from it to undo any changes.
                  </p>
                </div>
              )}
            </div>
          )}

          {phase === 'done' && restoreFailed && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <span className="font-semibold text-red-800 dark:text-red-300">Restore Failed</span>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300">
                  {error || 'The restore could not be completed. Check the details below.'}
                </p>
              </div>

              {result?.errors && Object.keys(result.errors).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Table errors</h4>
                  <div className="border border-red-200 dark:border-red-700 rounded-lg divide-y divide-red-100 dark:divide-red-800/50 max-h-40 overflow-y-auto">
                    {Object.entries(result.errors).map(([t, msg]) => (
                      <div key={t} className="px-3 py-2 text-sm">
                        <span className="font-mono font-medium text-red-800 dark:text-red-300">{t}</span>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{msg}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result?.pre_restore_backup_id && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg flex items-start gap-2">
                  <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    A pre-restore safety snapshot was saved. You can restore from it to undo any changes.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          {phase === 'done' ? (
            <button
              onClick={() => { onRestored(); onClose(); }}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={phase === 'restoring'}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={!canRestore || phase === 'restoring'}
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  strategy === 'replace'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                {strategy === 'replace' ? 'Replace & Restore' : 'Merge & Restore'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceInfoPanel({
  name, date, tableCount, totalRows, sizeBytes,
}: {
  name: string; date: string; tableCount: number; totalRows: number; sizeBytes?: number;
}) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Database className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-900 dark:text-white">{name}</span>
      </div>
      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        {date && <span>{new Date(date).toLocaleString()}</span>}
        <span>{tableCount} tables</span>
        <span>{totalRows.toLocaleString()} rows</span>
        {sizeBytes != null && sizeBytes > 0 && <span>{formatBytes(sizeBytes)}</span>}
      </div>
    </div>
  );
}

function StrategyCard({
  icon: Icon, title, description, selected, onClick, variant,
}: {
  icon: typeof Merge;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  variant: 'safe' | 'destructive';
}) {
  const borderColor = selected
    ? variant === 'safe'
      ? 'border-teal-500 dark:border-teal-400 bg-teal-50/50 dark:bg-teal-900/20'
      : 'border-red-500 dark:border-red-400 bg-red-50/50 dark:bg-red-900/20'
    : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500';

  const iconColor = variant === 'safe'
    ? 'text-teal-600 dark:text-teal-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border-2 text-left transition ${borderColor}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{title}</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{description}</p>
    </button>
  );
}

function WarningBanner({ strategy, tableCount }: { strategy: Strategy; tableCount: number }) {
  if (strategy === 'replace') {
    return (
      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-red-700 dark:text-red-300">
          <p className="font-medium">Destructive operation</p>
          <p className="text-xs mt-0.5">
            All existing data in {tableCount} selected table{tableCount !== 1 ? 's' : ''} will be
            deleted and replaced with backup data. An automatic safety snapshot will be created
            first so you can undo this if needed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg flex items-start gap-2">
      <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
      <div className="text-sm text-amber-700 dark:text-amber-300">
        <p className="font-medium">Merge operation</p>
        <p className="text-xs mt-0.5">
          Existing rows with matching primary keys will be overwritten with backup values.
          New rows will be inserted. An automatic safety snapshot will be created first.
        </p>
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
