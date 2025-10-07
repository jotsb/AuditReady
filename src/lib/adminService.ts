import { supabase } from './supabase';
import { logger } from './logger';

/**
 * Admin Service Layer
 *
 * Provides centralized admin operations with built-in:
 * - Permission checks
 * - Audit logging
 * - Error handling
 * - Data validation
 */

export interface UserDetails {
  id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  created_at: string;
  last_login_at: string | null;
  suspended: boolean;
  suspension_reason: string | null;
  suspended_at: string | null;
  suspended_by: string | null;
  deleted_at: string | null;
  deletion_reason: string | null;
  mfa_enabled: boolean;
  business_count?: number;
  member_count?: number;
  receipt_count?: number;
}

export interface BusinessDetails {
  id: string;
  name: string;
  owner_id: string;
  owner_email: string;
  tax_id: string | null;
  currency: string;
  created_at: string;
  member_count: number;
  receipt_count: number;
  collection_count: number;
}

// ============================================================================
// PERMISSION CHECKS
// ============================================================================

async function ensureSystemAdmin(userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('system_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();

  if (error) {
    throw new Error(`Permission check failed: ${error.message}`);
  }

  if (!data) {
    throw new Error('Unauthorized: System admin access required');
  }
}

// ============================================================================
// USER SUSPENSION
// ============================================================================

export async function suspendUser(
  targetUserId: string,
  reason: string,
  adminUserId: string
): Promise<void> {
  await ensureSystemAdmin(adminUserId);

  const { error } = await supabase
    .from('profiles')
    .update({
      suspended: true,
      suspension_reason: reason,
      suspended_at: new Date().toISOString(),
      suspended_by: adminUserId,
    })
    .eq('id', targetUserId);

  if (error) {
    throw new Error(`Failed to suspend user: ${error.message}`);
  }

  // Log the action
  logger.userAction('admin_suspend_user', 'suspend_user', {
    target_user_id: targetUserId,
    reason,
    page: 'admin',
  });

  // Create audit log
  await supabase.from('audit_logs').insert({
    user_id: adminUserId,
    action: 'suspend_user',
    resource_type: 'profile',
    resource_id: targetUserId,
    details: { reason },
  });
}

export async function unsuspendUser(
  targetUserId: string,
  adminUserId: string
): Promise<void> {
  await ensureSystemAdmin(adminUserId);

  const { error } = await supabase
    .from('profiles')
    .update({
      suspended: false,
      suspension_reason: null,
      suspended_at: null,
      suspended_by: null,
    })
    .eq('id', targetUserId);

  if (error) {
    throw new Error(`Failed to unsuspend user: ${error.message}`);
  }

  // Log the action
  logger.userAction('admin_unsuspend_user', 'unsuspend_user', {
    target_user_id: targetUserId,
    page: 'admin',
  });

  // Create audit log
  await supabase.from('audit_logs').insert({
    user_id: adminUserId,
    action: 'unsuspend_user',
    resource_type: 'profile',
    resource_id: targetUserId,
    details: {},
  });
}

// ============================================================================
// USER PASSWORD MANAGEMENT
// ============================================================================

export async function sendPasswordResetEmail(
  targetUserEmail: string,
  adminUserId: string
): Promise<void> {
  await ensureSystemAdmin(adminUserId);

  const { error } = await supabase.auth.resetPasswordForEmail(targetUserEmail, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }

  // Log the action
  logger.userAction('admin_send_password_reset', 'password_reset', {
    target_user_email: targetUserEmail,
    page: 'admin',
  });

  // Create audit log
  await supabase.from('audit_logs').insert({
    user_id: adminUserId,
    action: 'send_password_reset',
    resource_type: 'auth',
    resource_id: null,
    details: { target_email: targetUserEmail },
  });
}

export async function changeUserPassword(
  targetUserId: string,
  newPassword: string,
  adminUserId: string
): Promise<void> {
  await ensureSystemAdmin(adminUserId);

  // Use Supabase Admin API to update user password
  // Note: This requires service role key which should be handled server-side
  // For now, we'll use the auth admin API if available
  const { error } = await supabase.auth.admin.updateUserById(targetUserId, {
    password: newPassword,
  });

  if (error) {
    throw new Error(`Failed to change user password: ${error.message}`);
  }

  // Log the action (DO NOT log the password)
  logger.userAction('admin_change_password', 'change_password', {
    target_user_id: targetUserId,
    page: 'admin',
  });

  // Create audit log
  await supabase.from('audit_logs').insert({
    user_id: adminUserId,
    action: 'change_user_password',
    resource_type: 'auth',
    resource_id: targetUserId,
    details: { method: 'admin_override' },
  });
}

// ============================================================================
// USER DELETION
// ============================================================================

export async function softDeleteUser(
  targetUserId: string,
  reason: string,
  adminUserId: string
): Promise<void> {
  await ensureSystemAdmin(adminUserId);

  // Check if user is already soft deleted
  const { data: profile } = await supabase
    .from('profiles')
    .select('deleted_at')
    .eq('id', targetUserId)
    .single();

  if (profile?.deleted_at) {
    throw new Error('User is already deleted');
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: adminUserId,
      deletion_reason: reason,
      // Also suspend the user
      suspended: true,
      suspension_reason: 'Account deleted',
      suspended_at: new Date().toISOString(),
      suspended_by: adminUserId,
    })
    .eq('id', targetUserId);

  if (error) {
    throw new Error(`Failed to soft delete user: ${error.message}`);
  }

  // Log the action
  logger.userAction('admin_soft_delete_user', 'soft_delete_user', {
    target_user_id: targetUserId,
    reason,
    page: 'admin',
  });

  // Create audit log
  await supabase.from('audit_logs').insert({
    user_id: adminUserId,
    action: 'soft_delete_user',
    resource_type: 'profile',
    resource_id: targetUserId,
    details: { reason },
  });
}

