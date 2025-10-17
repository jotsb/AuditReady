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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ">
        <StatCard
          title="Total Expenses"
          value={statsLoading ? '...' : `$${stats.totalExpenses.toFixed(2)}`}
          icon={DollarSign}
          isLoading={statsLoading}
        />
        <StatCard
          title="Total Receipts"
          value={statsLoading ? '...' : stats.receiptCount.toString()}
          icon={Receipt}
          isLoading={statsLoading}
        />
        <StatCard
          title="This Month"
          value={statsLoading ? '...' : `$${stats.monthlyTotal.toFixed(2)}`}
          icon={Calendar}
          isLoading={statsLoading}
        />
        <StatCard
          title="Total Tax"
          value={statsLoading ? '...' : `$${stats.taxTotal.toFixed(2)}`}
          icon={TrendingUp}
          isLoading={statsLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryChart data={categoryData} isLoading={statsLoading} />
        <RecentReceipts
          receipts={recentReceipts || []}
          onViewReceipt={handleViewReceipt}
          isLoading={receiptsLoading}
        />
      </div>
    </div>
  );
}
