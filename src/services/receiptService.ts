import { supabase } from '../lib/supabase';
import { convertLocalDateToUTC } from '../lib/dateUtils';
import { logger } from '../lib/logger';
import {
  sanitizeVendorName,
  sanitizeVendorAddress,
  sanitizeCategoryName,
  sanitizeText,
  sanitizeNotes
} from '../lib/sanitizer';

export interface ReceiptData {
  vendor_name?: string;
  vendor_address?: string;
  transaction_date?: string;
  transaction_time?: string;
  total_amount: string | number;
  subtotal?: string | number;
  gst_amount?: string | number;
  pst_amount?: string | number;
  gst_percent?: string | number;
  pst_percent?: string | number;
  category?: string;
  payment_method?: string;
  card_last_digits?: string;
  customer_name?: string;
  notes?: string;
}

export async function createReceipt(
  collectionId: string,
  userId: string,
  filePath: string,
  thumbnailPath: string,
  data: ReceiptData
) {
  const startTime = Date.now();
  const transactionDateUTC = data.transaction_date
    ? convertLocalDateToUTC(data.transaction_date)
    : null;

  // Sanitize all user inputs to prevent XSS
  const sanitizedData = {
    vendor_name: data.vendor_name ? sanitizeVendorName(data.vendor_name) : null,
    vendor_address: data.vendor_address ? sanitizeVendorAddress(data.vendor_address) : null,
    category: data.category ? sanitizeCategoryName(data.category) : null,
    payment_method: data.payment_method ? sanitizeText(data.payment_method) : null,
    customer_name: data.customer_name ? sanitizeText(data.customer_name) : null,
    card_last_digits: data.card_last_digits ? sanitizeText(data.card_last_digits) : null,
    notes: data.notes ? sanitizeNotes(data.notes) : null,
  };

  const { error } = await supabase
    .from('receipts')
    .insert({
      collection_id: collectionId,
      uploaded_by: userId,
      file_path: filePath,
      thumbnail_path: thumbnailPath,
      file_type: 'image',
      vendor_name: sanitizedData.vendor_name,
      vendor_address: sanitizedData.vendor_address,
      transaction_date: transactionDateUTC,
      total_amount: parseFloat(String(data.total_amount || 0)),
      subtotal: data.subtotal ? parseFloat(String(data.subtotal)) : null,
      gst_amount: data.gst_amount ? parseFloat(String(data.gst_amount)) : null,
      pst_amount: data.pst_amount ? parseFloat(String(data.pst_amount)) : null,
      category: sanitizedData.category,
      payment_method: sanitizedData.payment_method,
      notes: sanitizedData.notes,
      extraction_status: 'completed',
      extraction_data: {
        transaction_time: data.transaction_time,
        gst_percent: data.gst_percent,
        pst_percent: data.pst_percent,
        card_last_digits: sanitizedData.card_last_digits,
        customer_name: sanitizedData.customer_name,
      },
    });

  const executionTime = Date.now() - startTime;

  if (error) {
    logger.error('Failed to create receipt', error, {
      collectionId,
      userId,
      vendor: data.vendor_name,
      amount: data.total_amount,
      executionTimeMs: executionTime,
      errorCode: error.code,
      errorDetails: error.details
    });
    throw error;
  }

  logger.info('Receipt created successfully', {
    collectionId,
    userId,
    vendor: data.vendor_name,
    amount: data.total_amount,
    category: data.category,
    executionTimeMs: executionTime
  }, 'DATABASE');
}

export async function deleteReceipt(receiptId: string, userId: string) {
  const startTime = Date.now();
  const { error } = await supabase
    .from('receipts')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId
    })
    .eq('id', receiptId);

  const executionTime = Date.now() - startTime;

  if (error) {
    logger.error('Failed to delete receipt', error, {
      receiptId,
      userId,
      executionTimeMs: executionTime,
      errorCode: error.code
    });
    throw error;
  }

  logger.info('Receipt deleted (soft delete)', {
    receiptId,
    userId,
    executionTimeMs: executionTime
  }, 'DATABASE');
}

export async function bulkDeleteReceipts(receiptIds: string[], userId: string) {
  const startTime = Date.now();
  const { error } = await supabase
    .from('receipts')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId
    })
    .in('id', receiptIds);

  const executionTime = Date.now() - startTime;

  if (error) {
    logger.error('Failed to bulk delete receipts', error, {
      count: receiptIds.length,
      userId,
      executionTimeMs: executionTime,
      errorCode: error.code
    });
    throw error;
  }

  logger.info('Receipts bulk deleted', {
    count: receiptIds.length,
    userId,
    executionTimeMs: executionTime
  }, 'DATABASE');
}

