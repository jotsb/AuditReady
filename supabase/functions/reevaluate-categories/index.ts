import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReevaluateRequest {
  businessId: string;
  newCategoryName: string;
  categoryDescription?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ReevaluateRequest = await req.json();
    const { businessId, newCategoryName, categoryDescription } = body;

    if (!businessId || !newCategoryName) {
      return new Response(
        JSON.stringify({ success: false, error: 'businessId and newCategoryName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: memberCheck } = await supabase
      .from('business_members')
      .select('role')
      .eq('business_id', businessId)
      .eq('user_id', user.id)
      .single();

    if (!memberCheck || !['owner', 'admin', 'manager'].includes(memberCheck.role)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Insufficient permissions' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: suggestionsCount, error: genError } = await supabase.rpc(
      'generate_category_suggestions',
      {
        p_business_id: businessId,
        p_new_category_name: newCategoryName,
        p_category_description: categoryDescription || newCategoryName
      }
    );

    if (genError) {
      throw genError;
    }

    await supabase.rpc('log_system_event', {
      p_level: 'INFO',
      p_category: 'EDGE_FUNCTION',
      p_message: 'Category re-evaluation completed',
      p_metadata: {
        businessId,
        newCategoryName,
        suggestionsGenerated: suggestionsCount,
        function: 'reevaluate-categories'
      },
      p_user_id: user.id,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
      p_stack_trace: null,
      p_execution_time_ms: null
    });

    return new Response(
      JSON.stringify({
        success: true,
        suggestionsCount: suggestionsCount || 0,
        message: suggestionsCount > 0
          ? `Found ${suggestionsCount} receipt(s) that might belong to "${newCategoryName}"`
          : `No receipts found matching "${newCategoryName}"`
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Re-evaluation error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

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
