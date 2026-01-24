import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  validateEmail,
  validateUUID,
  validateString,
  validateRequestBody,
  INPUT_LIMITS
} from "../_shared/validation.ts";
import { getIPAddress } from "../_shared/rateLimit.ts";

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
  frontendUrl?: string;
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

  // Get configured rate limits from database
  const ipAddress = getIPAddress(req);
  const { data: rateLimitConfig } = await supabase.rpc('get_rate_limit_config', {
    p_action_type: 'email'
  });
  const maxAttempts = rateLimitConfig?.max_attempts || 20;
  const windowMinutes = rateLimitConfig?.window_minutes || 60;

  // Rate limiting using configured values
  const { data: rateLimitResult } = await supabase.rpc('check_rate_limit', {
    p_identifier: ipAddress,
    p_action_type: 'email',
    p_max_attempts: maxAttempts,
    p_window_minutes: windowMinutes
  });

  if (rateLimitResult && !rateLimitResult.allowed) {
    const minutesRemaining = Math.ceil(rateLimitResult.retryAfter / 60);
    return new Response(
      JSON.stringify({
        error: `Too many invitation emails sent. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''}.`
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

  let payload: InvitationPayload | null = null;

  try {
    const bodyValidation = await validateRequestBody(req);
    if (!bodyValidation.valid) {
      return new Response(
        JSON.stringify({ error: bodyValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    payload = bodyValidation.data;
    const { email, role, token, inviterName, businessName, frontendUrl } = payload;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return new Response(
        JSON.stringify({ error: emailValidation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenValidation = validateUUID(token);
    if (!tokenValidation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid invitation token format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Use the frontend URL from the request payload, or fall back to environment variables
    const baseUrl = frontendUrl || Deno.env.get("FRONTEND_URL") || Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "").replace("supabase.co", "auditproof.ca") || "";
    const inviteLink = `${baseUrl}/accept-invite?token=${token}`;

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
    const smtpPassword = Deno.env.get("SMTP_PASSWORD") || Deno.env.get("SMTP_PASS");

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      const missingVars = [];
      if (!smtpHost) missingVars.push('SMTP_HOST');
      if (!smtpPort) missingVars.push('SMTP_PORT');
      if (!smtpUser) missingVars.push('SMTP_USER');
      if (!smtpPassword) missingVars.push('SMTP_PASSWORD or SMTP_PASS');

      await supabase.rpc('log_system_event', {
        p_level: 'ERROR',
        p_category: 'EDGE_FUNCTION',
        p_message: 'SMTP credentials not configured - emails cannot be sent',
        p_metadata: {
          email,
          inviteLink,
          function: 'send-invitation-email',
          missingVariables: missingVars,
          warning: 'Configure SMTP environment variables in edge functions to enable email sending'
        },
        p_user_id: null,
        p_session_id: null,
        p_ip_address: ipAddress,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: null,
        p_execution_time_ms: null
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured. Please contact your system administrator.",
          missingVariables: missingVars,
          inviteLink
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

    await supabase.rpc('log_system_event', {
      p_level: 'INFO',
      p_category: 'EXTERNAL_API',
      p_message: 'Sending invitation email via SMTP',
      p_metadata: {
        email,
        businessName,
        smtpHost,
        smtpPort,
        function: 'send-invitation-email'
      },
      p_user_id: null,
      p_session_id: null,
      p_ip_address: null,
      p_user_agent: req.headers.get('user-agent'),
      p_stack_trace: null,
      p_execution_time_ms: null
    });

    const apiStartTime = Date.now();

    try {
      const nodemailer = await import("npm:nodemailer@6.9.7");

      const port = parseInt(smtpPort);
      const isSecurePort = port === 465;

      const transportConfig = {
        host: smtpHost,
        port: port,
        secure: isSecurePort,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        tls: {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
      };

      await supabase.rpc('log_system_event', {
        p_level: 'DEBUG',
        p_category: 'EXTERNAL_API',
        p_message: 'SMTP transport configuration',
        p_metadata: {
          host: smtpHost,
          port: port,
          secure: isSecurePort,
          useSTARTTLS: !isSecurePort,
          function: 'send-invitation-email'
        },
        p_user_id: null,
        p_session_id: null,
        p_ip_address: null,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: null,
        p_execution_time_ms: null
      });

      const transporter = nodemailer.default.createTransport(transportConfig);

      const info = await transporter.sendMail({
        from: `"Audit Proof" <${smtpUser}>`,
        to: email,
        subject: `You've been invited to join ${businessName || "a team"} on Audit Proof`,
        text: emailText,
        html: emailHtml,
      });

      const apiTime = Date.now() - apiStartTime;
      const executionTime = Math.round(Date.now() - startTime);

      await supabase.rpc('log_system_event', {
        p_level: 'INFO',
        p_category: 'EXTERNAL_API',
        p_message: 'Invitation email sent successfully via SMTP',
        p_metadata: {
          email,
          smtpHost,
          messageId: info.messageId,
          response: info.response,
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
        JSON.stringify({
          success: true,
          message: 'Email sent successfully',
          messageId: info.messageId
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (emailError) {
      const apiTime = Math.round(Date.now() - apiStartTime);
      const emailErrorMessage = emailError instanceof Error ? emailError.message : 'Unknown email error';
      const errorStack = emailError instanceof Error ? emailError.stack : null;

      await supabase.rpc('log_system_event', {
        p_level: 'ERROR',
        p_category: 'EXTERNAL_API',
        p_message: 'SMTP send error',
        p_metadata: {
          email,
          smtpHost,
          smtpPort,
          error: emailErrorMessage,
          errorName: emailError instanceof Error ? emailError.name : 'Unknown',
          function: 'send-invitation-email'
        },
        p_user_id: null,
        p_session_id: null,
        p_ip_address: null,
        p_user_agent: req.headers.get('user-agent'),
        p_stack_trace: errorStack,
        p_execution_time_ms: apiTime
      });

      throw new Error(`Failed to send email: ${emailErrorMessage}`);
    }
  } catch (error) {
    const executionTime = Math.round(Date.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const stackTrace = error instanceof Error ? error.stack : null;

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