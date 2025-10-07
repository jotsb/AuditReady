import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChangePasswordRequest {
  action: 'change_password';
  targetUserId: string;
  newPassword: string;
}

interface HardDeleteRequest {
  action: 'hard_delete';
  targetUserId: string;
}

interface UpdateEmailRequest {
  action: 'update_email';
  targetUserId: string;
  newEmail: string;
}

interface ForceLogoutRequest {
  action: 'force_logout';
  targetUserId: string;
}

type AdminRequest = ChangePasswordRequest | HardDeleteRequest | UpdateEmailRequest | ForceLogoutRequest;

async function checkSystemAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('system_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (error) {
    console.error('Error checking admin status:', error);
    return false;
  }

  return !!data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get the JWT from the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is system admin
    const isAdmin = await checkSystemAdmin(supabase, user.id);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: System admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: AdminRequest = await req.json();

    // Handle different actions
    switch (requestData.action) {
      case 'change_password': {
        const { targetUserId, newPassword } = requestData;

        // Update password using admin API
        const { error: pwError } = await supabase.auth.admin.updateUserById(
          targetUserId,
          { password: newPassword }
        );

        if (pwError) {
          throw new Error(`Failed to update password: ${pwError.message}`);
        }

        // Log the action
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'change_user_password',
          resource_type: 'auth',
          resource_id: targetUserId,
          details: { method: 'admin_override', via: 'edge_function' }
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Password updated successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'hard_delete': {
        const { targetUserId } = requestData;

        // Check if user is soft deleted first
        const { data: profile } = await supabase
          .from('profiles')
          .select('deleted_at')
          .eq('id', targetUserId)
          .maybeSingle();

        if (!profile?.deleted_at) {
          return new Response(
            JSON.stringify({ error: 'User must be soft deleted before hard delete' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Log before deletion
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'hard_delete_user',
          resource_type: 'profile',
          resource_id: targetUserId,
          details: { permanent: true, via: 'edge_function' }
        });

        // Delete user (cascades to profiles and other tables)
        const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);

        if (deleteError) {
          throw new Error(`Failed to delete user: ${deleteError.message}`);
        }

        return new Response(
          JSON.stringify({ success: true, message: 'User permanently deleted' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_email': {
        const { targetUserId, newEmail } = requestData;

        // Update email using admin API
        const { error: emailError } = await supabase.auth.admin.updateUserById(
          targetUserId,
          { email: newEmail }
        );

        if (emailError) {
          throw new Error(`Failed to update email: ${emailError.message}`);
        }

        // Also update profile email
        await supabase
          .from('profiles')
          .update({ email: newEmail })
          .eq('id', targetUserId);

        // Log the action
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'update_user_email',
          resource_type: 'auth',
          resource_id: targetUserId,
          details: { new_email: newEmail, via: 'edge_function' }
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Email updated successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'force_logout': {
        const { targetUserId } = requestData;

        // Sign out user from all devices using admin API
        const { error: logoutError } = await supabase.auth.admin.signOut(targetUserId);

        if (logoutError) {
          throw new Error(`Failed to force logout: ${logoutError.message}`);
        }

        // Log the action
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'force_logout_user',
          resource_type: 'auth',
          resource_id: targetUserId,
          details: { via: 'edge_function' }
        });

        return new Response(
          JSON.stringify({ success: true, message: 'User logged out from all devices' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('Error in admin-user-management:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});