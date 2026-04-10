import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

interface AnalyticsData {
  recentBusinesses: number;
  recentUsers: number;
  recentReceipts: number;
  totalReceiptAmount: number;
  topCategories: [string, number][];
  totalBusinesses: number;
  totalReceipts: number;
  totalUsers: number;
  totalCollections: number;
}

export function AdminAnalyticsTab() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [businessesResult, receiptsResult, usersResult, categoriesResult, collectionsResult] = await Promise.all([
        supabase.from('businesses').select('created_at'),
        supabase.from('receipts').select('created_at, amount').is('parent_receipt_id', null),
        supabase.from('profiles').select('created_at'),
        supabase.from('receipts').select('category').is('parent_receipt_id', null),
        supabase.from('collections').select('id'),
      ]);

      const now = new Date();
      const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recentBusinesses = businessesResult.data?.filter((b) => new Date(b.created_at) > last30Days).length || 0;
      const recentUsers = usersResult.data?.filter((u) => new Date(u.created_at) > last30Days).length || 0;
      const recentReceipts = receiptsResult.data?.filter((r) => new Date(r.created_at) > last7Days).length || 0;
      const totalReceiptAmount = receiptsResult.data?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;

      const categoryCounts =
        categoriesResult.data?.reduce(
          (acc, r) => {
            const cat = r.category || 'Uncategorized';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ) || {};

      const topCategories = Object.entries(categoryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5) as [string, number][];

      setAnalytics({
        recentBusinesses,
        recentUsers,
        recentReceipts,
        totalReceiptAmount,
        topCategories,
        totalBusinesses: businessesResult.data?.length || 0,
        totalReceipts: receiptsResult.data?.length || 0,
        totalUsers: usersResult.data?.length || 0,
        totalCollections: collectionsResult.data?.length || 0,
      });
    } catch (err: any) {
      logger.error('Error loading analytics', err as Error, { page: 'AdminAnalyticsTab', operation: 'load_analytics' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-6">
        <div className="text-center text-slate-600 dark:text-gray-400">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-6">
        <div className="text-center text-slate-600 dark:text-gray-400">No analytics data available</div>
      </div>
    );
  }

  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-cyan-500', 'bg-amber-500', 'bg-rose-500'];

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">Platform Analytics</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          <AnalyticCard label="New Businesses (30d)" value={analytics.recentBusinesses} subtitle={`of ${analytics.totalBusinesses} total`} colorFrom="from-blue-50" colorTo="to-blue-100" borderColor="border-blue-200" textColor="text-blue-600" valueColor="text-blue-700" subColor="text-blue-500" />
          <AnalyticCard label="New Users (30d)" value={analytics.recentUsers} subtitle={`of ${analytics.totalUsers} total`} colorFrom="from-emerald-50" colorTo="to-emerald-100" borderColor="border-emerald-200" textColor="text-emerald-600" valueColor="text-emerald-700" subColor="text-emerald-500" />
          <AnalyticCard label="New Receipts (7d)" value={analytics.recentReceipts} subtitle={`of ${analytics.totalReceipts} total`} colorFrom="from-cyan-50" colorTo="to-cyan-100" borderColor="border-cyan-200" textColor="text-cyan-600" valueColor="text-cyan-700" subColor="text-cyan-500" />
          <AnalyticCard label="Total Receipt Value" value={`$${analytics.totalReceiptAmount.toLocaleString()}`} subtitle="across all businesses" colorFrom="from-amber-50" colorTo="to-amber-100" borderColor="border-amber-200" textColor="text-amber-600" valueColor="text-amber-700" subColor="text-amber-500" />
        </div>

        <div className="border-t border-slate-200 dark:border-gray-700 pt-6">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4">Top Categories</h3>
          <div className="space-y-3">
            {analytics.topCategories.map(([category, count], index) => {
              const maxCount = analytics.topCategories[0][1];
              const percentage = (count / maxCount) * 100;
              return (
                <div key={category}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-gray-300">{category}</span>
                    <span className="text-sm text-slate-600 dark:text-gray-400">{count} receipts</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-gray-700 rounded-full h-2">
                    <div className={`${colors[index]} h-2 rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4">Growth Metrics</h3>
          <div className="space-y-3">
            <MetricRow label="Avg Receipts per Business" value={(analytics.totalReceipts / analytics.totalBusinesses || 0).toFixed(1)} />
            <MetricRow label="Total Collections" value={analytics.totalCollections} />
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-6">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4">Activity Summary</h3>
          <div className="space-y-3">
            <MetricRow label="Businesses Created Recently" value={analytics.recentBusinesses > 0 ? 'Active' : 'None'} />
            <MetricRow label="Platform Status" value="Operational" valueColor="text-emerald-600" />
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalyticCard({ label, value, subtitle, colorFrom, colorTo, borderColor, textColor, valueColor, subColor }: { label: string; value: string | number; subtitle: string; colorFrom: string; colorTo: string; borderColor: string; textColor: string; valueColor: string; subColor: string }) {
  return (
    <div className={`bg-gradient-to-br ${colorFrom} ${colorTo} rounded-lg p-4 border ${borderColor}`}>
      <div className={`text-sm ${textColor} font-medium mb-1`}>{label}</div>
      <div className={`text-3xl font-bold ${valueColor}`}>{value}</div>
      <div className={`text-xs ${subColor} mt-1`}>{subtitle}</div>
    </div>
  );
}

function MetricRow({ label, value, valueColor }: { label: string; value: string | number; valueColor?: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-gray-900/50 rounded-lg">
      <span className="text-slate-600 dark:text-gray-400 text-sm">{label}</span>
      <span className={`font-bold text-sm ${valueColor || 'text-slate-800 dark:text-white'}`}>{value}</span>
    </div>
  );
}
