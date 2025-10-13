import { useEffect, useState } from 'react';
import { DollarSign, Receipt, TrendingUp, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StatCard } from '../components/dashboard/StatCard';
import { CategoryChart } from '../components/dashboard/CategoryChart';
import { RecentReceipts } from '../components/dashboard/RecentReceipts';
import { usePageTracking, useDataLoadTracking } from '../hooks/usePageTracking';
import { actionTracker } from '../lib/actionTracker';

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

interface DashboardPageProps {
  onViewReceipt?: (id: string) => void;
}

export function DashboardPage({ onViewReceipt }: DashboardPageProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalExpenses: 0,
    receiptCount: 0,
    monthlyTotal: 0,
    taxTotal: 0,
  });
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  usePageTracking('Dashboard', { section: 'dashboard' });
  const logDataLoad = useDataLoadTracking('dashboard_stats');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: receipts, error } = await supabase
        .from('receipts')
        .select('*, collections(name, businesses(name))')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (receipts) {
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

        setStats({
          totalExpenses,
          receiptCount: receipts.length,
          monthlyTotal,
          taxTotal,
        });

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

        const chartData: CategoryData[] = Array.from(categoryMap.entries())
          .map(([name, amount]) => ({
            name,
            amount,
            color: categoryColors.get(name) || '#6B7280',
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 6);

        setCategoryData(chartData);
        setRecentReceipts(receipts.slice(0, 5));

        logDataLoad(receipts.length, {
          totalExpenses,
          receiptCount: receipts.length,
          monthlyTotal: monthlyReceipts.reduce((sum, r) => sum + Number(r.total_amount), 0),
          categoriesShown: chartData.length
        });
      }
    } catch (error) {
      logger.error('Error loading dashboard', error as Error, {
        page: 'DashboardPage',
        operation: 'load_dashboard'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewReceipt = (id: string) => {
    actionTracker.buttonClick('view_receipt_from_dashboard', { receiptId: id });
    if (onViewReceipt) {
      onViewReceipt(id);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-600 dark:text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ">
        <StatCard
          title="Total Expenses"
          value={`$${stats.totalExpenses.toFixed(2)}`}
          icon={DollarSign}
        />
        <StatCard
          title="Total Receipts"
          value={stats.receiptCount.toString()}
          icon={Receipt}
        />
        <StatCard
          title="This Month"
          value={`$${stats.monthlyTotal.toFixed(2)}`}
          icon={Calendar}
        />
        <StatCard
          title="Total Tax"
          value={`$${stats.taxTotal.toFixed(2)}`}
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryChart data={categoryData} />
        <RecentReceipts receipts={recentReceipts} onViewReceipt={handleViewReceipt} />
      </div>
    </div>
  );
}
