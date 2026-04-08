import { supabase } from './supabase';

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

export async function createBackup(
  name: string,
  description: string,
  tables: string[]
): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/database-backup`;
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'create', name, description, tables }),
  });

  const text = await response.text();
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(text);
  } catch {
    throw new Error(`Backup failed (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error((result.error as string) || `Backup failed with status ${response.status}`);
  }

  return result.backup_id as string;
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

export function parseBackupFile(file: File): Promise<ParsedBackupFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string);
        if (!raw._metadata || typeof raw._metadata !== 'object') {
          reject(new Error('Invalid backup file: missing _metadata'));
          return;
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
        resolve({ metadata: raw._metadata, tables, rowCounts, rawData: raw });
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
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
