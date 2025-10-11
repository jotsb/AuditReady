import { supabase } from './supabase';
import { logger } from './logger';
import JSZip from 'jszip';

/**
 * Business Administration Service
 * Handles admin operations for business management including suspension, storage, and deletion
 */

export interface BusinessStorageInfo {
  used_bytes: number;
  limit_bytes: number;
  used_mb: number;
  limit_mb: number;
  usage_percent: number;
  is_warning: boolean;
  is_critical: boolean;
}

/**
 * Suspend a business
 */
export async function suspendBusiness(
  businessId: string,
  reason: string,
  adminUserId: string
): Promise<void> {
  logger.info('Suspending business', { businessId, adminUserId, hasReason: !!reason }, 'USER_ACTION');

  if (!reason || reason.trim().length === 0) {
    throw new Error('Reason is required for business suspension');
  }

  const { error } = await supabase
    .from('businesses')
    .update({
      suspended: true,
      suspension_reason: reason,
      suspended_at: new Date().toISOString(),
      suspended_by: adminUserId,
    })
    .eq('id', businessId);

  if (error) {
    logger.error('Failed to suspend business', error, { businessId, adminUserId });
    throw new Error(error.message || 'Failed to suspend business');
  }

  logger.info('Business suspended successfully', { businessId, reason }, 'SECURITY');
}

/**
 * Unsuspend a business
 */
export async function unsuspendBusiness(
  businessId: string,
  adminUserId: string
): Promise<void> {
  logger.info('Unsuspending business', { businessId, adminUserId }, 'USER_ACTION');

  const { error } = await supabase
    .from('businesses')
    .update({
      suspended: false,
      suspension_reason: null,
      suspended_at: null,
      suspended_by: null,
    })
    .eq('id', businessId);

  if (error) {
    logger.error('Failed to unsuspend business', error, { businessId, adminUserId });
    throw new Error(error.message || 'Failed to unsuspend business');
  }

  logger.info('Business unsuspended successfully', { businessId }, 'SECURITY');
}

/**
 * Soft delete a business
 */
export async function softDeleteBusiness(
  businessId: string,
  reason: string,
  adminUserId: string
): Promise<void> {
  logger.info('Soft deleting business', { businessId, adminUserId, hasReason: !!reason }, 'USER_ACTION');

  if (!reason || reason.trim().length === 0) {
    throw new Error('Reason is required for business deletion');
  }

  const { error } = await supabase
    .from('businesses')
    .update({
      soft_deleted: true,
      deletion_reason: reason,
      deleted_at: new Date().toISOString(),
      deleted_by: adminUserId,
    })
    .eq('id', businessId);

  if (error) {
    logger.error('Failed to soft delete business', error, { businessId, adminUserId });
    throw new Error(error.message || 'Failed to delete business');
  }

  logger.info('Business soft deleted successfully', { businessId, reason }, 'SECURITY');
}

/**
 * Restore a soft deleted business
 */
export async function restoreBusiness(
  businessId: string,
  adminUserId: string
): Promise<void> {
  logger.info('Restoring soft deleted business', { businessId, adminUserId }, 'USER_ACTION');

  const { error } = await supabase
    .from('businesses')
    .update({
      soft_deleted: false,
      deletion_reason: null,
      deleted_at: null,
      deleted_by: null,
    })
    .eq('id', businessId);

  if (error) {
    logger.error('Failed to restore business', error, { businessId, adminUserId });
    throw new Error(error.message || 'Failed to restore business');
  }

  logger.info('Business restored successfully', { businessId }, 'SECURITY');
}

/**
 * Update business details (name, tax ID, currency)
 */