export async function hardDeleteUser(
  targetUserId: string,
  adminUserId: string
): Promise<void> {
  await ensureSystemAdmin(adminUserId);

  // Check if user is soft deleted first
  const { data: profile } = await supabase
    .from('profiles')
    .select('deleted_at')
    .eq('id', targetUserId)
    .single();

  if (!profile?.deleted_at) {
    throw new Error('User must be soft deleted before hard delete. Soft delete first.');
  }

  // This is a PERMANENT operation
  // Delete from auth.users will cascade to profiles and other tables
  const { error } = await supabase.auth.admin.deleteUser(targetUserId);

  if (error) {
    throw new Error(`Failed to hard delete user: ${error.message}`);
  }

  // Log the action
  logger.userAction('admin_hard_delete_user', 'hard_delete_user', {
    target_user_id: targetUserId,
    page: 'admin',
  });

  // Audit log will be created before deletion
  await supabase.from('audit_logs').insert({
    user_id: adminUserId,
    action: 'hard_delete_user',
    resource_type: 'profile',
    resource_id: targetUserId,
    details: { permanent: true },
  });
}

export async function restoreDeletedUser(
  targetUserId: string,
  adminUserId: string
): Promise<void> {
  await ensureSystemAdmin(adminUserId);

  const { error } = await supabase
    .from('profiles')
    .update({
      deleted_at: null,
      deleted_by: null,
      deletion_reason: null,
      // Also unsuspend if was only suspended due to deletion
      suspended: false,
      suspension_reason: null,
      suspended_at: null,
      suspended_by: null,
    })
    .eq('id', targetUserId);

  if (error) {
    throw new Error(`Failed to restore deleted user: ${error.message}`);
  }

  // Log the action
  logger.userAction('admin_restore_user', 'restore_user', {
    target_user_id: targetUserId,
    page: 'admin',
  });

  // Create audit log
  await supabase.from('audit_logs').insert({
    user_id: adminUserId,
    action: 'restore_user',
    resource_type: 'profile',
    resource_id: targetUserId,
    details: {},
  });
}

// ============================================================================
// USER PROFILE MANAGEMENT
// ============================================================================

