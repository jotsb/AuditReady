import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  validateUUID,
  validateEmail,
  validatePassword,
  validateString,
  validateRequestBody,
  INPUT_LIMITS
} from "../_shared/validation.ts";
import {
  checkRateLimit,
  createRateLimitResponse,
  getIPAddress,
  RATE_LIMITS
} from "../_shared/rateLimit.ts";

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

interface ResetMFARequest {
  action: 'reset_mfa';
  targetUserId: string;
  reason: string;
}

type AdminRequest = ChangePasswordRequest | HardDeleteRequest | UpdateEmailRequest | ForceLogoutRequest | ResetMFARequest;

async function checkSystemAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('system_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (error) {
    await supabase.rpc('log_system_event', {
      p_level: 'ERROR',
      p_category: 'EDGE_FUNCTION',
      p_message: 'Failed to check system admin status',
      p_metadata: { userId, error: error.message, function: 'admin-user-management' },
      p_user_id: userId,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: null,
      p_stack_trace: null,
      p_execution_time_ms: null
    });
    return false;
  }

  return !!data;
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
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  let requestData: AdminRequest | null = null;
  let user: any = null;

  try {
    const ipAddress = getIPAddress(req);
    const rateLimitResult = checkRateLimit(ipAddress, RATE_LIMITS.STANDARD);

    if (!rateLimitResult.success) {
      await supabase.rpc('log_system_event', {
        p_level: 'WARN',
        p_category: 'SECURITY',
        p_message: 'Rate limit exceeded',
        p_metadata: { ip_address: ipAddress, function: 'admin-user-management' },
        p_user_id: null,
        p_session_id: null,
        p_ip_address: ipAddress,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: null,
        p_execution_time_ms: null
      });

      return createRateLimitResponse(rateLimitResult, 'Too many admin requests. Please try again later.');
    }

    await supabase.rpc('log_system_event', {
      p_level: 'INFO',
      p_category: 'EDGE_FUNCTION',
      p_message: 'Admin user management function started',
      p_metadata: { function: 'admin-user-management' },
      p_user_id: null,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
      p_stack_trace: null,
      p_execution_time_ms: null
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      await supabase.rpc('log_system_event', {
        p_level: 'WARN',
        p_category: 'SECURITY',
        p_message: 'Missing authorization header',
        p_metadata: { function: 'admin-user-management' },
        p_user_id: null,
        p_session_id: null,
        p_ip_address: null,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: null,
        p_execution_time_ms: null
      });

      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      await supabase.rpc('log_system_event', {
        p_level: 'WARN',
        p_category: 'SECURITY',
        p_message: 'Invalid authentication token',
        p_metadata: { function: 'admin-user-management', error: authError?.message },
        p_user_id: null,
        p_session_id: null,
        p_ip_address: null,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: null,
        p_execution_time_ms: null
      });

      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    user = authUser;

    const isAdmin = await checkSystemAdmin(supabase, user.id);
    if (!isAdmin) {
      await supabase.rpc('log_system_event', {
        p_level: 'WARN',
        p_category: 'SECURITY',
        p_message: 'Unauthorized admin access attempt',
        p_metadata: { userId: user.id, function: 'admin-user-management' },
        p_user_id: user.id,
        p_session_id: null,
        p_ip_address: null,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: null,
        p_execution_time_ms: null
      });

      return new Response(
        JSON.stringify({ error: 'Unauthorized: System admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bodyValidation = await validateRequestBody(req);
    if (!bodyValidation.valid) {
      await supabase.rpc('log_system_event', {
        p_level: 'WARN',
        p_category: 'SECURITY',
        p_message: 'Invalid request body',
        p_metadata: { error: bodyValidation.error, function: 'admin-user-management' },
        p_user_id: user.id,
        p_session_id: null,
        p_ip_address: null,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: null,
        p_execution_time_ms: null
      });

      return new Response(
        JSON.stringify({ error: bodyValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    requestData = bodyValidation.data;

    await supabase.rpc('log_system_event', {
      p_level: 'INFO',
      p_category: 'EDGE_FUNCTION',
      p_message: `Admin action attempted: ${requestData.action}`,
      p_metadata: {
        action: requestData.action,
        targetUserId: 'targetUserId' in requestData ? requestData.targetUserId : null,
        function: 'admin-user-management'
      },
      p_user_id: user.id,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
      p_stack_trace: null,
      p_execution_time_ms: null
    });

    switch (requestData.action) {
      case 'change_password': {
        const { targetUserId, newPassword } = requestData;
        const actionStartTime = Date.now();

        const uuidValidation = validateUUID(targetUserId);
        if (!uuidValidation.valid) {
          return new Response(
            JSON.stringify({ error: uuidValidation.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
          return new Response(
            JSON.stringify({ error: passwordValidation.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: pwError } = await supabase.auth.admin.updateUserById(
          targetUserId,
          { password: newPassword }
        );

        if (pwError) {
          throw new Error(`Failed to update password: ${pwError.message}`);
        }

        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'change_user_password',
          resource_type: 'auth',
          resource_id: targetUserId,
          details: { method: 'admin_override', via: 'edge_function' }
        });

        const actionTime = Date.now() - actionStartTime;
        await supabase.rpc('log_system_event', {
          p_level: 'INFO',
          p_category: 'EDGE_FUNCTION',
          p_message: 'Admin changed user password successfully',
          p_metadata: {
            action: 'change_password',
            targetUserId,
            adminUserId: user.id,
            function: 'admin-user-management'
          },
          p_user_id: user.id,
          p_session_id: null,
          p_ip_address: null,
          p_user_agent: req.headers.get('user-agent'),
          p_stack_trace: null,
          p_execution_time_ms: actionTime
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Password updated successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'hard_delete': {
        const { targetUserId } = requestData;
        const actionStartTime = Date.now();

        const { data: profile } = await supabase
          .from('profiles')
          .select('deleted_at')
          .eq('id', targetUserId)
          .maybeSingle();

        if (!profile?.deleted_at) {
          await supabase.rpc('log_system_event', {
            p_level: 'WARN',
            p_category: 'EDGE_FUNCTION',
            p_message: 'Hard delete attempted on non-soft-deleted user',
            p_metadata: {
              action: 'hard_delete',
              targetUserId,
              adminUserId: user.id,
              function: 'admin-user-management'
            },
            p_user_id: user.id,
            p_session_id: null,
            p_ip_address: null,
            p_user_agent: req.headers.get('user-agent'),
            p_stack_trace: null,
            p_execution_time_ms: null
          });

          return new Response(
            JSON.stringify({ error: 'User must be soft deleted before hard delete' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'hard_delete_user',
          resource_type: 'profile',
          resource_id: targetUserId,
          details: { permanent: true, via: 'edge_function' }
        });

        const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId);

        if (deleteError) {
          throw new Error(`Failed to delete user: ${deleteError.message}`);
        }

        const actionTime = Date.now() - actionStartTime;
        await supabase.rpc('log_system_event', {
          p_level: 'INFO',
          p_category: 'EDGE_FUNCTION',
          p_message: 'Admin permanently deleted user',
          p_metadata: {
            action: 'hard_delete',
            targetUserId,
            adminUserId: user.id,
            function: 'admin-user-management'
          },
          p_user_id: user.id,
          p_session_id: null,
          p_ip_address: null,
          p_user_agent: req.headers.get('user-agent'),
          p_stack_trace: null,
          p_execution_time_ms: actionTime
        });

        return new Response(
          JSON.stringify({ success: true, message: 'User permanently deleted' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_email': {
        const { targetUserId, newEmail } = requestData;
        const actionStartTime = Date.now();

        const { error: emailError } = await supabase.auth.admin.updateUserById(
          targetUserId,
          { email: newEmail }
        );

        if (emailError) {
          throw new Error(`Failed to update email: ${emailError.message}`);
        }

        await supabase
          .from('profiles')
          .update({ email: newEmail })
          .eq('id', targetUserId);

        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'update_user_email',
          resource_type: 'auth',
          resource_id: targetUserId,
          details: { new_email: newEmail, via: 'edge_function' }
        });

        const actionTime = Date.now() - actionStartTime;
        await supabase.rpc('log_system_event', {
          p_level: 'INFO',
          p_category: 'EDGE_FUNCTION',
          p_message: 'Admin updated user email successfully',
          p_metadata: {
            action: 'update_email',
            targetUserId,
            adminUserId: user.id,
            function: 'admin-user-management'
          },
          p_user_id: user.id,
          p_session_id: null,
          p_ip_address: null,
          p_user_agent: req.headers.get('user-agent'),
          p_stack_trace: null,
          p_execution_time_ms: actionTime
        });

        return new Response(
          JSON.stringify({ success: true, message: 'Email updated successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'force_logout': {
        const { targetUserId } = requestData;
        const actionStartTime = Date.now();

        const { error: logoutError } = await supabase.auth.admin.signOut(targetUserId);

        if (logoutError) {
          throw new Error(`Failed to force logout: ${logoutError.message}`);
        }

        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'force_logout_user',
          resource_type: 'auth',
          resource_id: targetUserId,
          details: { via: 'edge_function' }
        });

        const actionTime = Date.now() - actionStartTime;
        await supabase.rpc('log_system_event', {
          p_level: 'INFO',
          p_category: 'EDGE_FUNCTION',
          p_message: 'Admin force logged out user',
          p_metadata: {
            action: 'force_logout',
            targetUserId,
            adminUserId: user.id,
            function: 'admin-user-management'
          },
          p_user_id: user.id,
          p_session_id: null,
          p_ip_address: null,
          p_user_agent: req.headers.get('user-agent'),
          p_stack_trace: null,
          p_execution_time_ms: actionTime
        });

        return new Response(
          JSON.stringify({ success: true, message: 'User logged out from all devices' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reset_mfa': {
        const { targetUserId, reason } = requestData;
        const actionStartTime = Date.now();

        const uuidValidation = validateUUID(targetUserId);
        if (!uuidValidation.valid) {
          return new Response(
            JSON.stringify({ error: uuidValidation.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const reasonValidation = validateString(reason, 'Reason', INPUT_LIMITS.REASON);
        if (!reasonValidation.valid) {
          return new Response(
            JSON.stringify({ error: reasonValidation.error }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log('Listing MFA factors for user:', targetUserId);
        const { data: { factors }, error: factorsError } = await supabase.auth.admin.mfa.listFactors(targetUserId);

        if (factorsError) {
          console.error('Error listing factors:', factorsError);
          throw new Error(`Failed to list MFA factors: ${factorsError.message}`);
        }

        console.log(`Found ${factors?.length || 0} MFA factors`);

        if (factors && factors.length > 0) {
          for (const factor of factors) {
            console.log('Deleting factor:', factor.id, 'for user:', targetUserId);
            const { error: unenrollError } = await supabase.auth.admin.mfa.deleteFactor(
              targetUserId,
              factor.id
            );
            if (unenrollError) {
              console.error('Error deleting factor:', unenrollError);
              throw new Error(`Failed to unenroll MFA factor: ${unenrollError.message}`);
            }
            console.log('Successfully deleted factor:', factor.id);
          }
        }

        await supabase
          .from('profiles')
          .update({
            mfa_enabled: false,
            mfa_method: null,
            trusted_devices: null
          })
          .eq('id', targetUserId);

        await supabase
          .from('recovery_codes')
          .delete()
          .eq('user_id', targetUserId);

        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'admin_reset_mfa',
          resource_type: 'profile',
          resource_id: targetUserId,
          details: { reason, via: 'edge_function', factors_removed: factors?.length || 0 }
        });

        const actionTime = Date.now() - actionStartTime;
        await supabase.rpc('log_system_event', {
          p_level: 'WARN',
          p_category: 'SECURITY',
          p_message: 'Admin reset user MFA',
          p_metadata: {
            action: 'reset_mfa',
            targetUserId,
            adminUserId: user.id,
            reason,
            factors_removed: factors?.length || 0,
            function: 'admin-user-management'
          },
          p_user_id: user.id,
          p_session_id: null,
          p_ip_address: null,
          p_user_agent: req.headers.get('user-agent'),
          p_stack_trace: null,
          p_execution_time_ms: actionTime
        });

        return new Response(
          JSON.stringify({ success: true, message: 'MFA reset successfully', factors_removed: factors?.length || 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        await supabase.rpc('log_system_event', {
          p_level: 'WARN',
          p_category: 'EDGE_FUNCTION',
          p_message: 'Invalid admin action requested',
          p_metadata: {
            action: (requestData as any).action,
            function: 'admin-user-management'
          },
          p_user_id: user?.id,
          p_session_id: null,
          p_ip_address: null,
          p_user_agent: req.headers.get('user-agent'),
          p_stack_trace: null,
          p_execution_time_ms: null
        });

        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const stackTrace = error instanceof Error ? error.stack : null;

    await supabase.rpc('log_system_event', {
      p_level: 'ERROR',
      p_category: 'EDGE_FUNCTION',
      p_message: `Admin user management failed: ${errorMessage}`,
      p_metadata: {
        action: requestData?.action,
        targetUserId: requestData && 'targetUserId' in requestData ? requestData.targetUserId : null,
        adminUserId: user?.id,
        function: 'admin-user-management',
        error: errorMessage
      },
      p_user_id: user?.id,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
      p_stack_trace: stackTrace,
      p_execution_time_ms: executionTime
    });

    console.error('Error in admin-user-management:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});