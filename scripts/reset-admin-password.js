#!/usr/bin/env node

/**
 * Admin Password Reset Script
 *
 * This script triggers a password reset email for an admin account.
 * Run with: node scripts/reset-admin-password.js
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env file
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf8');
const envLines = envContent.split('\n');
const env = {};
envLines.forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.argv[3] || env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('Error: Missing VITE_SUPABASE_URL in .env file');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('\n❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nTo use this script, either:');
  console.error('1. Add SUPABASE_SERVICE_ROLE_KEY to your .env file');
  console.error('2. Get it from: https://supabase.com/dashboard/project/mnmfwqfbksughmthfutg/settings/api');
  console.error('3. Run: node scripts/reset-admin-password.js EMAIL SERVICE_KEY\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function resetPassword(email) {
  try {
    console.log(`\nSending password reset email to: ${email}`);

    // Get the app URL for the redirect
    const appUrl = process.env.VITE_APP_URL || 'http://localhost:5173';

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${appUrl}/reset-password`
      }
    });

    if (error) {
      throw error;
    }

    console.log('\n✅ Password reset link generated successfully!');
    console.log('\nYou have two options:');
    console.log('\n1. Check your email for the reset link (if SMTP is configured)');
    console.log('\n2. Use this direct reset link:');
    console.log(`\n${data.properties.action_link}\n`);
    console.log('\nCopy and paste the link above into your browser to reset your password.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Get email from command line argument or use default
const email = process.argv[2] || 'brarjot@hotmail.ca';

resetPassword(email);
