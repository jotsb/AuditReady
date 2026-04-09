import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_TABLES = new Set([
  "database_backups",
  "audit_logs",
  "audit_logs_summary",
  "system_roles",
  "system_logs",
  "log_level_config",
  "system_config",
  "rate_limit_attempts",
  "failed_login_attempts",
  "account_lockouts",
]);

const BACKUP_LIMIT = 25;
const HEARTBEAT_STALE_MS = 2 * 60 * 1000;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function logToSystem(
  client: ReturnType<typeof createClient>,
  level: "INFO" | "WARN" | "ERROR",
  message: string,
  metadata: Record<string, unknown>,
  userId?: string,
  executionTimeMs?: number
) {
  try {
    await client.from("system_logs").insert({
      level,
      category: "DATABASE",
      message,
      metadata,
      user_id: userId || null,
      execution_time_ms: executionTimeMs || null,
    });
  } catch (_) {
    // Never let logging failures break the main flow
  }
}

async function cleanupStaleBackups(
  client: ReturnType<typeof createClient>
): Promise<number> {
  const cutoff = new Date(Date.now() - HEARTBEAT_STALE_MS).toISOString();

  const { data: stale } = await client
    .from("database_backups")
    .select("id, name, last_heartbeat_at, started_at")
    .eq("status", "in_progress")
    .lt("last_heartbeat_at", cutoff);

  if (!stale || stale.length === 0) return 0;

  for (const backup of stale) {
    const msg = `Backup "${backup.name}" stopped responding (last heartbeat: ${backup.last_heartbeat_at})`;
    await client
      .from("database_backups")
      .update({
        status: "failed",
        error_message: msg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", backup.id);

    await logToSystem(client, "WARN", msg, {
      backup_id: backup.id,
      backup_name: backup.name,
      last_heartbeat_at: backup.last_heartbeat_at,
      started_at: backup.started_at,
    });
  }

  return stale.length;
}

async function enforceBackupLimit(
  client: ReturnType<typeof createClient>
): Promise<void> {
  const { data: allBackups } = await client
    .from("database_backups")
    .select("id, storage_path")
    .in("status", ["completed", "completed_with_errors", "failed"])
    .order("created_at", { ascending: true });

  if (!allBackups || allBackups.length <= BACKUP_LIMIT) return;

  const toDelete = allBackups.slice(0, allBackups.length - BACKUP_LIMIT);
  for (const b of toDelete) {
    if (b.storage_path) {
      await client.storage.from("database-backups").remove([b.storage_path]);
    }
    await client.from("database_backups").delete().eq("id", b.id);
  }
}

async function fetchAllRows(
  client: ReturnType<typeof createClient>,
  table: string
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const allRows: Record<string, unknown>[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data: rows, error } = await client
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);

    if (error) return { rows: [], error: error.message };
    if (!rows || rows.length === 0) break;
    allRows.push(...rows);
    from += pageSize;
    if (rows.length < pageSize) break;
  }

  return { rows: allRows, error: null };
}

async function updateHeartbeat(
  client: ReturnType<typeof createClient>,
  backupId: string,
  progress: Record<string, unknown>
) {
  await client
    .from("database_backups")
    .update({
      last_heartbeat_at: new Date().toISOString(),
      progress,
    })
    .eq("id", backupId);
}

