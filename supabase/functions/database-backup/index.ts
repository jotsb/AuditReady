import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SYSTEM_TABLES = new Set([
  "database_backups",
  "audit_logs",
  "system_roles",
  "system_logs",
  "log_level_config",
  "system_config",
  "rate_limit_attempts",
  "failed_login_attempts",
  "account_lockouts",
]);

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function createBackupForTables(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  tables: string[],
  backupName: string,
  backupType: string,
  description?: string
): Promise<{ backupId: string; rowCounts: Record<string, number>; sizeBytes: number }> {
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
    })
    .select("id")
    .single();

  if (insertErr) throw new Error(`Failed to create backup record: ${insertErr.message}`);

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
    const { data: rows, error: qErr } = await adminClient
      .from(safeName)
      .select("*")
      .limit(10000);

    if (qErr) {
      backupData[safeName] = { error: qErr.message, rows: [] };
      rowCounts[safeName] = 0;
    } else {
      backupData[safeName] = rows || [];
      rowCounts[safeName] = (rows || []).length;
    }
  }

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const storagePath = `${backupId}/${backupName.replace(/\s+/g, "_")}.json`;

  const { error: uploadErr } = await adminClient.storage
    .from("database-backups")
    .upload(storagePath, blob, { contentType: "application/json", upsert: true });

  if (uploadErr) {
    await adminClient
      .from("database_backups")
      .update({ status: "failed", error_message: uploadErr.message, completed_at: new Date().toISOString() })
      .eq("id", backupId);
    throw new Error(`Upload failed: ${uploadErr.message}`);
  }

  await adminClient
    .from("database_backups")
    .update({
      status: "completed",
      storage_path: storagePath,
      size_bytes: blob.size,
      row_counts: rowCounts,
      completed_at: new Date().toISOString(),
    })
    .eq("id", backupId);

  return { backupId, rowCounts, sizeBytes: blob.size };
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

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

      try {
        const result = await createBackupForTables(
          adminClient, user.id, tables, name, "manual", description
        );

        await adminClient.from("audit_logs").insert({
          user_id: user.id,
          action: "create_backup",
          resource_type: "database_backup",
          resource_id: result.backupId,
          details: {
            name,
            tables_count: tables.length,
            size_bytes: result.sizeBytes,
            row_counts: result.rowCounts,
          },
        });

        return jsonResponse({
          backup_id: result.backupId,
          status: "completed",
          size_bytes: result.sizeBytes,
          row_counts: result.rowCounts,
        });
      } catch (err: any) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    if (action === "restore") {
      const { backup_id, backup_data, strategy, tables: requestedTables } = body;

      if (!strategy || !["merge", "replace"].includes(strategy)) {
        return jsonResponse({ error: "Strategy must be 'merge' or 'replace'" }, 400);
      }
      if (!backup_id && !backup_data) {
        return jsonResponse({ error: "Either backup_id or backup_data is required" }, 400);
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
        if (backupRecord.status !== "completed") {
          return jsonResponse({ error: "Can only restore from completed backups" }, 400);
        }
        if (!backupRecord.storage_path) {
          return jsonResponse({ error: "Backup file not found in storage" }, 404);
        }

        const { data: fileBlob, error: dlErr } = await adminClient.storage
          .from("database-backups")
          .download(backupRecord.storage_path);

        if (dlErr || !fileBlob) {
          return jsonResponse({ error: `Failed to download backup: ${dlErr?.message}` }, 500);
        }

        sourceData = JSON.parse(await fileBlob.text());
      } else {
        sourceData = backup_data;
      }

      if (!sourceData._metadata || typeof sourceData._metadata !== "object") {
        return jsonResponse({ error: "Invalid backup format: missing _metadata" }, 400);
      }

      const allBackupTables = Object.keys(sourceData).filter(
        (k) => k !== "_metadata" && !SYSTEM_TABLES.has(k)
      );

      if (allBackupTables.length === 0) {
        return jsonResponse({ error: "No restorable tables found in backup" }, 400);
      }

      const tablesToRestore: string[] = requestedTables && Array.isArray(requestedTables)
        ? requestedTables.filter((t: string) => allBackupTables.includes(t) && !SYSTEM_TABLES.has(t))
        : allBackupTables;

      if (tablesToRestore.length === 0) {
        return jsonResponse({ error: "No valid tables selected for restore" }, 400);
      }

      const { data: fkRows } = await adminClient.rpc("admin_get_foreign_keys");
      const fkDeps = new Map<string, Set<string>>();
      if (fkRows && Array.isArray(fkRows)) {
        for (const fk of fkRows) {
          if (!fkDeps.has(fk.source_table)) fkDeps.set(fk.source_table, new Set());
          if (fk.source_table !== fk.target_table) {
            fkDeps.get(fk.source_table)!.add(fk.target_table);
          }
        }
      }

      const insertOrder = topologicalSort(tablesToRestore, fkDeps);
      const deleteOrder = [...insertOrder].reverse();

      const { data: pkRows } = await adminClient.rpc("admin_get_table_columns", {
        p_table_name: tablesToRestore[0],
      });

      const pkMap = new Map<string, string>();
      for (const table of tablesToRestore) {
        const { data: cols } = await adminClient.rpc("admin_get_table_columns", {
          p_table_name: table,
        });
        if (cols && Array.isArray(cols)) {
          const pk = cols.find((c: any) => c.is_primary_key);
          if (pk) pkMap.set(table, pk.column_name);
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
      } catch (snapErr: any) {
        return jsonResponse({
          error: `Failed to create safety snapshot: ${snapErr.message}. Restore aborted.`,
        }, 500);
      }

      const { data: restoreRecord, error: restoreInsertErr } = await adminClient
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
        })
        .select("id")
        .single();

      if (restoreInsertErr) {
        return jsonResponse({ error: `Failed to create restore record: ${restoreInsertErr.message}` }, 500);
      }

      const restoreId = restoreRecord.id;
      const restoreRowCounts: Record<string, number> = {};
      const tableErrors: Record<string, string> = {};

      try {
        if (strategy === "replace") {
          for (const table of deleteOrder) {
            const { error: delErr } = await adminClient
              .from(table)
              .delete()
              .gte("created_at", "1970-01-01T00:00:00Z");

            if (delErr) {
              tableErrors[table] = `Delete failed: ${delErr.message}`;
            }
          }
        }

        for (const table of insertOrder) {
          const rows = sourceData[table];
          if (!Array.isArray(rows) || rows.length === 0) {
            restoreRowCounts[table] = 0;
            continue;
          }

          if (tableErrors[table]) continue;

          const pk = pkMap.get(table) || "id";

          if (strategy === "merge") {
            const batchSize = 500;
            let restored = 0;
            for (let i = 0; i < rows.length; i += batchSize) {
              const batch = rows.slice(i, i + batchSize);
              const { error: upsertErr } = await adminClient
                .from(table)
                .upsert(batch, { onConflict: pk });

              if (upsertErr) {
                tableErrors[table] = `Upsert failed at batch ${Math.floor(i / batchSize)}: ${upsertErr.message}`;
                break;
              }
              restored += batch.length;
            }
            restoreRowCounts[table] = restored;
          } else {
            const batchSize = 500;
            let restored = 0;
            for (let i = 0; i < rows.length; i += batchSize) {
              const batch = rows.slice(i, i + batchSize);
              const { error: insertErr } = await adminClient
                .from(table)
                .insert(batch);

              if (insertErr) {
                tableErrors[table] = `Insert failed at batch ${Math.floor(i / batchSize)}: ${insertErr.message}`;
                break;
              }
              restored += batch.length;
            }
            restoreRowCounts[table] = restored;
          }
        }

        const hasErrors = Object.keys(tableErrors).length > 0;
        const finalStatus = hasErrors ? "failed" : "completed";

        await adminClient
          .from("database_backups")
          .update({
            status: finalStatus,
            row_counts: restoreRowCounts,
            error_message: hasErrors ? JSON.stringify(tableErrors) : null,
            completed_at: new Date().toISOString(),
            metadata: { pre_restore_backup_id: preRestoreBackupId, table_errors: tableErrors },
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

        return jsonResponse({
          restore_id: restoreId,
          pre_restore_backup_id: preRestoreBackupId,
          status: finalStatus,
          tables_restored: tablesToRestore,
          row_counts: restoreRowCounts,
          errors: hasErrors ? tableErrors : undefined,
        });
      } catch (restoreErr: any) {
        await adminClient
          .from("database_backups")
          .update({
            status: "failed",
            error_message: restoreErr.message,
            completed_at: new Date().toISOString(),
            metadata: { pre_restore_backup_id: preRestoreBackupId },
          })
          .eq("id", restoreId);

        return jsonResponse({ error: restoreErr.message, pre_restore_backup_id: preRestoreBackupId }, 500);
      }
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err: any) {
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
});
