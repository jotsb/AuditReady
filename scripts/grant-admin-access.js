#!/usr/bin/env node

/**
 * Grant Admin Access Script
 *
 * This script grants system admin privileges to a user.
 * Run with: node scripts/grant-admin-access.js <email>
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
  console.error('2. Get it from your Supabase Dashboard > Settings > API');
  console.error('3. Run: node scripts/grant-admin-access.js EMAIL SERVICE_KEY\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function grantAdminAccess(email) {
  try {
    console.log(`\n🔍 Looking up user: ${email}`);

    // Find the user by email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      throw new Error(`Database error: ${profileError.message}`);
    }

    if (!profile) {
      throw new Error(`User not found with email: ${email}`);
    }

    console.log(`✓ Found user: ${profile.full_name || 'No name'} (${profile.email})`);
    console.log(`  User ID: ${profile.id}`);

    // Check if user is already an admin
    const { data: existingRole, error: roleCheckError } = await supabase
      .from('system_roles')
      .select('role')
      .eq('user_id', profile.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleCheckError) {
      throw new Error(`Failed to check existing role: ${roleCheckError.message}`);
    }

    if (existingRole) {
      console.log('\n⚠️  User is already a system admin!');
      return;
    }

    // Grant admin access
    console.log('\n🔐 Granting admin access...');

    const { error: insertError } = await supabase
      .from('system_roles')
      .insert({
        user_id: profile.id,
        role: 'admin',
        granted_by: null,
        granted_at: new Date().toISOString()
      });

    if (insertError) {
      throw new Error(`Failed to grant admin access: ${insertError.message}`);
    }

    console.log('\n✅ Success! Admin access granted to:', email);
    console.log('\nThe user now has full system admin privileges.');
    console.log('They can:');
    console.log('  - Manage all users');
    console.log('  - Access admin panel');
    console.log('  - View audit logs');
    console.log('  - Manage system configuration');
    console.log('  - Suspend/restore users');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

async function listUsers() {
  try {
    console.log('\n📋 All users in the system:\n');

    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Check admin status for each user
    const { data: adminRoles, error: rolesError } = await supabase
      .from('system_roles')
      .select('user_id, role')
      .eq('role', 'admin');

    if (rolesError) throw rolesError;

    const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);

    users?.forEach((user, index) => {
      const isAdmin = adminUserIds.has(user.id);
      const badge = isAdmin ? '👑 ADMIN' : '   USER';
      console.log(`${badge}  ${user.email.padEnd(35)} ${user.full_name || '(no name)'}`);
    });

    console.log('\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.log('\n📘 Grant Admin Access Script');
  console.log('\nUsage:');
  console.log('  node scripts/grant-admin-access.js <email>');
  console.log('\nExamples:');
  console.log('  node scripts/grant-admin-access.js user@example.com');
  console.log('  npm run grant-admin user@example.com');
  console.log('\nTo list all users:');
  console.log('  node scripts/grant-admin-access.js --list\n');
  process.exit(1);
}

if (email === '--list' || email === '-l') {
  listUsers();
} else {
  grantAdminAccess(email);
}
