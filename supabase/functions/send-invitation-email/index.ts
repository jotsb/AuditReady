import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const payload: InvitationPayload = await req.json();
    const { email, role, token, inviterName, businessName } = payload;

    if (!email || !token) {
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
                ${inviterName ? `<strong>${inviterName}</strong>` : "Someone"} has invited you to join ${businessName ? `<strong>${businessName}</strong>` : "their team"} on AuditReady as a <strong>${role}</strong>.
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
              <p>© ${new Date().getFullYear()} AuditReady. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailText = `
You've been invited to join ${businessName || "a team"} on AuditReady!

${inviterName ? `${inviterName} has` : "Someone has"} invited you to join as a ${role}.

Click the link below to accept the invitation:
${inviteLink}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.
    `;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured. Email would be sent to:", email);
      console.log("Invitation link:", inviteLink);
      
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

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AuditReady <onboarding@resend.dev>",
        to: [email],
        subject: `You've been invited to join ${businessName || "a team"} on AuditReady`,
        html: emailHtml,
        text: emailText,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
      throw new Error(`Failed to send email: ${JSON.stringify(errorData)}`);
    }

    const emailData = await emailResponse.json();

    return new Response(
      JSON.stringify({ success: true, emailId: emailData.id }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error sending invitation email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
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