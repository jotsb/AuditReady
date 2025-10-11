import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3";

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
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Fetch receipts
    const collectionIds = collections?.map((c: any) => c.id) || [];
    let receipts: any[] = [];

    if (collectionIds.length > 0) {
      const { data: receiptsData } = await supabase
        .from("receipts")
        .select("*")
        .in("collection_id", collectionIds);
      receipts = receiptsData || [];
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
  const rows = receipts.map((r: any) => [
    r.date || "",
    r.merchant_name || "",
    r.amount || "",
    r.currency || "",
    r.category || "",
    r.notes || "",
    r.verified ? "Yes" : "No",
    r.created_at || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row: any[]) => row.map((cell: any) => `\"${String(cell).replace(/\"/g, '\"\"')}\"` ).join(",")),
  ].join("\n");

  return csvContent;
}
