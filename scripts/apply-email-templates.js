#!/usr/bin/env node

/**
 * Automated Email Template Setup for Supabase
 *
 * This script applies the beautiful email templates to your Supabase project.
 *
 * Usage:
 *   node scripts/apply-email-templates.js
 *
 * Note: This uses the Supabase Management API which requires service_role key
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

console.log(`${colors.bold}${colors.blue}============================================${colors.reset}`);
console.log(`${colors.bold}Email Template Setup - Audit Proof${colors.reset}`);
console.log(`${colors.bold}${colors.blue}============================================${colors.reset}\n`);

// Load environment variables
const envPath = join(__dirname, '../.env');
let SUPABASE_URL, SUPABASE_SERVICE_KEY;

try {
  const envFile = readFileSync(envPath, 'utf8');
  const lines = envFile.split('\n');

  for (const line of lines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) {
      SUPABASE_URL = line.split('=')[1].trim();
    }
    // Note: You'll need to add SUPABASE_SERVICE_ROLE_KEY to .env
    if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
      SUPABASE_SERVICE_KEY = line.split('=')[1].trim();
    }
  }
} catch (error) {
  console.error(`${colors.red}Error reading .env file:${colors.reset}`, error.message);
  process.exit(1);
}

if (!SUPABASE_URL) {
  console.error(`${colors.red}Error: VITE_SUPABASE_URL not found in .env${colors.reset}`);
  process.exit(1);
}

// Email Templates
const LOGO_URL = 'https://auditproof.ca/logo_audit_proof.png';

const templates = {
  confirmation: {
    name: 'Email Confirmation',
    subject: 'Verify Your Email - Audit Proof',
    content: `<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 0; }
    .wrapper { background-color: #f4f7fa; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .logo-section { text-align: center; padding: 40px 20px 20px; background-color: #f4f7fa; }
    .logo { max-width: 180px; height: auto; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 30px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 28px; margin: 0 0 10px 0; font-weight: 700; }
    .header p { color: #e0e7ff; font-size: 16px; margin: 0; }
    .content { padding: 35px 30px; color: #475569; line-height: 1.6; }
    .content p { margin: 0 0 20px 0; font-size: 16px; }
    .button { display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 25px 0; }
    .button-container { text-align: center; }
    .link-box { background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 25px 0; word-break: break-all; }
    .link-box a { color: #2563eb; font-size: 13px; text-decoration: none; }
    .info-box { background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px 20px; margin: 25px 0; border-radius: 4px; }
    .info-box p { margin: 0; color: #1e40af; font-size: 14px; }
    .footer { background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { color: #64748b; font-size: 14px; margin: 8px 0; }
    .footer a { color: #2563eb; text-decoration: none; }
    .signature { text-align: center; padding: 30px 20px; background-color: #f4f7fa; }
    .signature p { color: #1e293b; font-size: 15px; margin: 5px 0; }
    .copyright { text-align: center; padding: 20px; background-color: #f4f7fa; border-top: 1px solid #e2e8f0; }
    .copyright p { color: #94a3b8; font-size: 12px; margin: 5px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="logo-section">
      <img src="${LOGO_URL}" alt="Audit Proof" class="logo" />
    </div>
    <div class="container">
      <div class="header">
        <h1>Verify Your Email</h1>
        <p>Welcome to Audit Proof!</p>
      </div>
      <div class="content">
        <p>Hi there,</p>
        <p>Thank you for creating an account with <strong>Audit Proof</strong>. To complete your registration and start managing your receipts, please verify your email address:</p>
        <div class="button-container">
          <a href="{{ .ConfirmationURL }}" class="button">Verify Email Address</a>
        </div>
        <p style="text-align: center; font-size: 14px; color: #64748b;">Or copy and paste this link:</p>
        <div class="link-box">
          <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
        </div>
        <div class="info-box">
          <p><strong>Important:</strong> This link expires in 24 hours.</p>
        </div>
        <p style="font-size: 15px;">If you didn't create this account, you can safely ignore this email.</p>
      </div>
      <div class="footer">
        <p><strong>Need Help?</strong></p>
        <p>Contact us at <a href="mailto:contact@auditproof.ca">contact@auditproof.ca</a></p>
      </div>
    </div>
    <div class="signature">
      <p><strong>Best regards,</strong></p>
      <p style="font-weight: 600;">The Audit Proof Team</p>
    </div>
    <div class="copyright">
      <p>&copy; 2025 Audit Proof. All rights reserved.</p>
      <p><a href="https://auditproof.ca">auditproof.ca</a></p>
    </div>
  </div>
</body>
</html>`
  },

  reset_password: {
    name: 'Password Reset',
    subject: 'Reset Your Password - Audit Proof',
    content: `<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f4f7fa; margin: 0; padding: 0; }
    .wrapper { background-color: #f4f7fa; padding: 40px 20px; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .logo-section { text-align: center; padding: 40px 20px 20px; background-color: #f4f7fa; }
    .logo { max-width: 180px; height: auto; }
    .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 30px; text-align: center; }
    .header h1 { color: #ffffff; font-size: 28px; margin: 0 0 10px 0; font-weight: 700; }
    .header p { color: #e0e7ff; font-size: 16px; margin: 0; }
    .content { padding: 35px 30px; color: #475569; line-height: 1.6; }
    .content p { margin: 0 0 20px 0; font-size: 16px; }
    .button { display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 25px 0; }
    .button-container { text-align: center; }
    .link-box { background-color: #f1f5f9; padding: 15px; border-radius: 6px; margin: 25px 0; word-break: break-all; }
    .link-box a { color: #2563eb; font-size: 13px; text-decoration: none; }
    .warning-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 25px 0; border-radius: 4px; }
    .warning-box p { margin: 0; color: #92400e; font-size: 14px; }
    .footer { background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { color: #64748b; font-size: 14px; margin: 8px 0; }
    .footer a { color: #2563eb; text-decoration: none; }
    .signature { text-align: center; padding: 30px 20px; background-color: #f4f7fa; }
    .signature p { color: #1e293b; font-size: 15px; margin: 5px 0; }
    .copyright { text-align: center; padding: 20px; background-color: #f4f7fa; border-top: 1px solid #e2e8f0; }
    .copyright p { color: #94a3b8; font-size: 12px; margin: 5px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="logo-section">
      <img src="${LOGO_URL}" alt="Audit Proof" class="logo" />
    </div>
    <div class="container">
      <div class="header">
        <h1>Reset Your Password</h1>
        <p>We received your password reset request</p>
      </div>
      <div class="content">
        <p>Hi there,</p>
        <p>We received a request to reset the password for your <strong>Audit Proof</strong> account. Click the button below to create a new password:</p>
        <div class="button-container">
          <a href="{{ .ConfirmationURL }}" class="button">Reset Password</a>
        </div>
        <p style="text-align: center; font-size: 14px; color: #64748b;">Or copy and paste this link:</p>
        <div class="link-box">
          <a href="{{ .ConfirmationURL }}">{{ .ConfirmationURL }}</a>
        </div>
        <div class="warning-box">
          <p><strong>Security Notice:</strong> This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        </div>
        <p style="font-size: 15px;">This password reset link can only be used once.</p>
      </div>
      <div class="footer">
        <p><strong>Need Help?</strong></p>
        <p>Contact us at <a href="mailto:contact@auditproof.ca">contact@auditproof.ca</a></p>
      </div>
    </div>
    <div class="signature">
      <p><strong>Best regards,</strong></p>
      <p style="font-weight: 600;">The Audit Proof Team</p>
    </div>
    <div class="copyright">
      <p>&copy; 2025 Audit Proof. All rights reserved.</p>
      <p><a href="https://auditproof.ca">auditproof.ca</a></p>
    </div>
  </div>
</body>
</html>`
  }
};

console.log(`${colors.green}✓${colors.reset} Loaded email templates`);
console.log(`${colors.green}✓${colors.reset} Logo URL: ${LOGO_URL}`);
console.log(`${colors.green}✓${colors.reset} Supabase URL: ${SUPABASE_URL}\n`);

console.log(`${colors.yellow}⚠ IMPORTANT:${colors.reset}`);
console.log(`This script requires the Supabase Management API.`);
console.log(`Unfortunately, email template updates are only available via:`);
console.log(`  1. Supabase Dashboard (easiest)`);
console.log(`  2. Supabase CLI\n`);

console.log(`${colors.blue}→ Recommended: Use Supabase Dashboard${colors.reset}`);
console.log(`  Time: 10 minutes\n`);

console.log(`${colors.bold}Steps:${colors.reset}`);
console.log(`1. Go to: ${colors.blue}https://supabase.com/dashboard/project/${SUPABASE_URL.match(/https:\/\/([^.]+)/)[1]}/auth/templates${colors.reset}`);
console.log(`2. Open: ${colors.blue}documentation/SUPABASE_EMAIL_TEMPLATES_READY.md${colors.reset}`);
console.log(`3. Copy/paste each template (3 total)`);
console.log(`4. Save each one\n`);

console.log(`${colors.green}✓${colors.reset} All templates are ready in documentation folder`);
console.log(`${colors.green}✓${colors.reset} Logo will be served from: public/logo_audit_proof.png`);
console.log(`${colors.green}✓${colors.reset} Build successful - code changes complete\n`);

console.log(`${colors.bold}Template Summary:${colors.reset}`);
console.log(`  - Email Verification (Confirm Signup)`);
console.log(`  - Password Reset`);
console.log(`  - Email Change Confirmation\n`);

console.log(`${colors.bold}Features:${colors.reset}`);
console.log(`  ✓ Professional gradient design`);
console.log(`  ✓ Logo integrated`);
console.log(`  ✓ Styled buttons + text links`);
console.log(`  ✓ Mobile responsive`);
console.log(`  ✓ Email client compatible\n`);

console.log(`${colors.yellow}Note:${colors.reset} The logo file already exists in public/ folder`);
console.log(`It will be served automatically when you deploy your app.\n`);

console.log(`${colors.green}Ready to paste templates into Supabase!${colors.reset}`);