export async function bulkCategorizeReceipts(receiptIds: string[], category: string) {
  const startTime = Date.now();
  const { error } = await supabase
    .from('receipts')
    .update({ category })
    .in('id', receiptIds);

  const executionTime = Date.now() - startTime;

  if (error) {
    logger.error('Failed to bulk categorize receipts', error, {
      count: receiptIds.length,
      category,
      executionTimeMs: executionTime,
      errorCode: error.code
    });
    throw error;
  }

  logger.info('Receipts categorized', {
    count: receiptIds.length,
    category,
    executionTimeMs: executionTime
  }, 'USER_ACTION');
}

export async function bulkMoveReceipts(receiptIds: string[], targetCollectionId: string) {
  const startTime = Date.now();
  const { error } = await supabase
    .from('receipts')
    .update({ collection_id: targetCollectionId })
    .in('id', receiptIds);

  const executionTime = Date.now() - startTime;

  if (error) {
    logger.error('Failed to bulk move receipts', error, {
      count: receiptIds.length,
      targetCollectionId,
      executionTimeMs: executionTime,
      errorCode: error.code
    });
    throw error;
  }

  logger.info('Receipts moved to collection', {
    count: receiptIds.length,
    targetCollectionId,
    executionTimeMs: executionTime
  }, 'USER_ACTION');
}

export async function deleteStorageFile(filePath: string) {
  await supabase.storage.from('receipts').remove([filePath]);
}

export async function recordLearning(
  businessId: string,
  originalVendorName: string | null,
  correctedVendorName: string | null,
  vendorName: string | null,
  category: string | null
) {
  try {
    if (originalVendorName && correctedVendorName &&
        originalVendorName.toLowerCase().trim() !== correctedVendorName.toLowerCase().trim()) {
      await supabase.rpc('record_vendor_correction', {
        p_business_id: businessId,
        p_extracted_name: originalVendorName,
        p_corrected_name: correctedVendorName
      });
    }

    if (vendorName && category) {
      await supabase.rpc('record_category_selection', {
        p_business_id: businessId,
        p_vendor_name: vendorName,
        p_category_name: category
      });
    }
  } catch (err) {
    logger.warn('Failed to record learning data', {
      businessId,
      originalVendorName,
      correctedVendorName,
      category,
      error: err instanceof Error ? err.message : 'Unknown error'
    });
  }
}

export async function getBusinessIdFromCollection(collectionId: string): Promise<string | null> {
  const { data } = await supabase
    .from('collections')
    .select('business_id')
    .eq('id', collectionId)
    .single();

  return data?.business_id || null;
}

export async function getPendingCategorySuggestions(businessId: string) {
  const { data, error } = await supabase
    .from('category_suggestions')
    .select(`
      id,
      receipt_id,
      current_category,
      suggested_category,
      reason,
      created_at,
      receipts!inner (
        id,
        vendor_name,
        total_amount,
        transaction_date
      )
    `)
    .eq('business_id', businessId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function acceptCategorySuggestion(suggestionId: string, userId: string) {
  const { data: suggestion, error: fetchError } = await supabase
    .from('category_suggestions')
    .select('receipt_id, suggested_category')
    .eq('id', suggestionId)
    .single();

  if (fetchError || !suggestion) throw fetchError || new Error('Suggestion not found');

  const { error: updateReceiptError } = await supabase
    .from('receipts')
    .update({ category: suggestion.suggested_category })
    .eq('id', suggestion.receipt_id);

  if (updateReceiptError) throw updateReceiptError;

  const { error: updateSuggestionError } = await supabase
    .from('category_suggestions')
    .update({
      status: 'accepted',
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId
    })
    .eq('id', suggestionId);

  if (updateSuggestionError) throw updateSuggestionError;
}

export async function rejectCategorySuggestion(suggestionId: string, userId: string) {
  const { error } = await supabase
    .from('category_suggestions')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId
    })
    .eq('id', suggestionId);

  if (error) throw error;
}

export async function bulkAcceptSuggestions(suggestionIds: string[], userId: string) {
  for (const id of suggestionIds) {
    await acceptCategorySuggestion(id, userId);
  }
}

export async function bulkRejectSuggestions(suggestionIds: string[], userId: string) {
  const { error } = await supabase
    .from('category_suggestions')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId
    })
    .in('id', suggestionIds);

  if (error) throw error;
}
