import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Inline helper functions to avoid import issues
function getIPAddress(request: Request): string {
  const headers = [
    'x-forwarded-for',
    'x-real-ip',
    'cf-connecting-ip',
    'x-client-ip',
    'x-cluster-client-ip',
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      const ip = value.split(',')[0].trim();
      if (ip) return ip;
    }
  }

  return 'unknown';
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GetInvitationRequest {
  action: 'get_invitation';
  token: string;
}

interface SignupAndAcceptRequest {
  action: 'signup_and_accept';
  token: string;
  email: string;
  password: string;
  fullName: string;
}

interface AcceptInvitationRequest {
  action: 'accept_invitation';
  token: string;
}

type InvitationRequest = GetInvitationRequest | SignupAndAcceptRequest | AcceptInvitationRequest;

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const logToSystem = async (level: string, message: string, metadata: any = {}) => {
    try {
      await serviceClient.from('system_logs').insert({
        level,
        category: 'EDGE_FUNCTION',
        message,
        metadata: {
          ...metadata,
          request_id: requestId,
          function_name: 'accept-invitation',
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      console.error('Failed to log to system_logs:', err);
    }
  };

  try {
    // Rate limiting: 10 invitation actions per hour per IP
    const ipAddress = getIPAddress(req);
    const { data: rateLimitResult } = await serviceClient.rpc('check_rate_limit', {
      p_identifier: ipAddress,
      p_action_type: 'api_call',
      p_max_attempts: 10,
      p_window_minutes: 60
    });

    if (rateLimitResult && !rateLimitResult.allowed) {
      const minutesRemaining = Math.ceil(rateLimitResult.retryAfter / 60);
      return new Response(
        JSON.stringify({
          error: `Too many requests. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`
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

    await logToSystem('INFO', 'Accept-invitation function invoked', {
      method: req.method,
      url: req.url
    });

    if (req.method === "GET") {
      await logToSystem('INFO', 'Processing GET request to fetch invitation details');
      const url = new URL(req.url);
      const token = url.searchParams.get('token');

      if (!token) {
        await logToSystem('WARN', 'Missing invitation token in GET request');
        return new Response(
          JSON.stringify({ error: 'Missing invitation token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: invitation, error: invitationError } = await serviceClient
        .from('invitations')
        .select(`
          id,
          email,
          role,
          status,
          expires_at,
          business_id,
          businesses (
            id,
            name
          ),
          invited_by
        `)
        .eq('token', token)
        .maybeSingle();

      // Fetch inviter profile separately
      let inviterName = 'Unknown';
      if (invitation && invitation.invited_by) {
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('full_name')
          .eq('id', invitation.invited_by)
          .maybeSingle();
        if (profile) {
          inviterName = profile.full_name;
        }
      }

      if (invitationError) {
        await logToSystem('ERROR', 'Database error fetching invitation', {
          error: invitationError.message,
          token_preview: token.substring(0, 8) + '...'
        });
        throw new Error(`Failed to fetch invitation: ${invitationError.message}`);
      }

      if (!invitation) {
        await logToSystem('WARN', 'Invalid invitation token provided', {
          token_preview: token.substring(0, 8) + '...'
        });
        return new Response(
          JSON.stringify({ error: 'Invalid invitation token' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (invitation.status !== 'pending') {
        await logToSystem('WARN', 'Invitation already processed', {
          invitation_id: invitation.id,
          current_status: invitation.status
        });
        return new Response(
          JSON.stringify({ error: 'Invitation already processed', status: invitation.status }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (new Date(invitation.expires_at) < new Date()) {
        await logToSystem('INFO', 'Marking expired invitation', {
          invitation_id: invitation.id,
          expires_at: invitation.expires_at
        });
        await serviceClient
          .from('invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id);

        return new Response(
          JSON.stringify({ error: 'Invitation has expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logToSystem('INFO', 'Successfully fetched invitation details', {
        invitation_id: invitation.id,
        email: invitation.email,
        role: invitation.role
      });

      return new Response(
        JSON.stringify({
          invitation: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            businessName: invitation.businesses?.name || 'Unknown Business',
            inviterName: inviterName,
            expiresAt: invitation.expires_at
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === "POST") {
      // Parse request body
      let requestData: InvitationRequest;
      try {
        requestData = await req.json();
      } catch (error) {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON in request body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logToSystem('INFO', 'Processing POST request', {
        action: requestData.action
      });

      if (requestData.action === 'signup_and_accept') {
        const { token, email, password, fullName } = requestData;

        // Basic validation
        if (!token || !email || !password || !fullName) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await logToSystem('INFO', 'Processing signup_and_accept action', {
          email,
          full_name: fullName
        });

        const { data: invitation, error: invitationError } = await serviceClient
          .from('invitations')
          .select('id, email, role, business_id, status, expires_at, invited_by')
          .eq('token', token)
          .maybeSingle();

        if (invitationError || !invitation) {
          await logToSystem('ERROR', 'Failed to fetch invitation for signup', {
            error: invitationError?.message,
            email
          });
          return new Response(
            JSON.stringify({ error: 'Invalid invitation token' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (invitation.status !== 'pending') {
          await logToSystem('WARN', 'Signup attempted with non-pending invitation', {
            invitation_id: invitation.id,
            status: invitation.status
          });
          return new Response(
            JSON.stringify({ error: 'Invitation already processed' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (new Date(invitation.expires_at) < new Date()) {
          await logToSystem('WARN', 'Signup attempted with expired invitation', {
            invitation_id: invitation.id,
            expires_at: invitation.expires_at
          });
          return new Response(
            JSON.stringify({ error: 'Invitation has expired' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (email.toLowerCase() !== invitation.email.toLowerCase()) {
          await logToSystem('WARN', 'Email mismatch during signup', {
            provided_email: email,
            invitation_email: invitation.email
          });
          return new Response(
            JSON.stringify({ error: 'Email does not match invitation' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: authData, error: signupError } = await serviceClient.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName
          }
        });

        if (signupError) {
          await logToSystem('ERROR', 'User creation failed', {
            error: signupError.message,
            email
          });
          throw new Error(`Failed to create user: ${signupError.message}`);
        }

        if (!authData.user) {
          await logToSystem('ERROR', 'User creation returned no user', { email });
          throw new Error('User creation failed');
        }

        await logToSystem('INFO', 'User created successfully', {
          user_id: authData.user.id,
          email
        });

        const { error: memberError } = await serviceClient
          .from('business_members')
          .insert({
            business_id: invitation.business_id,
            user_id: authData.user.id,
            role: invitation.role,
            invited_by: invitation.invited_by
          });

        if (memberError) {
          await logToSystem('ERROR', 'Failed to add user to business', {
            error: memberError.message,
            user_id: authData.user.id,
            business_id: invitation.business_id
          });
          throw new Error(`Failed to add user to business: ${memberError.message}`);
        }

        await logToSystem('INFO', 'User added to business successfully', {
          user_id: authData.user.id,
          business_id: invitation.business_id,
          role: invitation.role
        });

        const { error: updateError } = await serviceClient
          .from('invitations')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString()
          })
          .eq('id', invitation.id);

        if (updateError) {
          await logToSystem('ERROR', 'Failed to update invitation status', {
            error: updateError.message,
            invitation_id: invitation.id
          });
          console.error('Failed to update invitation status:', updateError);
        } else {
          await logToSystem('INFO', 'Invitation marked as accepted', {
            invitation_id: invitation.id
          });
        }

        await serviceClient.from('audit_logs').insert({
          user_id: authData.user.id,
          action: 'accept_invitation_with_signup',
          resource_type: 'invitation',
          resource_id: invitation.id,
          details: {
            business_id: invitation.business_id,
            role: invitation.role,
            via: 'edge_function'
          }
        });

        const anonClient = createClient(supabaseUrl, supabaseAnonKey);
        const { data: sessionData, error: sessionError } = await anonClient.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (sessionError || !sessionData.session) {
          await logToSystem('WARN', 'Auto-login failed after signup', {
            user_id: authData.user.id,
            error: sessionError?.message
          });
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Account created. Please sign in.',
              requiresLogin: true
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await logToSystem('INFO', 'Signup and accept completed successfully', {
          user_id: authData.user.id,
          business_id: invitation.business_id,
          execution_time_ms: Date.now() - startTime
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Account created and invitation accepted',
            session: sessionData.session,
            user: sessionData.user
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } else if (requestData.action === 'accept_invitation') {
        const { token } = requestData;
        await logToSystem('INFO', 'Processing accept_invitation action (existing user)');

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
          await logToSystem('WARN', 'Missing authorization header for accept_invitation');
          return new Response(
            JSON.stringify({ error: 'Missing authorization header' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const userToken = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await serviceClient.auth.getUser(userToken);

        if (authError || !user) {
          await logToSystem('ERROR', 'Authentication failed', {
            error: authError?.message
          });
          return new Response(
            JSON.stringify({ error: 'Invalid authentication token' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await logToSystem('INFO', 'User authenticated', {
          user_id: user.id,
          email: user.email
        });

        const { data: invitation, error: invitationError } = await serviceClient
          .from('invitations')
          .select('id, email, role, business_id, status, expires_at, invited_by')
          .eq('token', token)
          .maybeSingle();

        if (invitationError || !invitation) {
          await logToSystem('ERROR', 'Failed to fetch invitation for existing user', {
            error: invitationError?.message,
            user_id: user.id
          });
          return new Response(
            JSON.stringify({ error: 'Invalid invitation token' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (invitation.status !== 'pending') {
          await logToSystem('WARN', 'Accept attempted with non-pending invitation', {
            invitation_id: invitation.id,
            status: invitation.status,
            user_id: user.id
          });
          return new Response(
            JSON.stringify({ error: 'Invitation already processed' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (new Date(invitation.expires_at) < new Date()) {
          await logToSystem('WARN', 'Accept attempted with expired invitation', {
            invitation_id: invitation.id,
            expires_at: invitation.expires_at,
            user_id: user.id
          });
          return new Response(
            JSON.stringify({ error: 'Invitation has expired' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
          await logToSystem('WARN', 'Email mismatch during accept', {
            user_email: user.email,
            invitation_email: invitation.email,
            user_id: user.id
          });
          return new Response(
            JSON.stringify({ error: 'Your email does not match the invitation' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: existingMember } = await serviceClient
          .from('business_members')
          .select('id')
          .eq('business_id', invitation.business_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingMember) {
          await logToSystem('WARN', 'User already a member of business', {
            user_id: user.id,
            business_id: invitation.business_id
          });
          return new Response(
            JSON.stringify({ error: 'You are already a member of this business' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error: memberError } = await serviceClient
          .from('business_members')
          .insert({
            business_id: invitation.business_id,
            user_id: user.id,
            role: invitation.role,
            invited_by: invitation.invited_by
          });

        if (memberError) {
          await logToSystem('ERROR', 'Failed to add existing user to business', {
            error: memberError.message,
            user_id: user.id,
            business_id: invitation.business_id
          });
          throw new Error(`Failed to add user to business: ${memberError.message}`);
        }

        await logToSystem('INFO', 'Existing user added to business', {
          user_id: user.id,
          business_id: invitation.business_id,
          role: invitation.role
        });

        const { error: updateError } = await serviceClient
          .from('invitations')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString()
          })
          .eq('id', invitation.id);

        if (updateError) {
          await logToSystem('ERROR', 'Failed to update invitation status', {
            error: updateError.message,
            invitation_id: invitation.id
          });
          console.error('Failed to update invitation status:', updateError);
        } else {
          await logToSystem('INFO', 'Invitation marked as accepted', {
            invitation_id: invitation.id
          });
        }

        await serviceClient.from('audit_logs').insert({
          user_id: user.id,
          action: 'accept_invitation',
          resource_type: 'invitation',
          resource_id: invitation.id,
          details: {
            business_id: invitation.business_id,
            role: invitation.role,
            via: 'edge_function'
          }
        });

        await logToSystem('INFO', 'Accept invitation completed successfully', {
          user_id: user.id,
          business_id: invitation.business_id,
          execution_time_ms: Date.now() - startTime
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Invitation accepted successfully'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await logToSystem('ERROR', 'Invalid action provided', {
        action: (requestData as any).action
      });
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await logToSystem('ERROR', 'Method not allowed', {
      method: req.method
    });
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    await logToSystem('ERROR', 'Unhandled error in accept-invitation function', {
      error: error.message,
      stack: error.stack,
      execution_time_ms: Date.now() - startTime
    });
    console.error('Error in accept-invitation:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
