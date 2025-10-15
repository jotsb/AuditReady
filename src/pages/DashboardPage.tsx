import { DollarSign, Receipt, TrendingUp, Calendar } from 'lucide-react';
import { StatCard } from '../components/dashboard/StatCard';
import { CategoryChart } from '../components/dashboard/CategoryChart';
import { RecentReceipts } from '../components/dashboard/RecentReceipts';
import { usePageTracking } from '../hooks/usePageTracking';
import { useDashboardStats, useRecentReceipts } from '../hooks/useDashboard';
import { actionTracker } from '../lib/actionTracker';

interface DashboardPageProps {
  onViewReceipt?: (id: string) => void;
}

export function DashboardPage({ onViewReceipt }: DashboardPageProps) {
  usePageTracking('Dashboard', { section: 'dashboard' });

  const { data: dashboardData, isLoading: statsLoading } = useDashboardStats();
  const { data: recentReceipts, isLoading: receiptsLoading } = useRecentReceipts();

  const loading = statsLoading || receiptsLoading;

  const stats = dashboardData?.stats || {
    totalExpenses: 0,
    receiptCount: 0,
    monthlyTotal: 0,
    taxTotal: 0,
  };

  const categoryData = dashboardData?.categoryData || [];

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
        <RecentReceipts receipts={recentReceipts || []} onViewReceipt={handleViewReceipt} />
      </div>
    </div>
  );
}
