import { createClient } from 'npm:@supabase/supabase-js@2';
import { getIPAddress } from '../_shared/rateLimit.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface PostmarkAttachment {
  Name: string;
  Content: string;
  ContentType: string;
  ContentLength: number;
  ContentID?: string;
}

interface PostmarkInboundEmail {
  MessageID: string;
  From: string;
  FromName: string;
  FromFull: {
    Email: string;
    Name: string;
  };
  To: string;
  ToFull: Array<{ Email: string; Name: string }>;
  Cc?: string;
  CcFull?: Array<{ Email: string; Name: string }>;
  Subject: string;
  Date: string;
  TextBody: string;
  HtmlBody: string;
  Attachments: PostmarkAttachment[];
  Tag?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const email: PostmarkInboundEmail = await req.json();

    console.log('📧 Received email:', {
      messageId: email.MessageID,
      from: email.From,
      subject: email.Subject,
      attachmentCount: email.Attachments?.length || 0
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
      console.warn('⚠️ Rate limit exceeded for incoming email webhook from IP:', ipAddress);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
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

    const businessId = await extractBusinessId(email.To, supabase);

    if (!businessId) {
      console.error('❌ Could not determine business ID from recipient:', email.To);

      await supabase.from('system_logs').insert({
        level: 'error',
        category: 'EMAIL',
        message: 'Could not determine business ID from recipient email',
        metadata: {
          to: email.To,
          from: email.From,
          subject: email.Subject,
          messageId: email.MessageID
        }
      });

      return new Response(
        JSON.stringify({ error: 'Invalid recipient address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: existing } = await supabase
      .from('email_receipts_inbox')
      .select('id')
      .eq('message_id', email.MessageID)
      .maybeSingle();

    if (existing) {
      console.log('⚠️ Duplicate email detected, ignoring:', email.MessageID);
      return new Response(
        JSON.stringify({ message: 'Email already processed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: inboxEntry, error: inboxError } = await supabase
      .from('email_receipts_inbox')
      .insert({
        business_id: businessId,
        message_id: email.MessageID,
        from_email: email.FromFull.Email,
        from_name: email.FromFull.Name || email.From,
        to_email: email.To,
        subject: email.Subject || '(No Subject)',
        received_at: new Date(email.Date).toISOString(),
        raw_email_data: email,
        processing_status: 'pending',
        attachments_count: email.Attachments?.length || 0
      })
      .select()
      .single();

    if (inboxError) {
      console.error('❌ Failed to create inbox entry:', inboxError);
      throw inboxError;
    }

    console.log('✅ Created inbox entry:', inboxEntry.id);

    if (email.Attachments && email.Attachments.length > 0) {
      await processAttachments(email, inboxEntry.id, businessId, supabase);
    } else {
      await supabase
        .from('email_receipts_inbox')
        .update({
          processing_status: 'failed',
          error_message: 'No attachments found in email',
          processed_at: new Date().toISOString()
        })
        .eq('id', inboxEntry.id);

      console.log('⚠️ No attachments found in email');
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email received and queued for processing',
        inboxId: inboxEntry.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error processing email:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function extractBusinessId(toEmail: string, supabase: any): Promise<string | null> {
  const match = toEmail.match(/receipts\+([a-f0-9-]{36})@/i);
  if (match) {
    const businessId = match[1];

    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', businessId)
      .maybeSingle();

    if (data) return businessId;
  }

  const { data: firstBusiness } = await supabase
    .from('businesses')
    .select('id')
    .limit(1)
    .maybeSingle();

  return firstBusiness?.id || null;
}

async function processAttachments(
  email: PostmarkInboundEmail,
  inboxId: string,
  businessId: string,
  supabase: any
) {
  try {
    await supabase
      .from('email_receipts_inbox')
      .update({ processing_status: 'processing' })
      .eq('id', inboxId);

    const validAttachments = email.Attachments.filter(att => {
      const contentType = att.ContentType.toLowerCase();
      return contentType.includes('image/') || contentType.includes('pdf');
    });

    if (validAttachments.length === 0) {
      throw new Error('No valid image or PDF attachments found');
    }

    console.log(`📎 Processing ${validAttachments.length} valid attachment(s)`);

    const attachment = validAttachments[0];
    const fileName = attachment.Name || 'receipt.pdf';

    const binaryData = Uint8Array.from(atob(attachment.Content), c => c.charCodeAt(0));

    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${businessId}/${timestamp}_${sanitizedFileName}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, binaryData, {
        contentType: attachment.ContentType,
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload attachment: ${uploadError.message}`);
    }

    console.log('✅ Uploaded attachment to storage:', filePath);

    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        business_id: businessId,
        file_path: filePath,
        file_name: sanitizedFileName,
        file_size: attachment.ContentLength,
        mime_type: attachment.ContentType,
        source: 'email',
        email_metadata: {
          sender: email.FromFull.Email,
          sender_name: email.FromFull.Name,
          subject: email.Subject,
          received_at: email.Date,
          message_id: email.MessageID
        },
        email_message_id: email.MessageID,
        extraction_status: 'pending',
        is_verified: false,
        total_amount: 0
      })
      .select()
      .single();

    if (receiptError) {
      throw new Error(`Failed to create receipt: ${receiptError.message}`);
    }

    console.log('✅ Created receipt record:', receipt.id);

    await supabase
      .from('email_receipts_inbox')
      .update({
        processing_status: 'completed',
        receipt_id: receipt.id,
        processed_at: new Date().toISOString()
      })
      .eq('id', inboxId);

    await supabase.from('system_logs').insert({
      level: 'info',
      category: 'EMAIL',
      message: 'Email receipt processed successfully',
      metadata: {
        inboxId,
        receiptId: receipt.id,
        businessId,
        from: email.From,
        subject: email.Subject
      }
    });

    console.log('✅ Email processing completed successfully');

  } catch (error) {
    console.error('❌ Error processing attachments:', error);

    await supabase
      .from('email_receipts_inbox')
      .update({
        processing_status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        processed_at: new Date().toISOString()
      })
      .eq('id', inboxId);

    await supabase.from('system_logs').insert({
      level: 'error',
      category: 'EMAIL',
      message: 'Failed to process email receipt',
      metadata: {
        inboxId,
        businessId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });

    throw error;
  }
}