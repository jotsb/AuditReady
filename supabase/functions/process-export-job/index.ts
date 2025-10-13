import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3";
import { SMTPClient } from "npm:emailjs@4.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExportJobRequest {
  businessId: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { businessId }: ExportJobRequest = await req.json();

    if (!businessId) {
      return new Response(
        JSON.stringify({ error: "Business ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get auth user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Export requested by user: ${user.id}, email: ${user.email}`);

    // Create export job
    const { data: job, error: jobError } = await supabase
      .from("export_jobs")
      .insert({
        business_id: businessId,
        requested_by: user.id,
        status: "pending",
        export_type: "full_business",
      })
      .select()
      .single();

    console.log(`Created export job ${job?.id} for user ${user.id}`);

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Failed to create export job" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process export asynchronously (don't await)
    processExport(supabase, job.id, businessId).catch(console.error);

    return new Response(
      JSON.stringify({ 
        success: true, 
        jobId: job.id,
        message: "Export job started. You'll be notified when complete." 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Export job error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function processExport(supabase: any, jobId: string, businessId: string) {
  try {
    // Update status to processing
    await supabase
      .from("export_jobs")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", jobId);

    // Fetch business data
    const { data: business } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", businessId)
      .single();

    // Fetch collections
    const { data: collections } = await supabase
      .from("collections")
      .select("*")
      .eq("business_id", businessId);

    // Fetch receipts (include soft-deleted for exports)
    const collectionIds = collections?.map((c: any) => c.id) || [];
    let receipts: any[] = [];

    if (collectionIds.length > 0) {
      const { data: receiptsData, error: receiptsError } = await supabase
        .from("receipts")
        .select("*")
        .in("collection_id", collectionIds)
        .is("deleted_at", null);

      if (receiptsError) {
        console.error("Error fetching receipts:", receiptsError);
      }

      receipts = receiptsData || [];
      console.log(`Fetched ${receipts.length} receipts for ${collectionIds.length} collections`);
    }

    // Fetch members
    const { data: businessMembers } = await supabase
      .from("business_members")
      .select("role, user_id, created_at")
      .eq("business_id", businessId);

    const members = await Promise.all(
      (businessMembers || []).map(async (member: any) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", member.user_id)
          .single();
        return { ...member, profile };
      })
    );

    // Create ZIP
    const zip = new JSZip();

    // Add metadata JSON
    const exportData = {
      business,
      collections,
      receipts: receipts.map((r: any) => ({
        id: r.id,
        merchant_name: r.merchant_name,
        amount: r.amount,
        currency: r.currency,
        date: r.date,
        category: r.category,
        notes: r.notes,
        verified: r.verified,
        collection_id: r.collection_id,
        created_at: r.created_at,
      })),
      members: members.map((m: any) => ({
        role: m.role,
        email: m.profile?.email,
        full_name: m.profile?.full_name,
        joined_at: m.created_at,
      })),
      exported_at: new Date().toISOString(),
      export_version: "2.0",
    };

    zip.file("business_data.json", JSON.stringify(exportData, null, 2));

    // Add CSV files organized by collection
    for (const collection of collections || []) {
      const collectionReceipts = receipts.filter((r: any) => r.collection_id === collection.id);

      if (collectionReceipts.length > 0) {
        console.log(`Generating CSV for collection "${collection.name}" with ${collectionReceipts.length} receipts`);
        console.log("Sample receipt data:", JSON.stringify(collectionReceipts[0], null, 2));
        const csv = generateCSV(collectionReceipts);
        const folderName = collection.name.replace(/[^a-z0-9]/gi, "_");
        zip.file(`${folderName}/receipts.csv`, csv);
      }
    }

    // Download receipt images
    const receiptsFolder = zip.folder("receipts");
    let downloadedCount = 0;

    for (const receipt of receipts) {
      if (receipt.file_path && receiptsFolder) {
        try {
          const { data: fileData } = await supabase.storage
            .from("receipts")
            .download(receipt.file_path);

          if (fileData) {
            const fileName = `${receipt.id}_${(receipt.merchant_name || "receipt").replace(/[^a-z0-9]/gi, "_")}.jpg`;
            const arrayBuffer = await fileData.arrayBuffer();
            receiptsFolder.file(fileName, arrayBuffer);
            downloadedCount++;
          }
        } catch (err) {
          console.error("Failed to download receipt:", receipt.id, err);
        }
      }
    }

    // Generate ZIP
    const zipBlob = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });

    // Upload to storage
    const fileName = `exports/${businessId}/${jobId}.zip`;
    const { error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(fileName, zipBlob, {
        contentType: "application/zip",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Update job as completed
    await supabase
      .from("export_jobs")
      .update({
        status: "completed",
        file_path: fileName,
        file_size_bytes: zipBlob.length,
        progress_percent: 100,
        completed_at: new Date().toISOString(),
        metadata: {
          receipts_count: receipts.length,
          images_downloaded: downloadedCount,
          collections_count: collections?.length || 0,
        },
      })
      .eq("id", jobId);

    // Get user email for notification
    const { data: jobData, error: jobDataError } = await supabase
      .from("export_jobs")
      .select("requested_by")
      .eq("id", jobId)
      .single();

    console.log(`Job data for notification: requested_by=${jobData?.requested_by}, error=${jobDataError?.message}`);

    if (jobData?.requested_by) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", jobData.requested_by)
        .single();

      console.log(`Profile for notification: email=${profile?.email}, full_name=${profile?.full_name}, error=${profileError?.message}`);

      if (profile?.email) {
        const smtpHost = Deno.env.get("SMTP_HOST");
        const smtpPort = Deno.env.get("SMTP_PORT");
        const smtpUser = Deno.env.get("SMTP_USER");
        const smtpPassword = Deno.env.get("SMTP_PASSWORD");
        const appUrl = Deno.env.get("APP_URL") || "https://auditproof.ca";

        const emailHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">Your Export is Ready!</h1>
                </div>
                <div style="background: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                    Hello ${profile.full_name || "there"}!
                  </p>
                  <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                    Your data export for <strong>${business?.name}</strong> is ready to download.
                  </p>
                  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0; color: #4b5563;"><strong>Export Details:</strong></p>
                    <p style="margin: 5px 0; color: #6b7280;">• ${receipts.length} receipts</p>
                    <p style="margin: 5px 0; color: #6b7280;">• ${downloadedCount} images</p>
                    <p style="margin: 5px 0; color: #6b7280;">• ${collections?.length || 0} collections</p>
                    <p style="margin: 5px 0; color: #6b7280;">• File size: ${(zipBlob.length / 1048576).toFixed(2)} MB</p>
                  </div>
                  <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                    Click the button below to go to your Settings page and download the export:
                  </p>
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${appUrl}/settings?tab=businesses" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Download Export</a>
                  </div>
                  <p style="color: #ef4444; font-size: 14px; line-height: 1.6; margin-top: 30px; padding: 15px; background: #fee2e2; border-radius: 8px;">
                    <strong>Important:</strong> This export will expire in 7 days. Please download it soon!
                  </p>
                  <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                    The export includes:
                  </p>
                  <ul style="color: #666; font-size: 14px; line-height: 1.8; margin-top: 10px;">
                    <li>Complete business data (JSON format)</li>
                    <li>CSV files organized by collection</li>
                    <li>All receipt images</li>
                  </ul>
                </div>
                <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
                  <p>© ${new Date().getFullYear()} Audit Proof. All rights reserved.</p>
                </div>
              </div>
            </body>
          </html>
        `;

        const emailText = `
Your Export is Ready!

Your data export for ${business?.name} is ready to download.

Export Details:
- ${receipts.length} receipts
- ${downloadedCount} images
- ${collections?.length || 0} collections
- File size: ${(zipBlob.length / 1048576).toFixed(2)} MB

Visit ${appUrl}/settings?tab=businesses to download your export.

IMPORTANT: This export will expire in 7 days. Please download it soon!

The export includes:
- Complete business data (JSON format)
- CSV files organized by collection
- All receipt images
        `;

        // Create audit log entry
        await supabase.from("audit_logs").insert({
          user_id: jobData.requested_by,
          action: "export_completed",
          resource_type: "export_job",
          resource_id: jobId,
          details: {
            business_id: businessId,
            business_name: business?.name,
            file_size: zipBlob.length,
            receipts_count: receipts.length,
            notification_sent: !!(smtpHost && smtpPort && smtpUser && smtpPassword),
            user_email: profile.email,
          },
        });

        // Send email via SMTP if configured
        if (smtpHost && smtpPort && smtpUser && smtpPassword) {
          try {
            const client = new SMTPClient({
              user: smtpUser,
              password: smtpPassword,
              host: smtpHost,
              port: parseInt(smtpPort),
              ssl: true,
            });

            console.log(`Sending export notification email to: ${profile.email} for business: ${business?.name}`);

            const message = {
              from: `Audit Proof <${smtpUser}>`,
              to: profile.email,
              subject: `Your ${business?.name} Export is Ready!`,
              text: emailText,
              attachment: [
                {
                  data: emailHtml,
                  alternative: true,
                },
              ],
            };

            const headers: Record<string, string> = {
              'X-Mailer': 'Audit Proof',
              'X-Priority': '3',
              'X-MSMail-Priority': 'Normal',
              'Importance': 'Normal',
              'MIME-Version': '1.0',
              'Message-ID': `<${Date.now()}.${Math.random().toString(36).substring(2)}@auditproof.ca>`,
              'Reply-To': smtpUser,
              'From': `Audit Proof <noreply@auditproof.ca>`,
              'Return-Path': smtpUser,
              'Content-Type': 'multipart/alternative',
            };

            await client.sendAsync({
              ...message,
              headers,
            });

            console.log("Export notification email sent to:", profile.email);
          } catch (emailError) {
            console.error("Error sending email:", emailError);
          }
        } else {
          console.log("SMTP not configured, skipping email notification");
        }
      }
    }

    console.log("Export completed successfully:", jobId);
  } catch (error: any) {
    console.error("Export processing failed:", error);
    
    // Mark job as failed
    await supabase
      .from("export_jobs")
      .update({
        status: "failed",
        error_message: error.message || "Unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }
}

function generateCSV(receipts: any[]): string {
  if (receipts.length === 0) return "No receipts";

  const headers = ["Date", "Merchant", "Amount", "Currency", "Category", "Notes", "Verified", "Created At"];

  const rows = receipts.map((r: any) => {
    const row = [
      r.date || "",
      r.merchant_name || "",
      r.amount !== null && r.amount !== undefined ? String(r.amount) : "",
      r.currency || "",
      r.category || "",
      r.notes || "",
      r.verified ? "Yes" : "No",
      r.created_at || "",
    ];

    return row;
  });

  const csvContent = [
    headers.join(","),
    ...rows.map((row: any[]) =>
      row.map((cell: any) => {
        const cellStr = String(cell);
        if (cellStr.includes(",") || cellStr.includes("\"") || cellStr.includes("\n")) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(",")
    ),
  ].join("\n");

  return csvContent;
}
