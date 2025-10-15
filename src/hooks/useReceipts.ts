import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

interface Receipt {
  id: string;
  vendor_name: string | null;
  transaction_date: string | null;
  total_amount: number;
  category: string | null;
  file_path: string | null;
  thumbnail_path: string | null;
  is_parent: boolean;
  total_pages: number;
  collections?: {
    name: string;
    businesses?: {
      name: string;
    };
  };
}

export function useReceipts() {
  return useQuery({
    queryKey: ['receipts'],
    queryFn: async () => {
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select(`
          *,
          collections(name, businesses(name))
        `)
        .is('parent_receipt_id', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching receipts', error, { hook: 'useReceipts' });
        throw error;
      }

      // Load first page thumbnails for multi-page receipts
      if (receipts) {
        const multiPageReceipts = receipts.filter((r: any) => r.is_parent === true);

        if (multiPageReceipts.length > 0) {
          const { data: pages } = await supabase
            .from('receipts')
            .select('parent_receipt_id, thumbnail_path, file_path')
            .in('parent_receipt_id', multiPageReceipts.map((r: any) => r.id))
            .eq('page_number', 1);

          if (pages) {
            const pageMap = new Map(pages.map((p: any) => [p.parent_receipt_id, p]));
            receipts.forEach((receipt: any) => {
              if (receipt.is_parent) {
                const firstPage = pageMap.get(receipt.id);
                if (firstPage) {
                  receipt.thumbnail_path = firstPage.thumbnail_path;
                  receipt.file_path = firstPage.file_path;
                }
              }
            });
          }
        }
      }

      return receipts as Receipt[];
    },
  });
}

export function useReceipt(id: string | undefined) {
  return useQuery({
    queryKey: ['receipt', id],
    queryFn: async () => {
      if (!id) throw new Error('Receipt ID is required');

      const { data, error } = await supabase
        .from('receipts')
        .select(`
          *,
          collections(id, name, businesses(id, name))
        `)
        .eq('id', id)
        .single();

      if (error) {
        logger.error('Error fetching receipt', error, { hook: 'useReceipt', receiptId: id });
        throw error;
      }

      return data;
    },
    enabled: !!id,
  });
}

export function useDeleteReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('receipts')
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}

export function useUpdateReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Receipt> }) => {
      const { error } = await supabase
        .from('receipts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['receipt', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
  });
}
