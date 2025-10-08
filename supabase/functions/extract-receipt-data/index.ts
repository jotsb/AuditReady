import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExtractRequest {
  filePath: string;
  collectionId: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let requestData: ExtractRequest | null = null;

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    requestData = await req.json();
    const { filePath, collectionId } = requestData;

    // Log edge function start
    await supabase.rpc('log_system_event', {
      p_level: 'INFO',
      p_category: 'EDGE_FUNCTION',
      p_message: 'Receipt extraction started',
      p_metadata: { filePath, collectionId, function: 'extract-receipt-data' },
      p_user_id: null,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
      p_stack_trace: null,
      p_execution_time_ms: null
    });

    let categoryList = "Miscellaneous";
    const { data: categories } = await supabase
      .from("expense_categories")
      .select("name")
      .order("display_order");

    if (categories && categories.length > 0) {
      categoryList = categories.map(c => c.name).join(", ");
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("receipts")
      .download(filePath);

    if (downloadError) {
      throw downloadError;
    }

    const lowerFilePath = filePath.toLowerCase();
    const arrayBuffer = await fileData.arrayBuffer();
    const base64File = arrayBufferToBase64(arrayBuffer);
    
    let imageFormat = "jpeg";
    if (lowerFilePath.endsWith(".png")) {
      imageFormat = "png";
    } else if (lowerFilePath.endsWith(".jpg") || lowerFilePath.endsWith(".jpeg")) {
      imageFormat = "jpeg";
    } else if (lowerFilePath.endsWith(".gif")) {
      imageFormat = "gif";
    } else if (lowerFilePath.endsWith(".webp")) {
      imageFormat = "webp";
    }
    
    const dataUrl = `data:image/${imageFormat};base64,${base64File}`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this receipt and extract the following information. Return ONLY a valid JSON object with no additional text:\n\n{\n  \"vendor_name\": \"business name\",\n  \"vendor_address\": \"full address if visible\",\n  \"transaction_date\": \"YYYY-MM-DD format\",\n  \"transaction_time\": \"HH:MM format if visible\",\n  \"total_amount\": \"numeric value only\",\n  \"subtotal\": \"numeric value only\",\n  \"gst_amount\": \"GST/tax amount if visible\",\n  \"pst_amount\": \"PST amount if visible\",\n  \"gst_percent\": \"GST percentage if visible (just number)\",\n  \"pst_percent\": \"PST percentage if visible (just number)\",\n  \"card_last_digits\": \"last 4 digits of card if visible\",\n  \"customer_name\": \"customer name if visible\",\n  \"category\": \"Choose from: ${categoryList}\",\n  \"payment_method\": \"Cash, Credit Card, Debit Card, or Unknown\"\n}\n\nRules:\n- Return ONLY the JSON object, no other text\n- Use null for missing string values\n- Use 0 for missing amounts\n- For category: Choose the MOST APPROPRIATE category from the provided list. If none match well, use \"Miscellaneous\"\n- Extract amounts without currency symbols or percentage signs`
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        max_completion_tokens: 500,
        temperature: 0.1
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const responseText = openaiData.choices[0].message.content;
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from response: " + responseText);
    }
    
    const extractedData = JSON.parse(jsonMatch[0]);

    const executionTime = Date.now() - startTime;

    // Log successful extraction
    await supabase.rpc('log_system_event', {
      p_level: 'INFO',
      p_category: 'EDGE_FUNCTION',
      p_message: 'Receipt extraction completed successfully',
      p_metadata: {
        filePath: requestData?.filePath,
        collectionId: requestData?.collectionId,
        function: 'extract-receipt-data',
        extractedVendor: extractedData.vendor_name
      },
      p_user_id: null,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
      p_stack_trace: null,
      p_execution_time_ms: executionTime
    });

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Extraction error:", error);

    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const stackTrace = error instanceof Error ? error.stack : null;

    // Log error
    await supabase.rpc('log_system_event', {
      p_level: 'ERROR',
      p_category: 'EDGE_FUNCTION',
      p_message: `Receipt extraction failed: ${errorMessage}`,
      p_metadata: {
        filePath: requestData?.filePath,
        collectionId: requestData?.collectionId,
        function: 'extract-receipt-data',
        error: errorMessage
      },
      p_user_id: null,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
      p_stack_trace: stackTrace,
      p_execution_time_ms: executionTime
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});