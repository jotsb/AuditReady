import { supabase } from './supabase';
import JSZip from 'jszip';

async function ensureAdmin(): Promise<void> {
  const { data } = await supabase
    .from('system_roles')
    .select('role')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .eq('role', 'admin')
    .maybeSingle();

  if (!data) throw new Error('Unauthorized: admin access required');
}

export interface TableInfo {
  table_name: string;
  row_estimate: number;
  size_bytes: number;
  size_pretty: string;
  dead_tuples: number;
  last_vacuum: string | null;
  last_autovacuum: string | null;
  last_analyze: string | null;
  rls_enabled: boolean;
}

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  ordinal_position: number;
  is_primary_key: boolean;
}

export interface IndexInfo {
  index_name: string;
  index_def: string;
  size_bytes: number;
  size_pretty: string;
}

export interface ForeignKey {
  constraint_name: string;
  source_table: string;
  source_column: string;
  target_table: string;
  target_column: string;
}

export interface RLSPolicy {
  table_name: string;
  policy_name: string;
  permissive: string;
  roles: string[];
  cmd: string;
  qual: string | null;
  with_check: string | null;
}

export interface DatabaseStats {
  database_size: string;
  database_size_bytes: number;
  table_count: number;
  index_count: number;
  total_rows_estimate: number;
  dead_tuples: number;
  cache_hit_ratio: number;
  index_hit_ratio: number;
  active_connections: number;
  idle_connections: number;
  total_connections: number;
  max_connections: number;
  postgres_version: string;
  uptime: number;
}

export interface TableDataResult {
  rows: Record<string, unknown>[];
  total_count: number;
  page_limit: number;
  page_offset: number;
}

export interface BackupRecord {
  id: string;
  name: string;
  description: string | null;
  status: string;
  backup_type: string;
  tables_included: string[];
  size_bytes: number;
  storage_path: string | null;
  row_counts: Record<string, number>;
  error_message: string | null;
  created_by: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  restored_from_backup_id: string | null;
  restore_strategy: string | null;
  metadata: Record<string, unknown> | null;
}

export interface RestoreResult {
  restore_id: string;
  pre_restore_backup_id: string | null;
  status: string;
  tables_restored: string[];
  row_counts: Record<string, number>;
  errors?: Record<string, string>;
}

export interface ParsedBackupFile {
  metadata: Record<string, unknown>;
  tables: string[];
  rowCounts: Record<string, number>;
  rawData: Record<string, unknown>;
}

export async function getTableInfo(): Promise<TableInfo[]> {
  const { data, error } = await supabase.rpc('admin_get_table_info');
  if (error) throw new Error(error.message);
  return (data as TableInfo[]) || [];
}

export async function getTableColumns(tableName: string): Promise<ColumnInfo[]> {
  const { data, error } = await supabase.rpc('admin_get_table_columns', {
    p_table_name: tableName,
  });
  if (error) throw new Error(error.message);
  return (data as ColumnInfo[]) || [];
}

export async function getTableIndexes(tableName: string): Promise<IndexInfo[]> {
  const { data, error } = await supabase.rpc('admin_get_table_indexes', {
    p_table_name: tableName,
  });
  if (error) throw new Error(error.message);
  return (data as IndexInfo[]) || [];
}

export async function getForeignKeys(): Promise<ForeignKey[]> {
  const { data, error } = await supabase.rpc('admin_get_foreign_keys');
  if (error) throw new Error(error.message);
  return (data as ForeignKey[]) || [];
}

export async function getRLSPolicies(tableName?: string): Promise<RLSPolicy[]> {
  const { data, error } = await supabase.rpc('admin_get_rls_policies', {
    p_table_name: tableName || null,
  });
  if (error) throw new Error(error.message);
  return (data as RLSPolicy[]) || [];
}

export async function getDatabaseStats(): Promise<DatabaseStats> {
  const { data, error } = await supabase.rpc('admin_get_database_stats');
  if (error) throw new Error(error.message);
  return data as DatabaseStats;
}

