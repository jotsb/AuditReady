import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "npm:emailjs@4.0.3";
import {
  validateEmail,
  validateUUID,
  validateString,
  validateRequestBody,
  INPUT_LIMITS
} from "../_shared/validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvitationPayload {
  email: string;
  role: string;
  token: string;
  inviterName?: string;
  businessName?: string;
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  let payload: InvitationPayload | null = null;

  try {
    // Validate and parse request body
    const bodyValidation = await validateRequestBody(req);
    if (!bodyValidation.valid) {
      return new Response(
        JSON.stringify({ error: bodyValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    payload = bodyValidation.data;
    const { email, role, token, inviterName, businessName } = payload;

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return new Response(
        JSON.stringify({ error: emailValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate token (UUID format)
    const tokenValidation = validateUUID(token);
    if (!tokenValidation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid invitation token format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate optional string fields
    if (inviterName) {
      const nameValidation = validateString(inviterName, 'inviterName', INPUT_LIMITS.full_name, false);
      if (!nameValidation.valid) {
        return new Response(
          JSON.stringify({ error: nameValidation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (businessName) {
      const businessValidation = validateString(businessName, 'businessName', INPUT_LIMITS.business_name, false);
      if (!businessValidation.valid) {
        return new Response(
          JSON.stringify({ error: businessValidation.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Log function start
    await supabase.rpc('log_system_event', {
      p_level: 'INFO',
      p_category: 'EDGE_FUNCTION',
      p_message: 'Invitation email function started',
      p_metadata: { email, role, businessName, function: 'send-invitation-email' },
      p_user_id: null,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
      p_stack_trace: null,
      p_execution_time_ms: null
    });

    // Email and token validation already done above, this check is now redundant
    if (!emailValidation.sanitized || !tokenValidation.sanitized) {
      await supabase.rpc('log_system_event', {
        p_level: 'WARN',
        p_category: 'EDGE_FUNCTION',
        p_message: 'Missing required fields for invitation',
        p_metadata: { hasEmail: !!email, hasToken: !!token, function: 'send-invitation-email' },
        p_user_id: null,
        p_session_id: null,
        p_ip_address: null,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: null,
        p_execution_time_ms: null
      });

      return new Response(
        JSON.stringify({ error: "Email and token are required" }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "") || "";
    const inviteLink = `https://new-chat-5w59.bolt.host/accept-invite?token=${token}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Team Invitation</h1>
            </div>
            <div style="background: white; padding: 40px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                Hello!
              </p>
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                ${inviterName ? `<strong>${inviterName}</strong>` : "Someone"} has invited you to join ${businessName ? `<strong>${businessName}</strong>` : "their team"} on Audit Proof as a <strong>${role}</strong>.
              </p>
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Click the button below to accept the invitation and get started:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
              </div>
              <p style="color: #666; font-size: 14px; line-height: 1.6; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                Or copy and paste this link into your browser:<br>
                <a href="${inviteLink}" style="color: #667eea; word-break: break-all;">${inviteLink}</a>
              </p>
              <p style="color: #999; font-size: 12px; line-height: 1.6; margin-top: 20px;">
                This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
              </p>
            </div>
            <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
              <p>© ${new Date().getFullYear()} Audit Proof. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailText = `
You've been invited to join ${businessName || "a team"} on Audit Proof!

${inviterName ? `${inviterName} has` : "Someone has"} invited you to join as a ${role}.

Click the link below to accept the invitation:
${inviteLink}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
    `;

    const smtpHost = Deno.env.get("SMTP_HOST");
    const smtpPort = Deno.env.get("SMTP_PORT");
    const smtpUser = Deno.env.get("SMTP_USER");
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      await supabase.rpc('log_system_event', {
        p_level: 'WARN',
        p_category: 'EDGE_FUNCTION',
        p_message: 'SMTP credentials not configured',
        p_metadata: { email, inviteLink, function: 'send-invitation-email' },
        p_user_id: null,
        p_session_id: null,
        p_ip_address: null,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: null,
        p_execution_time_ms: null
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Email service not configured. Use the invitation link from the Team page.",
          inviteLink
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Log SMTP email send
    await supabase.rpc('log_system_event', {
      p_level: 'INFO',
      p_category: 'EXTERNAL_API',
      p_message: 'Sending invitation email via SMTP',
      p_metadata: { email, businessName, smtpHost, function: 'send-invitation-email' },
      p_user_id: null,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
      p_stack_trace: null,
      p_execution_time_ms: null
    });

    const apiStartTime = Date.now();

    try {
      const client = new SMTPClient({
        user: smtpUser,
        password: smtpPassword,
        host: smtpHost,
        port: parseInt(smtpPort),
        ssl: true,
      });

      const message = {
        from: `Audit Proof <${smtpUser}>`,
        to: email,
        subject: `You've been invited to join ${businessName || "a team"} on Audit Proof`,
        text: emailText,
        attachment: [
          {
            data: emailHtml,
            alternative: true,
          },
        ],
      };

      // Add headers to improve deliverability and prevent spam classification
      const headers: Record<string, string> = {
        'X-Mailer': 'Audit Proof Email Service',
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal',
        'Importance': 'Normal',
        'List-Unsubscribe': `<mailto:${smtpUser}?subject=unsubscribe>`,
        'Precedence': 'bulk',
        'MIME-Version': '1.0',
        'Message-ID': `<${Date.now()}.${Math.random().toString(36).substring(2)}@auditproof.ca>`,
        'Reply-To': smtpUser,
      };

      await client.sendAsync({
        ...message,
        headers,
      });

      const apiTime = Date.now() - apiStartTime;

      // Log successful send
      const executionTime = Date.now() - startTime;
      await supabase.rpc('log_system_event', {
        p_level: 'INFO',
        p_category: 'EXTERNAL_API',
        p_message: 'Invitation email sent successfully via SMTP',
        p_metadata: {
          email,
          smtpHost,
          function: 'send-invitation-email'
        },
        p_user_id: null,
        p_session_id: null,
        p_ip_address: null,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: null,
        p_execution_time_ms: executionTime
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Email sent successfully' }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (emailError) {
      const apiTime = Date.now() - apiStartTime;
      const emailErrorMessage = emailError instanceof Error ? emailError.message : 'Unknown email error';

      await supabase.rpc('log_system_event', {
        p_level: 'ERROR',
        p_category: 'EXTERNAL_API',
        p_message: 'SMTP send error',
        p_metadata: {
          email,
          smtpHost,
          error: emailErrorMessage,
          function: 'send-invitation-email'
        },
        p_user_id: null,
        p_session_id: null,
        p_ip_address: null,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: emailError instanceof Error ? emailError.stack : null,
        p_execution_time_ms: apiTime
      });

      throw new Error(`Failed to send email: ${emailErrorMessage}`);
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const stackTrace = error instanceof Error ? error.stack : null;

    // Log error
    await supabase.rpc('log_system_event', {
      p_level: 'ERROR',
      p_category: 'EDGE_FUNCTION',
      p_message: `Invitation email failed: ${errorMessage}`,
      p_metadata: {
        email: payload?.email,
        function: 'send-invitation-email',
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
      JSON.stringify({ error: errorMessage }),
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