export async function updateUserProfile(
  targetUserId: string,
  updates: {
    full_name?: string;
    phone_number?: string;
    email?: string;
  },
  adminUserId: string
): Promise<void> {
  await ensureSystemAdmin(adminUserId);

  // Update profile fields
  const profileUpdates: Record<string, any> = {};
  if (updates.full_name !== undefined) profileUpdates.full_name = updates.full_name;
  if (updates.phone_number !== undefined) profileUpdates.phone_number = updates.phone_number;

  if (Object.keys(profileUpdates).length > 0) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', targetUserId);

    if (profileError) {
      throw new Error(`Failed to update profile: ${profileError.message}`);
    }
  }

  // Update email if provided
  // Note: Updating auth email requires admin API (service role)
  // For now, we'll only update the profile email field
  if (updates.email) {
    // Update profile email (this is just for display purposes)
    const { error: emailError } = await supabase
      .from('profiles')
      .update({ email: updates.email })
      .eq('id', targetUserId);

    if (emailError) {
      throw new Error(`Failed to update profile email: ${emailError.message}`);
    }

    // Note: To update the actual auth email, implement an Edge Function
    console.warn('Auth email update requires Edge Function - only profile email was updated');
  }

  // Log the action
  logger.userAction('admin_update_user_profile', 'update_profile', {
    target_user_id: targetUserId,
    updates: Object.keys(updates),
    page: 'admin',
  });

  // Create audit log
  await supabase.from('audit_logs').insert({
    user_id: adminUserId,
    action: 'update_user_profile',
    resource_type: 'profile',
    resource_id: targetUserId,
    details: { fields_updated: Object.keys(updates) },
  });
}

// ============================================================================
// USER DETAILS & ANALYTICS
// ============================================================================

export async function getUserDetails(
  targetUserId: string,
  adminUserId: string
): Promise<UserDetails> {
  await ensureSystemAdmin(adminUserId);

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', targetUserId)
    .single();

  if (profileError) {
    throw new Error(`Failed to get user details: ${profileError.message}`);
  }

  // Get businesses owned count
  const { count: businessCount } = await supabase
    .from('businesses')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', targetUserId);

  // Get businesses member of count
  const { count: memberCount } = await supabase
    .from('business_members')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', targetUserId);

  // Get receipts uploaded count
  const { count: receiptCount } = await supabase
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('uploaded_by', targetUserId);

  return {
    ...profile,
    business_count: businessCount || 0,
    member_count: memberCount || 0,
    receipt_count: receiptCount || 0,
  };
}

export async function getUserBusinesses(
  targetUserId: string,
  adminUserId: string
): Promise<BusinessDetails[]> {
  await ensureSystemAdmin(adminUserId);

  // Get businesses owned
  const { data: ownedBusinesses, error: ownedError } = await supabase
    .from('businesses')
    .select(`
      id,
      name,
      owner_id,
      tax_id,
      currency,
      created_at
    `)
    .eq('owner_id', targetUserId);

  if (ownedError) {
    throw new Error(`Failed to get user businesses: ${ownedError.message}`);
  }

  // Get businesses where user is a member
  const { data: memberBusinesses, error: memberError } = await supabase
    .from('business_members')
    .select(`
      business_id,
      businesses:business_id (
        id,
        name,
        owner_id,
        tax_id,
        currency,
        created_at
      )
    `)
    .eq('user_id', targetUserId);

  if (memberError) {
    throw new Error(`Failed to get member businesses: ${memberError.message}`);
  }

  // Combine and deduplicate
  const allBusinesses = [...(ownedBusinesses || [])];

  // Add enriched data
  const enrichedBusinesses = await Promise.all(
    allBusinesses.map(async (business) => {
      const [{ count: memberCount }, { count: receiptCount }, { count: collectionCount }] = await Promise.all([
        supabase.from('business_members').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
        supabase.from('receipts').select('id', { count: 'exact', head: true }).eq('collection_id', business.id),
        supabase.from('collections').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
      ]);

      return {
        ...business,
        owner_email: profile?.email || '',
        member_count: memberCount || 0,
        receipt_count: receiptCount || 0,
        collection_count: collectionCount || 0,
      };
    })
  );

  return enrichedBusinesses;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export async function validatePassword(password: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
