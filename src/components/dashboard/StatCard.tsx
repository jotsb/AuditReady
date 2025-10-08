import { Video as LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6 hover:shadow-md transition">
      <div className="flex items-center justify-between mb-4">
        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <Icon size={24} className="text-blue-600 dark:text-blue-400" />
        </div>
        {trend && (
          <span
            className={`text-sm font-medium ${
              trendUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}
          >
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-slate-600 dark:text-gray-400 text-sm font-medium mb-1">{title}</h3>
      <p className="text-3xl font-bold text-slate-800 dark:text-white">{value}</p>
    </div>
  );
}
