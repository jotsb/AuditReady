import { supabase } from '../lib/supabase';
import { convertLocalDateToUTC } from '../lib/dateUtils';

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

  if (error) throw error;
}

export async function deleteReceipt(receiptId: string, userId: string) {
  const { error } = await supabase
    .from('receipts')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId
    })
    .eq('id', receiptId);

  if (error) throw error;
}

export async function bulkDeleteReceipts(receiptIds: string[], userId: string) {
  const { error } = await supabase
    .from('receipts')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId
    })
    .in('id', receiptIds);

  if (error) throw error;
}

export async function bulkCategorizeReceipts(receiptIds: string[], category: string) {
  const { error } = await supabase
    .from('receipts')
    .update({ category })
    .in('id', receiptIds);

  if (error) throw error;
}

export async function bulkMoveReceipts(receiptIds: string[], targetCollectionId: string) {
  const { error } = await supabase
    .from('receipts')
    .update({ collection_id: targetCollectionId })
    .in('id', receiptIds);

  if (error) throw error;
}

export async function deleteStorageFile(filePath: string) {
  await supabase.storage.from('receipts').remove([filePath]);
}