export async function updateBusinessDetails(
  businessId: string,
  updates: {
    name?: string;
    tax_id?: string;
    currency?: string;
  },
  adminUserId: string
): Promise<void> {
  logger.info('Updating business details', { businessId, adminUserId, fields: Object.keys(updates) }, 'USER_ACTION');

  const { error } = await supabase
    .from('businesses')
    .update(updates)
    .eq('id', businessId);

  if (error) {
    logger.error('Failed to update business details', error, { businessId, adminUserId, updates });
    throw new Error(error.message || 'Failed to update business');
  }

  // Log to audit logs
  const { error: auditError } = await supabase
    .from('audit_logs')
    .insert({
      user_id: adminUserId,
      action: 'admin_update_business',
      resource_type: 'business',
      resource_id: businessId,
      details: {
        updates,
        via: 'admin_service'
      }
    });

  if (auditError) {
    logger.error('Failed to log business update to audit logs', auditError, { businessId });
  }

  logger.info('Business details updated successfully', { businessId, fields: Object.keys(updates) }, 'DATABASE');
}

/**
 * Calculate storage usage for a business
 */
export async function calculateBusinessStorage(businessId: string): Promise<number> {
  logger.info('Calculating business storage usage', { businessId }, 'PERFORMANCE');

  const startTime = Date.now();

  const { data, error } = await supabase.rpc('calculate_business_storage', {
    business_id_param: businessId
  });

  const executionTime = Date.now() - startTime;

  if (error) {
    logger.error('Failed to calculate business storage', error, { businessId, executionTime });
    throw new Error(error.message || 'Failed to calculate storage');
  }

  const storageBytes = data as number;
  logger.info('Business storage calculated', {
    businessId,
    storageBytes,
    storageMB: Math.round(storageBytes / 1048576 * 100) / 100,
    executionTime
  }, 'PERFORMANCE');

  return storageBytes;
}

/**
 * Check storage limit for a business
 */
export async function checkStorageLimit(businessId: string): Promise<BusinessStorageInfo> {
  logger.debug('Checking business storage limit', { businessId }, 'DATABASE');

  const { data, error } = await supabase.rpc('check_storage_limit', {
    business_id_param: businessId
  });

  if (error) {
    logger.error('Failed to check storage limit', error, { businessId });
    throw new Error(error.message || 'Failed to check storage limit');
  }

  const storageInfo = data as BusinessStorageInfo;

  if (storageInfo.is_critical) {
    logger.warn('Business storage critical', { businessId, usage_percent: storageInfo.usage_percent }, 'SECURITY');
  } else if (storageInfo.is_warning) {
    logger.warn('Business storage warning', { businessId, usage_percent: storageInfo.usage_percent }, 'PERFORMANCE');
  }

  return storageInfo;
}

/**
 * Set storage limit for a business
 */
export async function setStorageLimit(
  businessId: string,
  limitBytes: number,
  adminUserId: string
): Promise<void> {
  logger.info('Setting business storage limit', { businessId, adminUserId, limitBytes, limitMB: Math.round(limitBytes / 1048576) }, 'USER_ACTION');

  if (limitBytes < 0) {
    throw new Error('Storage limit must be a positive number');
  }

  const { error } = await supabase
    .from('businesses')
    .update({
      storage_limit_bytes: limitBytes
    })
    .eq('id', businessId);

  if (error) {
    logger.error('Failed to set storage limit', error, { businessId, adminUserId, limitBytes });
    throw new Error(error.message || 'Failed to set storage limit');
  }

  // Log to audit logs
  const { error: auditError } = await supabase
    .from('audit_logs')
    .insert({
      user_id: adminUserId,
      action: 'admin_set_storage_limit',
      resource_type: 'business',
      resource_id: businessId,
      details: {
        limit_bytes: limitBytes,
        limit_mb: Math.round(limitBytes / 1048576),
        via: 'admin_service'
      }
    });

  if (auditError) {
    logger.error('Failed to log storage limit change to audit logs', auditError, { businessId });
  }

  logger.info('Business storage limit set successfully', { businessId, limitBytes }, 'DATABASE');
}

/**
 * Get business with all admin info (suspension, storage, deletion status)
 */
