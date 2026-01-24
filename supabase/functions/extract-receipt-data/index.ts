import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  validateUUID,
  validateString,
  validateRequestBody,
  validateAmount,
  validateDate,
  INPUT_LIMITS
} from "../_shared/validation.ts";
import { compressImage, getImageFormat } from "../_shared/imageCompression.ts";
import { getIPAddress } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExtractRequest {
  filePath?: string;
  filePaths?: string[];
  collectionId: string;
  isMultiPage?: boolean;
  parentReceiptId?: string;
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

  // Rate limiting check - 10 uploads per hour per IP
  const ipAddress = getIPAddress(req);
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  // Get user ID from token if available
  let userId: string | null = null;
  if (token) {
    const { data: { user } } = await supabase.auth.getUser(token);
    userId = user?.id || null;
  }

  // Create identifier: userId if available, otherwise IP
  const identifier = userId || ipAddress;

  // Check rate limit: 50 uploads per hour (increased for batch processing)
  const { data: rateLimitResult } = await supabase.rpc('check_rate_limit', {
    p_identifier: identifier,
    p_action_type: 'upload',
    p_max_attempts: 50,
    p_window_minutes: 60
  });

  if (rateLimitResult && !rateLimitResult.allowed) {
    const minutesRemaining = Math.ceil(rateLimitResult.retryAfter / 60);
    return new Response(
      JSON.stringify({
        success: false,
        error: `Rate limit exceeded. You can upload again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`,
        retryAfter: rateLimitResult.retryAfter
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Retry-After': rateLimitResult.retryAfter.toString()
        }
      }
    );
  }

  let requestData: ExtractRequest | null = null;

  try {
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const bodyValidation = await validateRequestBody(req);
    if (!bodyValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: bodyValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    requestData = bodyValidation.data;
    const { filePath, filePaths, collectionId, isMultiPage = false } = requestData;

    let pathsToProcess: string[];

    if (isMultiPage) {
      if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'filePaths array is required for multi-page receipts' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      pathsToProcess = filePaths;
    } else {
      if (!filePath) {
        return new Response(
          JSON.stringify({ success: false, error: 'filePath is required for single-page receipts' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      pathsToProcess = [filePath];
    }

    for (const path of pathsToProcess) {
      if (!path || typeof path !== 'string') {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid file path in array' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const filePathValidation = validateString(path, 'filePath', 500, true);
      if (!filePathValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: filePathValidation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const collectionIdValidation = validateUUID(collectionId);
    if (!collectionIdValidation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: collectionIdValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await supabase.rpc('log_system_event', {
      p_level: 'INFO',
      p_category: 'EDGE_FUNCTION',
      p_message: isMultiPage ? 'Multi-page receipt extraction started' : 'Receipt extraction started',
      p_metadata: { filePath, filePaths, collectionId, isMultiPage, pageCount: pathsToProcess.length, function: 'extract-receipt-data' },
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

    const imageUrls: Array<{ type: string; image_url: { url: string } }> = [];

    for (const path of pathsToProcess) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("receipts")
        .download(path);

      if (downloadError) {
        throw downloadError;
      }

      const lowerFilePath = path.toLowerCase();
      let arrayBuffer = await fileData.arrayBuffer();

      if (lowerFilePath.endsWith(".pdf")) {
        throw new Error("PDF files must be converted to images before upload. This error shouldn't occur if the client validation is working properly.");
      } else {
        const imageFormat = getImageFormat(path);

        const compressedBuffer = await compressImage(arrayBuffer, imageFormat, {
          maxWidth: 1024,
          maxHeight: 1024,
          quality: 0.85
        });

        const base64File = arrayBufferToBase64(compressedBuffer);
        const dataUrl = `data:image/${imageFormat};base64,${base64File}`;

        imageUrls.push({
          type: "image_url",
          image_url: { url: dataUrl }
        });
      }
    }

    const jsonFormat = `{\n  "vendor_name": "business name",\n  "vendor_address": "full address if visible",\n  "transaction_date": "YYYY-MM-DD format",\n  "transaction_time": "HH:MM format if visible",\n  "total_amount": "numeric value only",\n  "subtotal": "numeric value only",\n  "gst_amount": "GST/tax amount if visible",\n  "pst_amount": "PST amount if visible",\n  "gst_percent": "GST percentage if visible (just number)",\n  "pst_percent": "PST percentage if visible (just number)",\n  "card_last_digits": "last 4 digits of card if visible",\n  "customer_name": "customer name if visible",\n  "category": "Choose from: ${categoryList}",\n  "payment_method": "Cash, Credit Card, Debit Card, or Unknown"\n}`;

    const rules = `\\nRules:\\n- Return ONLY the JSON object, no other text\\n- Use null for missing string values\\n- Use 0 for missing amounts\\n- For category: Choose the MOST APPROPRIATE category from the provided list. If none match well, use "Miscellaneous"\\n- Extract amounts without currency symbols or percentage signs`;

    const promptText = isMultiPage
      ? `Analyze this multi-page receipt (${pathsToProcess.length} pages) and extract the following information. The images are in order (page 1, 2, 3...). Consider all pages together as ONE receipt. Combine information from all pages - for example, if the vendor name is on page 1 and the total is on page 3, extract both. Return ONLY a valid JSON object with no additional text:\\n\\n${jsonFormat}${rules}`
      : `Analyze this receipt and extract the following information. Return ONLY a valid JSON object with no additional text:\\n\\n${jsonFormat}${rules}`;

    const requestPayload = {
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptText
            },
            ...imageUrls
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1
    };

    await supabase.rpc('log_system_event', {
      p_level: 'INFO',
      p_category: 'EXTERNAL_API',
      p_message: 'Sending request to OpenAI API',
      p_metadata: {
        filePath,
        collectionId,
        model: requestPayload.model,
        prompt: promptText,
        maxTokens: requestPayload.max_tokens
      },
      p_user_id: null,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
      p_stack_trace: null,
      p_execution_time_ms: null
    });

    const apiStartTime = Date.now();
    let openaiResponse;

    try {
      openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify(requestPayload),
      });
    } catch (fetchError) {
      const apiExecutionTime = Date.now() - apiStartTime;
      const fetchErrorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';

      await supabase.rpc('log_system_event', {
        p_level: 'ERROR',
        p_category: 'EXTERNAL_API',
        p_message: 'Failed to fetch from OpenAI API',
        p_metadata: {
          filePath,
          collectionId,
          error: fetchErrorMessage,
          errorType: 'NetworkError'
        },
        p_user_id: null,
        p_session_id: null,
        p_ip_address: null,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: fetchError instanceof Error ? fetchError.stack : null,
        p_execution_time_ms: apiExecutionTime
      });

      throw new Error(`Failed to reach OpenAI API: ${fetchErrorMessage}`);
    }

    const apiExecutionTime = Date.now() - apiStartTime;

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();

      await supabase.rpc('log_system_event', {
        p_level: 'ERROR',
        p_category: 'EXTERNAL_API',
        p_message: 'OpenAI API returned error',
        p_metadata: {
          filePath,
          collectionId,
          statusCode: openaiResponse.status,
          errorResponse: errorText
        },
        p_user_id: null,
        p_session_id: null,
        p_ip_address: null,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: null,
        p_execution_time_ms: apiExecutionTime
      });

      throw new Error(`OpenAI API error (${openaiResponse.status}): ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const responseText = openaiData.choices[0].message.content;

    await supabase.rpc('log_system_event', {
      p_level: 'INFO',
      p_category: 'EXTERNAL_API',
      p_message: 'Received response from OpenAI API',
      p_metadata: {
        filePath,
        collectionId,
        model: openaiData.model,
        responseContent: responseText,
        usage: openaiData.usage
      },
      p_user_id: null,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
      p_stack_trace: null,
      p_execution_time_ms: apiExecutionTime
    });

    if (!responseText || responseText.trim() === "") {
      throw new Error("Empty response from OpenAI API");
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`Could not parse JSON from response. Response was: ${responseText}`);
    }

    const extractedData = JSON.parse(jsonMatch[0]);

    const validatedData: any = {};

    if (extractedData.vendor_name) {
      const vendorValidation = validateString(extractedData.vendor_name, 'vendor_name', INPUT_LIMITS.vendor_name, false);
      let vendorName = vendorValidation.valid ? vendorValidation.sanitized : null;

      if (vendorName) {
        const lowerVendor = vendorName.toLowerCase();
        if (lowerVendor.includes('cardlock') || lowerVendor.includes('card lock') ||
            lowerVendor.includes('petro canada cardlock') || lowerVendor.includes('esso cardlock') ||
            lowerVendor.includes('shell cardlock') || lowerVendor.includes('husky cardlock')) {
          vendorName = 'Cardlock Invoice';
        }
      }

      validatedData.vendor_name = vendorName;
    } else {
      validatedData.vendor_name = null;
    }

    if (extractedData.vendor_address) {
      const addressValidation = validateString(extractedData.vendor_address, 'vendor_address', INPUT_LIMITS.vendor_address, false);
      validatedData.vendor_address = addressValidation.valid ? addressValidation.sanitized : null;
    } else {
      validatedData.vendor_address = null;
    }

    if (extractedData.transaction_date) {
      const dateValidation = validateDate(extractedData.transaction_date);
      validatedData.transaction_date = dateValidation.valid ? dateValidation.sanitized : null;
    } else {
      validatedData.transaction_date = null;
    }

    const amountFields = ['total_amount', 'subtotal', 'gst_amount', 'pst_amount'];
    for (const field of amountFields) {
      if (extractedData[field] !== null && extractedData[field] !== undefined) {
        const amountValidation = validateAmount(extractedData[field], field);
        validatedData[field] = amountValidation.valid ? parseFloat(amountValidation.sanitized!) : 0;
      } else {
        validatedData[field] = 0;
      }
    }

    if (extractedData.category) {
      const categoryValidation = validateString(extractedData.category, 'category', INPUT_LIMITS.category, false);
      validatedData.category = categoryValidation.valid ? categoryValidation.sanitized : 'Miscellaneous';
    } else {
      validatedData.category = 'Miscellaneous';
    }

    if (extractedData.payment_method) {
      const paymentValidation = validateString(extractedData.payment_method, 'payment_method', INPUT_LIMITS.payment_method, false);
      validatedData.payment_method = paymentValidation.valid ? paymentValidation.sanitized : 'Unknown';
    } else {
      validatedData.payment_method = 'Unknown';
    }

    validatedData.transaction_time = extractedData.transaction_time || null;
    validatedData.gst_percent = extractedData.gst_percent || null;
    validatedData.pst_percent = extractedData.pst_percent || null;
    validatedData.card_last_digits = extractedData.card_last_digits || null;
    validatedData.customer_name = extractedData.customer_name || null;

    const executionTime = Date.now() - startTime;

    await supabase.rpc('log_system_event', {
      p_level: 'INFO',
      p_category: 'EDGE_FUNCTION',
      p_message: 'Receipt extraction completed successfully',
      p_metadata: {
        filePath: requestData?.filePath,
        collectionId: requestData?.collectionId,
        function: 'extract-receipt-data',
        extractedVendor: validatedData.vendor_name
      },
      p_user_id: null,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
      p_stack_trace: null,
      p_execution_time_ms: executionTime
    });

    return new Response(
      JSON.stringify({ success: true, data: validatedData }),
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