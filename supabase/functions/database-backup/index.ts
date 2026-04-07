import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: adminCheck } = await adminClient
      .from("system_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminCheck) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { name, description, tables } = body;

      if (!name || !tables || !Array.isArray(tables) || tables.length === 0) {
        return new Response(
          JSON.stringify({ error: "Name and tables are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: backupRecord, error: insertError } = await adminClient
        .from("database_backups")
        .insert({
          name,
          description: description || null,
          status: "in_progress",
          backup_type: "manual",
          tables_included: tables,
          created_by: user.id,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const backupId = backupRecord.id;

      try {
        const backupData: Record<string, unknown> = {
          _metadata: {
            backup_id: backupId,
            name,
            description,
            created_at: new Date().toISOString(),
            created_by: user.id,
            tables: tables,
          },
        };

        const rowCounts: Record<string, number> = {};

        for (const tableName of tables) {
          const safeName = tableName.replace(/[^a-zA-Z0-9_]/g, "");
          const { data: tableData, error: queryError } = await adminClient
            .from(safeName)
            .select("*")
            .limit(10000);

          if (queryError) {
            backupData[safeName] = { error: queryError.message, rows: [] };
            rowCounts[safeName] = 0;
          } else {
            backupData[safeName] = tableData || [];
            rowCounts[safeName] = (tableData || []).length;
          }
        }

        const jsonStr = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const storagePath = `${backupId}/${name.replace(/\s+/g, "_")}.json`;

        const { error: uploadError } = await adminClient.storage
          .from("database-backups")
          .upload(storagePath, blob, {
            contentType: "application/json",
            upsert: true,
          });

        if (uploadError) {
          await adminClient
            .from("database_backups")
            .update({
              status: "failed",
              error_message: `Upload failed: ${uploadError.message}`,
              completed_at: new Date().toISOString(),
            })
            .eq("id", backupId);

          return new Response(
            JSON.stringify({ error: uploadError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
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

        await adminClient.from("audit_logs").insert({
          user_id: user.id,
          action: "create_backup",
          resource_type: "database_backup",
          resource_id: backupId,
          details: {
            name,
            tables_count: tables.length,
            size_bytes: blob.size,
            row_counts: rowCounts,
          },
        });

        return new Response(
          JSON.stringify({
            backup_id: backupId,
            status: "completed",
            size_bytes: blob.size,
            row_counts: rowCounts,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (backupError: any) {
        await adminClient
          .from("database_backups")
          .update({
            status: "failed",
            error_message: backupError.message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", backupId);

        return new Response(
          JSON.stringify({ error: backupError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
