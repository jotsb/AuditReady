import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get('token');

      if (!token) {
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
          invited_by,
          profiles!invitations_invited_by_fkey (
            full_name
          )
        `)
        .eq('token', token)
        .maybeSingle();

      if (invitationError) {
        throw new Error(`Failed to fetch invitation: ${invitationError.message}`);
      }

      if (!invitation) {
        return new Response(
          JSON.stringify({ error: 'Invalid invitation token' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (invitation.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: 'Invitation already processed', status: invitation.status }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (new Date(invitation.expires_at) < new Date()) {
        await serviceClient
          .from('invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id);

        return new Response(
          JSON.stringify({ error: 'Invitation has expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          invitation: {
            id: invitation.id,
            email: invitation.email,
            role: invitation.role,
            businessName: invitation.businesses?.name || 'Unknown Business',
            inviterName: invitation.profiles?.full_name || 'Unknown',
            expiresAt: invitation.expires_at
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === "POST") {
      const requestData: InvitationRequest = await req.json();

      if (requestData.action === 'signup_and_accept') {
        const { token, email, password, fullName } = requestData;

        const { data: invitation, error: invitationError } = await serviceClient
          .from('invitations')
          .select('id, email, role, business_id, status, expires_at, invited_by')
          .eq('token', token)
          .maybeSingle();

        if (invitationError || !invitation) {
          return new Response(
            JSON.stringify({ error: 'Invalid invitation token' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (invitation.status !== 'pending') {
          return new Response(
            JSON.stringify({ error: 'Invitation already processed' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (new Date(invitation.expires_at) < new Date()) {
          return new Response(
            JSON.stringify({ error: 'Invitation has expired' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (email.toLowerCase() !== invitation.email.toLowerCase()) {
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
          throw new Error(`Failed to create user: ${signupError.message}`);
        }

        if (!authData.user) {
          throw new Error('User creation failed');
        }

        const { error: memberError } = await serviceClient
          .from('business_members')
          .insert({
            business_id: invitation.business_id,
            user_id: authData.user.id,
            role: invitation.role,
            invited_by: invitation.invited_by
          });

        if (memberError) {
          throw new Error(`Failed to add user to business: ${memberError.message}`);
        }

        const { error: updateError } = await serviceClient
          .from('invitations')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString()
          })
          .eq('id', invitation.id);

        if (updateError) {
          console.error('Failed to update invitation status:', updateError);
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
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Account created. Please sign in.',
              requiresLogin: true
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

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

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
          return new Response(
            JSON.stringify({ error: 'Missing authorization header' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const userToken = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await serviceClient.auth.getUser(userToken);

        if (authError || !user) {
          return new Response(
            JSON.stringify({ error: 'Invalid authentication token' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: invitation, error: invitationError } = await serviceClient
          .from('invitations')
          .select('id, email, role, business_id, status, expires_at, invited_by')
          .eq('token', token)
          .maybeSingle();

        if (invitationError || !invitation) {
          return new Response(
            JSON.stringify({ error: 'Invalid invitation token' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (invitation.status !== 'pending') {
          return new Response(
            JSON.stringify({ error: 'Invitation already processed' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (new Date(invitation.expires_at) < new Date()) {
          return new Response(
            JSON.stringify({ error: 'Invitation has expired' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
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
          throw new Error(`Failed to add user to business: ${memberError.message}`);
        }

        const { error: updateError } = await serviceClient
          .from('invitations')
          .update({
            status: 'accepted',
            accepted_at: new Date().toISOString()
          })
          .eq('id', invitation.id);

        if (updateError) {
          console.error('Failed to update invitation status:', updateError);
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

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Invitation accepted successfully'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in accept-invitation:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