async function runBackup(
  adminClient: ReturnType<typeof createClient>,
  backupId: string,
  userId: string,
  tables: string[],
  backupName: string,
  description?: string
): Promise<void> {
  const startTime = Date.now();

  try {
    const backupData: Record<string, unknown> = {
      _metadata: {
        backup_id: backupId,
        name: backupName,
        description: description || null,
        created_at: new Date().toISOString(),
        created_by: userId,
        tables,
      },
    };

    const rowCounts: Record<string, number> = {};
    const tableErrors: string[] = [];
    let tablesCompleted = 0;

    await updateHeartbeat(adminClient, backupId, {
      stage: "fetching",
      current_table: null,
      tables_completed: 0,
      total_tables: tables.length,
      total_rows: 0,
    });

    for (const table of tables) {
      const safeName = table.replace(/[^a-zA-Z0-9_]/g, "");

      await updateHeartbeat(adminClient, backupId, {
        stage: "fetching",
        current_table: safeName,
        tables_completed: tablesCompleted,
        total_tables: tables.length,
        total_rows: Object.values(rowCounts).reduce((s, n) => s + n, 0),
      });

      const { rows, error: fetchErr } = await fetchAllRows(
        adminClient,
        safeName
      );

      if (fetchErr) {
        tableErrors.push(`${safeName}: ${fetchErr}`);
        backupData[safeName] = [];
        rowCounts[safeName] = 0;
      } else {
        backupData[safeName] = rows;
        rowCounts[safeName] = rows.length;
      }

      tablesCompleted++;
    }

    await updateHeartbeat(adminClient, backupId, {
      stage: "compressing",
      tables_completed: tablesCompleted,
      total_tables: tables.length,
      total_rows: Object.values(rowCounts).reduce((s, n) => s + n, 0),
    });

    const jsonStr = JSON.stringify(backupData);
    const zip = new JSZip();
    zip.file("backup.json", jsonStr);
    const zipBuffer: Uint8Array = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const storagePath = `${backupId}/${backupName.replace(/\s+/g, "_")}.zip`;

    await updateHeartbeat(adminClient, backupId, {
      stage: "uploading",
      tables_completed: tablesCompleted,
      total_tables: tables.length,
      total_rows: Object.values(rowCounts).reduce((s, n) => s + n, 0),
      compressed_size: zipBuffer.byteLength,
      uncompressed_size: jsonStr.length,
    });

    const { error: uploadErr } = await adminClient.storage
      .from("database-backups")
      .upload(storagePath, zipBuffer, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Storage upload failed: ${uploadErr.message}`);
    }

    const hasTableErrors = tableErrors.length > 0;
    const finalStatus = hasTableErrors ? "completed_with_errors" : "completed";
    const errorMessage = hasTableErrors ? tableErrors.join("; ") : null;
    const totalRows = Object.values(rowCounts).reduce((s, n) => s + n, 0);
    const durationMs = Date.now() - startTime;

    await adminClient
      .from("database_backups")
      .update({
        status: finalStatus,
        storage_path: storagePath,
        size_bytes: zipBuffer.byteLength,
        row_counts: rowCounts,
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
        progress: {
          stage: "done",
          tables_completed: tablesCompleted,
          total_tables: tables.length,
          total_rows: totalRows,
        },
      })
      .eq("id", backupId);

    await adminClient.from("audit_logs").insert({
      user_id: userId,
      action: "create_backup",
      resource_type: "database_backup",
      resource_id: backupId,
      details: {
        name: backupName,
        tables_count: tables.length,
        size_bytes: zipBuffer.byteLength,
        row_counts: rowCounts,
      },
    });

    await logToSystem(
      adminClient,
      hasTableErrors ? "WARN" : "INFO",
      `Backup "${backupName}" ${finalStatus} - ${totalRows} rows across ${tables.length} tables, ${formatBytes(zipBuffer.byteLength)} compressed in ${(durationMs / 1000).toFixed(1)}s${hasTableErrors ? ` (errors: ${tableErrors.join("; ")})` : ""}`,
      {
        backup_id: backupId,
        backup_name: backupName,
        status: finalStatus,
        tables_count: tables.length,
        total_rows: totalRows,
        compressed_size_bytes: zipBuffer.byteLength,
        uncompressed_size_bytes: jsonStr.length,
        duration_ms: durationMs,
        row_counts: rowCounts,
        table_errors: hasTableErrors ? tableErrors : undefined,
      },
      userId,
      durationMs
    );

    await enforceBackupLimit(adminClient);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startTime;

    await adminClient
      .from("database_backups")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
        progress: { stage: "failed" },
      })
      .eq("id", backupId);

    await logToSystem(
      adminClient,
      "ERROR",
      `Backup "${backupName}" failed after ${(durationMs / 1000).toFixed(1)}s: ${message}`,
      {
        backup_id: backupId,
        backup_name: backupName,
        status: "failed",
        error: message,
        duration_ms: durationMs,
        tables_requested: tables,
      },
      userId,
      durationMs
    );
  }
}

async function createBackupForTables(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  tables: string[],
  backupName: string,
  backupType: string,
  description?: string
): Promise<{
  backupId: string;
  rowCounts: Record<string, number>;
  sizeBytes: number;
}> {
  const { data: record, error: insertErr } = await adminClient
    .from("database_backups")
    .insert({
      name: backupName,
      description: description || null,
      status: "in_progress",
      backup_type: backupType,
      tables_included: tables,
      created_by: userId,
      started_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insertErr)
    throw new Error(`Failed to create backup record: ${insertErr.message}`);

  const backupId = record.id;
  const backupData: Record<string, unknown> = {
    _metadata: {
      backup_id: backupId,
      name: backupName,
      description: description || null,
      created_at: new Date().toISOString(),
      created_by: userId,
      tables,
    },
  };

  const rowCounts: Record<string, number> = {};

  for (const table of tables) {
    const safeName = table.replace(/[^a-zA-Z0-9_]/g, "");
    const { rows, error: fetchErr } = await fetchAllRows(
      adminClient,
      safeName
    );

    if (fetchErr) {
      backupData[safeName] = { error: fetchErr, rows: [] };
      rowCounts[safeName] = 0;
    } else {
      backupData[safeName] = rows;
      rowCounts[safeName] = rows.length;
    }

    await adminClient
      .from("database_backups")
      .update({ last_heartbeat_at: new Date().toISOString() })
      .eq("id", backupId);
  }

  const jsonStr = JSON.stringify(backupData, null, 2);
  const zip = new JSZip();
  zip.file("backup.json", jsonStr);
  const zipBuffer: Uint8Array = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const storagePath = `${backupId}/${backupName.replace(/\s+/g, "_")}.zip`;

  const { error: uploadErr } = await adminClient.storage
    .from("database-backups")
    .upload(storagePath, zipBuffer, {
      contentType: "application/zip",
      upsert: true,
    });

  if (uploadErr) {
    await adminClient
      .from("database_backups")
      .update({
        status: "failed",
        error_message: uploadErr.message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", backupId);
    throw new Error(`Upload failed: ${uploadErr.message}`);
  }

  await adminClient
    .from("database_backups")
    .update({
      status: "completed",
      storage_path: storagePath,
      size_bytes: zipBuffer.byteLength,
      row_counts: rowCounts,
      completed_at: new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq("id", backupId);

  return { backupId, rowCounts, sizeBytes: zipBuffer.byteLength };
}

function topologicalSort(
  tables: string[],
  fkMap: Map<string, Set<string>>
): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  const tableSet = new Set(tables);

  function visit(table: string) {
    if (visited.has(table)) return;
    visited.add(table);
    const deps = fkMap.get(table) || new Set();
    for (const dep of deps) {
      if (tableSet.has(dep)) visit(dep);
    }
    result.push(table);
  }

  for (const t of tables) visit(t);
  return result;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const adminClient = buildAdminClient();

    const { data: adminCheck } = await adminClient
      .from("system_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminCheck) {
      return jsonResponse({ error: "Admin access required" }, 403);
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { name, description, tables } = body;

      if (!name || !tables || !Array.isArray(tables) || tables.length === 0) {
        return jsonResponse({ error: "Name and tables are required" }, 400);
      }

      await cleanupStaleBackups(adminClient);

      const { data: record, error: insertErr } = await adminClient
        .from("database_backups")
        .insert({
          name,
          description: description || null,
          status: "in_progress",
          backup_type: "manual",
          tables_included: tables,
          created_by: user.id,
          started_at: new Date().toISOString(),
          last_heartbeat_at: new Date().toISOString(),
          progress: {
            stage: "initializing",
            tables_completed: 0,
            total_tables: tables.length,
            total_rows: 0,
          },
        })
        .select("id")
        .single();

      if (insertErr) {
        return jsonResponse(
          { error: `Failed to create backup: ${insertErr.message}` },
          500
        );
      }

      const backupId = record.id;

      await logToSystem(
        adminClient,
        "INFO",
        `Backup "${name}" initiated - ${tables.length} tables selected`,
        {
          backup_id: backupId,
          backup_name: name,
          tables_count: tables.length,
          tables,
          backup_type: "manual",
        },
        user.id
      );

      EdgeRuntime.waitUntil(
        runBackup(adminClient, backupId, user.id, tables, name, description)
      );

      return jsonResponse({
        backup_id: backupId,
        status: "in_progress",
      });
    }

    if (action === "restore") {
      const {
        backup_id,
        backup_data,
        strategy,
        tables: requestedTables,
      } = body;

      if (!strategy || !["merge", "replace"].includes(strategy)) {
        return jsonResponse(
          { error: "Strategy must be 'merge' or 'replace'" },
          400
        );
      }
      if (!backup_id && !backup_data) {
        return jsonResponse(
          { error: "Either backup_id or backup_data is required" },
          400
        );
      }

      let sourceData: Record<string, unknown>;
      let sourceBackupId: string | null = backup_id || null;

      if (backup_id) {
        const { data: backupRecord, error: fetchErr } = await adminClient
          .from("database_backups")
          .select("storage_path, name, status")
          .eq("id", backup_id)
          .maybeSingle();

        if (fetchErr || !backupRecord) {
          return jsonResponse({ error: "Backup not found" }, 404);
        }
        if (
          backupRecord.status !== "completed" &&
          backupRecord.status !== "completed_with_errors"
        ) {
          return jsonResponse(
            { error: "Can only restore from completed backups" },
            400
          );
        }
        if (!backupRecord.storage_path) {
          return jsonResponse(
            { error: "Backup file not found in storage" },
            404
          );
        }

        const { data: fileBlob, error: dlErr } = await adminClient.storage
          .from("database-backups")
          .download(backupRecord.storage_path);

        if (dlErr || !fileBlob) {
          return jsonResponse(
            { error: `Failed to download backup: ${dlErr?.message}` },
            500
          );
        }

        const isZip =
          backupRecord.storage_path.endsWith(".zip") ||
          fileBlob.type === "application/zip";

        if (isZip) {
          const zip = await JSZip.loadAsync(await fileBlob.arrayBuffer());
          const jsonFile = zip.file("backup.json");
          if (!jsonFile)
            return jsonResponse(
              { error: "Invalid backup ZIP: missing backup.json" },
              400
            );
          sourceData = JSON.parse(await jsonFile.async("string"));
        } else {
          sourceData = JSON.parse(await fileBlob.text());
        }
      } else {
        sourceData = backup_data;
      }

      if (!sourceData._metadata || typeof sourceData._metadata !== "object") {
        return jsonResponse(
          { error: "Invalid backup format: missing _metadata" },
          400
        );
      }

      const allBackupTables = Object.keys(sourceData).filter(
        (k) => k !== "_metadata" && !SYSTEM_TABLES.has(k)
      );

      if (allBackupTables.length === 0) {
        return jsonResponse(
          { error: "No restorable tables found in backup" },
          400
        );
      }

      const tablesToRestore: string[] =
        requestedTables && Array.isArray(requestedTables)
          ? requestedTables.filter(
              (t: string) =>
                allBackupTables.includes(t) && !SYSTEM_TABLES.has(t)
            )
          : allBackupTables;

      if (tablesToRestore.length === 0) {
        return jsonResponse(
          { error: "No valid tables selected for restore" },
          400
        );
      }

      const restoreStartTime = Date.now();

      await logToSystem(
        adminClient,
        "INFO",
        `Restore initiated - ${tablesToRestore.length} tables, strategy: ${strategy}${sourceBackupId ? `, from backup ${sourceBackupId}` : " from uploaded file"}`,
        {
          action: "restore",
          strategy,
          source_backup_id: sourceBackupId,
          tables_count: tablesToRestore.length,
          tables: tablesToRestore,
        },
        user.id
      );

      const { data: fkRows } = await userClient.rpc("admin_get_foreign_keys");
      const fkDeps = new Map<string, Set<string>>();
      const selfRefCols = new Map<string, string[]>();

      if (fkRows && Array.isArray(fkRows)) {
        for (const fk of fkRows) {
          if (!fkDeps.has(fk.source_table))
            fkDeps.set(fk.source_table, new Set());
          if (fk.source_table !== fk.target_table) {
            fkDeps.get(fk.source_table)!.add(fk.target_table);
          } else {
            if (!selfRefCols.has(fk.source_table))
              selfRefCols.set(fk.source_table, []);
            const existing = selfRefCols.get(fk.source_table)!;
            if (!existing.includes(fk.source_column)) {
              existing.push(fk.source_column);
            }
          }
        }
      }

      const insertOrder = topologicalSort(tablesToRestore, fkDeps);
      const deleteOrder = [...insertOrder].reverse();

      const pkMap = new Map<string, string>();
      for (const table of tablesToRestore) {
        const { data: cols } = await userClient.rpc(
          "admin_get_table_columns",
          {
            p_table_name: table,
          }
        );
        if (cols && Array.isArray(cols)) {
          const pk = cols.find((c: Record<string, unknown>) => c.is_primary_key);
          if (pk) pkMap.set(table, pk.column_name as string);
        }
      }

      let preRestoreBackupId: string | null = null;
      try {
        const snapshot = await createBackupForTables(
          adminClient,
          user.id,
          tablesToRestore,
          `Pre-restore snapshot ${new Date().toISOString()}`,
          "pre_restore",
          `Automatic safety snapshot before ${strategy} restore of ${tablesToRestore.length} tables`
        );
        preRestoreBackupId = snapshot.backupId;
      } catch (snapErr: unknown) {
        const msg =
          snapErr instanceof Error ? snapErr.message : String(snapErr);
        return jsonResponse(
          {
            error: `Failed to create safety snapshot: ${msg}. Restore aborted.`,
          },
          500
        );
      }

      const { data: restoreRecord, error: restoreInsertErr } =
        await adminClient
          .from("database_backups")
          .insert({
            name: `Restore ${new Date().toISOString()}`,
            description: `${strategy} restore of ${tablesToRestore.length} tables${sourceBackupId ? ` from backup ${sourceBackupId}` : " from uploaded file"}`,
            status: "in_progress",
            backup_type: "restore",
            tables_included: tablesToRestore,
            created_by: user.id,
            started_at: new Date().toISOString(),
            restored_from_backup_id: sourceBackupId,
            restore_strategy: strategy,
            last_heartbeat_at: new Date().toISOString(),
          })
          .select("id")
          .single();

      if (restoreInsertErr) {
        return jsonResponse(
          {
            error: `Failed to create restore record: ${restoreInsertErr.message}`,
          },
          500
        );
      }

      const restoreId = restoreRecord.id;
      const restoreRowCounts: Record<string, number> = {};
      const tableErrors: Record<string, string> = {};
      const batchSize = 500;

      try {
        if (strategy === "replace") {
          for (const table of deleteOrder) {
            const pk = pkMap.get(table);
            const delQuery = pk
              ? adminClient.from(table).delete().not(pk, "is", null)
              : adminClient
                  .from(table)
                  .delete()
                  .gte("created_at", "1970-01-01T00:00:00Z");

            const { error: delErr } = await delQuery;
            if (delErr) {
              tableErrors[table] = `Delete failed: ${delErr.message}`;
            }

            await adminClient
              .from("database_backups")
              .update({ last_heartbeat_at: new Date().toISOString() })
              .eq("id", restoreId);
          }
        }

        for (const table of insertOrder) {
          const rows = sourceData[table];
          if (!Array.isArray(rows) || rows.length === 0) {
            restoreRowCounts[table] = 0;
            continue;
          }

          if (tableErrors[table]) continue;

          const pk = pkMap.get(table);
          const useMerge = strategy === "merge" && pk;
          const selfRefs = selfRefCols.get(table) || [];
          const hasSelfRefs = selfRefs.length > 0 && pk;

          const insertRows = hasSelfRefs
            ? rows.map((row: Record<string, unknown>) => {
                const modified = { ...row };
                for (const col of selfRefs) modified[col] = null;
                return modified;
              })
            : rows;

          let restored = 0;
          for (let i = 0; i < insertRows.length; i += batchSize) {
            const batch = insertRows.slice(i, i + batchSize);

            const { error: batchErr } = useMerge
              ? await adminClient
                  .from(table)
                  .upsert(batch, { onConflict: pk })
              : await adminClient.from(table).insert(batch);

            if (batchErr) {
              tableErrors[table] = `${useMerge ? "Upsert" : "Insert"} failed at batch ${Math.floor(i / batchSize)}: ${batchErr.message}`;
              break;
            }
            restored += batch.length;
          }
          restoreRowCounts[table] = restored;

          if (hasSelfRefs && !tableErrors[table]) {
            const deferredRows = rows.filter((row: Record<string, unknown>) =>
              selfRefs.some((col) => row[col] != null)
            );
            for (const row of deferredRows) {
              const updateData: Record<string, unknown> = {};
              for (const col of selfRefs) updateData[col] = (row as Record<string, unknown>)[col];

              const { error: updateErr } = await adminClient
                .from(table)
                .update(updateData)
                .eq(pk!, (row as Record<string, unknown>)[pk!]);

              if (updateErr) {
                tableErrors[table] = `Self-reference update failed: ${updateErr.message}`;
                break;
              }
            }
          }

          await adminClient
            .from("database_backups")
            .update({ last_heartbeat_at: new Date().toISOString() })
            .eq("id", restoreId);
        }

        const hasErrors = Object.keys(tableErrors).length > 0;
        const finalStatus = hasErrors ? "completed_with_errors" : "completed";
        const restoreDurationMs = Date.now() - restoreStartTime;

        await adminClient
          .from("database_backups")
          .update({
            status: finalStatus,
            row_counts: restoreRowCounts,
            error_message: hasErrors ? JSON.stringify(tableErrors) : null,
            completed_at: new Date().toISOString(),
            last_heartbeat_at: new Date().toISOString(),
            metadata: {
              pre_restore_backup_id: preRestoreBackupId,
              table_errors: tableErrors,
            },
          })
          .eq("id", restoreId);

        await adminClient.from("audit_logs").insert({
          user_id: user.id,
          action: "restore_backup",
          resource_type: "database_backup",
          resource_id: restoreId,
          details: {
            strategy,
            source_backup_id: sourceBackupId,
            pre_restore_backup_id: preRestoreBackupId,
            tables_restored: tablesToRestore,
            row_counts: restoreRowCounts,
            errors: tableErrors,
            status: finalStatus,
          },
        });

        const totalRestoredRows = Object.values(restoreRowCounts).reduce(
          (s, n) => s + n,
          0
        );

        await logToSystem(
          adminClient,
          hasErrors ? "WARN" : "INFO",
          `Restore ${finalStatus} - ${totalRestoredRows} rows across ${tablesToRestore.length} tables via ${strategy} in ${(restoreDurationMs / 1000).toFixed(1)}s${hasErrors ? ` (table errors: ${Object.keys(tableErrors).join(", ")})` : ""}`,
          {
            restore_id: restoreId,
            strategy,
            status: finalStatus,
            source_backup_id: sourceBackupId,
            pre_restore_backup_id: preRestoreBackupId,
            tables_count: tablesToRestore.length,
            total_rows: totalRestoredRows,
            row_counts: restoreRowCounts,
            duration_ms: restoreDurationMs,
            table_errors: hasErrors ? tableErrors : undefined,
          },
          user.id,
          restoreDurationMs
        );

        await enforceBackupLimit(adminClient);

        return jsonResponse({
          restore_id: restoreId,
          pre_restore_backup_id: preRestoreBackupId,
          status: finalStatus,
          tables_restored: tablesToRestore,
          row_counts: restoreRowCounts,
          errors: hasErrors ? tableErrors : undefined,
        });
      } catch (restoreErr: unknown) {
        const message =
          restoreErr instanceof Error
            ? restoreErr.message
            : String(restoreErr);
        const restoreDurationMs = Date.now() - restoreStartTime;

        await adminClient
          .from("database_backups")
          .update({
            status: "failed",
            error_message: message,
            completed_at: new Date().toISOString(),
            last_heartbeat_at: new Date().toISOString(),
            metadata: { pre_restore_backup_id: preRestoreBackupId },
          })
          .eq("id", restoreId);

        await logToSystem(
          adminClient,
          "ERROR",
          `Restore failed after ${(restoreDurationMs / 1000).toFixed(1)}s: ${message}`,
          {
            restore_id: restoreId,
            strategy,
            status: "failed",
            error: message,
            source_backup_id: sourceBackupId,
            pre_restore_backup_id: preRestoreBackupId,
            tables_requested: tablesToRestore,
            duration_ms: restoreDurationMs,
          },
          user.id,
          restoreDurationMs
        );

        return jsonResponse(
          { error: message, pre_restore_backup_id: preRestoreBackupId },
          500
        );
      }
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: message }, 500);
  }
});
