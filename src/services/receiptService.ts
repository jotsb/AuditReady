import { supabase } from '../lib/supabase';
import { convertLocalDateToUTC } from '../lib/dateUtils';
import { logger } from '../lib/logger';

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

  const { error } = await supabase
    .from('receipts')
    .insert({
      collection_id: collectionId,
      uploaded_by: userId,
      file_path: filePath,
      thumbnail_path: thumbnailPath,
      file_type: 'image',
      vendor_name: data.vendor_name,
      vendor_address: data.vendor_address,
      transaction_date: transactionDateUTC,
      total_amount: parseFloat(String(data.total_amount || 0)),
      subtotal: data.subtotal ? parseFloat(String(data.subtotal)) : null,
      gst_amount: data.gst_amount ? parseFloat(String(data.gst_amount)) : null,
      pst_amount: data.pst_amount ? parseFloat(String(data.pst_amount)) : null,
      category: data.category,
      payment_method: data.payment_method,
      extraction_status: 'completed',
      extraction_data: {
        transaction_time: data.transaction_time,
        gst_percent: data.gst_percent,
        pst_percent: data.pst_percent,
        card_last_digits: data.card_last_digits,
        customer_name: data.customer_name,
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
