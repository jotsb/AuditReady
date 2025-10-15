import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

interface DashboardStats {
  totalExpenses: number;
  receiptCount: number;
  monthlyTotal: number;
  taxTotal: number;
}

interface CategoryData {
  name: string;
  amount: number;
  color: string;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select('*')
        .is('parent_receipt_id', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error loading dashboard stats', error, { hook: 'useDashboardStats' });
        throw error;
      }

      if (!receipts) {
        return {
          stats: {
            totalExpenses: 0,
            receiptCount: 0,
            monthlyTotal: 0,
            taxTotal: 0,
          },
          categoryData: [],
          recentReceipts: [],
        };
      }

      const totalExpenses = receipts.reduce((sum, r) => sum + Number(r.total_amount), 0);
      const taxTotal = receipts.reduce(
        (sum, r) => sum + Number(r.gst_amount) + Number(r.pst_amount),
        0
      );

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();
      const monthlyReceipts = receipts.filter((r) => {
        const date = new Date(r.created_at);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });
      const monthlyTotal = monthlyReceipts.reduce((sum, r) => sum + Number(r.total_amount), 0);

      const stats: DashboardStats = {
        totalExpenses,
        receiptCount: receipts.length,
        monthlyTotal,
        taxTotal,
      };

      // Calculate category data
      const categoryMap = new Map<string, number>();
      receipts.forEach((receipt) => {
        const category = receipt.category || 'Uncategorized';
        const current = categoryMap.get(category) || 0;
        categoryMap.set(category, current + Number(receipt.total_amount));
      });

      const { data: categories } = await supabase
        .from('expense_categories')
        .select('name, color')
        .order('sort_order');

      const categoryColors = new Map(
        categories?.map((c) => [c.name, c.color || '#6B7280']) || []
      );

      const categoryData: CategoryData[] = Array.from(categoryMap.entries())
        .map(([name, amount]) => ({
          name,
          amount,
          color: categoryColors.get(name) || '#6B7280',
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6);

      return {
        stats,
        categoryData,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes - dashboard data changes frequently
  });
}

export function useRecentReceipts() {
  return useQuery({
    queryKey: ['recent-receipts'],
    queryFn: async () => {
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select(`
          *,
          collections(name, businesses(name))
        `)
        .is('parent_receipt_id', null)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) {
        logger.error('Error fetching recent receipts', error, { hook: 'useRecentReceipts' });
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

      return receipts;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