export async function browseTableData(
  tableName: string,
  limit = 50,
  offset = 0,
  orderBy?: string,
  orderDir: 'ASC' | 'DESC' = 'ASC'
): Promise<TableDataResult> {
  const { data, error } = await supabase.rpc('admin_browse_table_data', {
    p_table_name: tableName,
    p_limit: limit,
    p_offset: offset,
    p_order_by: orderBy || null,
    p_order_dir: orderDir,
  });
  if (error) throw new Error(error.message);
  return data as TableDataResult;
}

export async function getBackups(): Promise<BackupRecord[]> {
  await ensureAdmin();
  const { data, error } = await supabase
    .from('database_backups')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchAllTableRows(
  table: string
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const allRows: Record<string, unknown>[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data: rows, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) return { rows: [], error: error.message };
    if (!rows || rows.length === 0) break;
    allRows.push(...rows);
    from += pageSize;
    if (rows.length < pageSize) break;
  }

  return { rows: allRows, error: null };
}

export type BackupProgress = {
  stage: 'initializing' | 'fetching' | 'compressing' | 'uploading' | 'finalizing';
  message: string;
  tableIndex?: number;
  tableCount?: number;
  tableName?: string;
};

export async function createBackup(
  name: string,
  description: string,
  tables: string[],
  onProgress?: (progress: BackupProgress) => void
): Promise<string> {
  const report = (p: BackupProgress) => onProgress?.(p);

  report({ stage: 'initializing', message: 'Verifying permissions...' });
  await ensureAdmin();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');

  report({ stage: 'initializing', message: 'Creating backup record...' });
  const { data: record, error: insertErr } = await supabase
    .from('database_backups')
    .insert({
      name,
      description: description || null,
      status: 'in_progress',
      backup_type: 'manual',
      tables_included: tables,
      created_by: user.id,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (insertErr) throw new Error(`Failed to create backup record: ${insertErr.message}`);

  const backupId = record.id;

  const markFailed = async (errorMessage: string) => {
    await supabase
      .from('database_backups')
      .update({ status: 'failed', error_message: errorMessage, completed_at: new Date().toISOString() })
      .eq('id', backupId);
  };

  try {
    const backupData: Record<string, unknown> = {
      _metadata: {
        backup_id: backupId,
        name,
        description: description || null,
        created_at: new Date().toISOString(),
        created_by: user.id,
        tables,
      },
    };

    const rowCounts: Record<string, number> = {};
    const tableErrors: string[] = [];

    for (let i = 0; i < tables.length; i++) {
      const safeName = tables[i].replace(/[^a-zA-Z0-9_]/g, '');
      report({
        stage: 'fetching',
        message: `Fetching ${safeName}...`,
        tableIndex: i + 1,
        tableCount: tables.length,
        tableName: safeName,
      });

      const { rows, error: fetchErr } = await fetchAllTableRows(safeName);

      if (fetchErr) {
        tableErrors.push(`${safeName}: ${fetchErr}`);
        backupData[safeName] = [];
        rowCounts[safeName] = 0;
      } else {
        backupData[safeName] = rows;
        rowCounts[safeName] = rows.length;
      }
    }

    report({ stage: 'compressing', message: 'Compressing backup data...' });
    const jsonStr = JSON.stringify(backupData, null, 2);
    const zip = new JSZip();
    zip.file('backup.json', jsonStr);
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const storagePath = `${backupId}/${name.replace(/\s+/g, '_')}.zip`;

    report({ stage: 'uploading', message: `Uploading backup (${formatBytesUtil(zipBlob.size)})...` });
    const { error: uploadErr } = await supabase.storage
      .from('database-backups')
      .upload(storagePath, zipBlob, { contentType: 'application/zip', upsert: true });

    if (uploadErr) {
      await markFailed(uploadErr.message);
      throw new Error(`Upload failed: ${uploadErr.message}`);
    }

    report({ stage: 'finalizing', message: 'Saving backup metadata...' });
    const hasTableErrors = tableErrors.length > 0;
    const finalStatus = hasTableErrors ? 'completed_with_errors' : 'completed';
    const errorMessage = hasTableErrors ? tableErrors.join('; ') : null;

    const { error: updateErr } = await supabase
      .from('database_backups')
      .update({
        status: finalStatus,
        storage_path: storagePath,
        size_bytes: zipBlob.size,
        row_counts: rowCounts,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', backupId);

    if (updateErr) throw new Error(`Failed to finalize backup: ${updateErr.message}`);

    if (hasTableErrors) {
      throw new Error(`Backup completed but ${tableErrors.length} table(s) had errors: ${tableErrors.join('; ')}`);
    }

    return backupId;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.startsWith('Backup completed but')) {
      await markFailed(message);
    }
    throw err;
  }
}

function formatBytesUtil(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export async function downloadBackup(backupId: string): Promise<Blob> {
  const { data: backup, error: fetchError } = await supabase
    .from('database_backups')
    .select('storage_path, name')
    .eq('id', backupId)
    .maybeSingle();

  if (fetchError || !backup?.storage_path) {
    throw new Error('Backup not found or has no file');
  }

  const { data, error } = await supabase.storage
    .from('database-backups')
    .download(backup.storage_path);

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteBackup(backupId: string): Promise<void> {
  const { data: backup } = await supabase
    .from('database_backups')
    .select('storage_path')
    .eq('id', backupId)
    .maybeSingle();

  if (backup?.storage_path) {
    await supabase.storage
      .from('database-backups')
      .remove([backup.storage_path]);
  }

  const { error } = await supabase
    .from('database_backups')
    .delete()
    .eq('id', backupId);

  if (error) throw new Error(error.message);
}

const SYSTEM_TABLES = new Set([
  'database_backups', 'audit_logs', 'audit_logs_summary', 'system_roles',
  'system_logs', 'log_level_config', 'system_config', 'rate_limit_attempts',
  'failed_login_attempts', 'account_lockouts',
]);

export async function parseBackupFile(file: File): Promise<ParsedBackupFile> {
  let jsonText: string;

  if (file.name.endsWith('.zip') || file.type === 'application/zip') {
    const zip = await JSZip.loadAsync(file);
    const jsonFile = zip.file('backup.json');
    if (!jsonFile) throw new Error('Invalid backup ZIP: missing backup.json');
    jsonText = await jsonFile.async('string');
  } else {
    jsonText = await file.text();
  }

  const raw = JSON.parse(jsonText);
  if (!raw._metadata || typeof raw._metadata !== 'object') {
    throw new Error('Invalid backup file: missing _metadata');
  }

  const tables: string[] = [];
  const rowCounts: Record<string, number> = {};
  for (const key of Object.keys(raw)) {
    if (key === '_metadata' || SYSTEM_TABLES.has(key)) continue;
    if (Array.isArray(raw[key])) {
      tables.push(key);
      rowCounts[key] = raw[key].length;
    }
  }

  return { metadata: raw._metadata, tables, rowCounts, rawData: raw };
}

export { SYSTEM_TABLES };

export async function restoreFromBackup(
  backupId: string,
  strategy: 'merge' | 'replace',
  tables?: string[]
): Promise<RestoreResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/database-backup`;
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'restore',
      backup_id: backupId,
      strategy,
      tables: tables || undefined,
    }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Restore failed');
  return result as RestoreResult;
}

export async function restoreFromUpload(
  backupData: Record<string, unknown>,
  strategy: 'merge' | 'replace',
  tables?: string[]
): Promise<RestoreResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/database-backup`;
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'restore',
      backup_data: backupData,
      strategy,
      tables: tables || undefined,
    }),
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Restore failed');
  return result as RestoreResult;
}