export async function getBusinessAdminInfo(businessId: string) {
  logger.debug('Fetching business admin info', { businessId }, 'DATABASE');

  const { data, error } = await supabase
    .from('businesses')
    .select('*, profiles!businesses_owner_id_fkey(email, full_name)')
    .eq('id', businessId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch business admin info', error, { businessId });
    throw new Error(error.message || 'Failed to fetch business info');
  }

  if (!data) {
    throw new Error('Business not found');
  }

  // Get storage info
  const storageInfo = await checkStorageLimit(businessId);

  return {
    ...data,
    storage_info: storageInfo
  };
}

/**
 * Export business data including receipt images as a ZIP file
 * GDPR compliant - includes all business data and files
 */
export async function exportBusinessData(businessId: string): Promise<Blob> {
  logger.info('Exporting business data with images', { businessId }, 'USER_ACTION');

  const startTime = Date.now();

  // Fetch business data
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (businessError) throw businessError;

  // Fetch collections
  const { data: collections, error: collectionsError } = await supabase
    .from('collections')
    .select('*')
    .eq('business_id', businessId);

  if (collectionsError) throw collectionsError;

  // Fetch receipts
  const collectionIds = collections?.map(c => c.id) || [];
  let receipts: any[] = [];

  if (collectionIds.length > 0) {
    const { data: receiptsData, error: receiptsError } = await supabase
      .from('receipts')
      .select('*')
      .in('collection_id', collectionIds);

    if (receiptsError) throw receiptsError;
    receipts = receiptsData || [];
  }

  // Fetch members
  const { data: members, error: membersError } = await supabase
    .from('business_members')
    .select('*, profiles(email, full_name)')
    .eq('business_id', businessId);

  if (membersError) throw membersError;

  // Create ZIP file
  const zip = new JSZip();

  // Add metadata JSON
  const exportData = {
    business,
    collections,
    receipts: receipts.map(r => ({
      id: r.id,
      merchant_name: r.merchant_name,
      amount: r.amount,
      currency: r.currency,
      date: r.date,
      category: r.category,
      notes: r.notes,
      verified: r.verified,
      collection_id: r.collection_id,
      created_at: r.created_at,
      file_name: r.file_path ? `receipts/${r.id}_${r.merchant_name || 'receipt'}.jpg` : null
    })),
    members: members?.map(m => ({
      role: m.role,
      email: m.profiles?.email,
      full_name: m.profiles?.full_name,
      joined_at: m.created_at
    })),
    exported_at: new Date().toISOString(),
    export_version: '2.0'
  };

  zip.file('business_data.json', JSON.stringify(exportData, null, 2));

  // Create receipts folder
  const receiptsFolder = zip.folder('receipts');

  if (receiptsFolder && receipts.length > 0) {
    logger.info('Downloading receipt images', { count: receipts.length }, 'PERFORMANCE');

    // Download all receipt images
    let downloadedCount = 0;
    let failedCount = 0;

    for (const receipt of receipts) {
      if (receipt.file_path) {
        try {
          // Download from Supabase Storage
          const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('receipts')
            .download(receipt.file_path);

          if (downloadError) {
            logger.warn('Failed to download receipt image', { receiptId: receipt.id, error: downloadError.message }, 'ERROR');
            failedCount++;
            continue;
          }

          if (fileData) {
            // Add to ZIP with organized filename
            const fileName = `${receipt.id}_${(receipt.merchant_name || 'receipt').replace(/[^a-z0-9]/gi, '_')}.jpg`;
            receiptsFolder.file(fileName, fileData);
            downloadedCount++;
          }
        } catch (error: any) {
          logger.error('Error downloading receipt', error, { receiptId: receipt.id });
          failedCount++;
        }
      }
    }

    logger.info('Receipt images processed', {
      total: receipts.length,
      downloaded: downloadedCount,
      failed: failedCount
    }, 'PERFORMANCE');
  }

  // Generate ZIP blob
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const executionTime = Date.now() - startTime;

  logger.info('Business data exported successfully', {
    businessId,
    collections_count: collections?.length || 0,
    receipts_count: receipts.length,
    members_count: members?.length || 0,
    zip_size_bytes: zipBlob.size,
    zip_size_mb: (zipBlob.size / 1048576).toFixed(2),
    executionTime
  }, 'PERFORMANCE');

  return zipBlob;
}
