import { useState, useEffect } from 'react';
import { Calendar, DollarSign, TrendingUp, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface YearEndSummary {
  totalReceipts: number;
  totalAmount: number;
  totalGST: number;
  totalPST: number;
  categoryBreakdown: {
    category: string;
    amount: number;
    count: number;
    percentage: number;
  }[];
  monthlyTrend: {
    month: string;
    amount: number;
    count: number;
  }[];
  topVendors: {
    vendor: string;
    amount: number;
    count: number;
  }[];
  businessBreakdown: {
    business: string;
    amount: number;
    count: number;
  }[];
}

export function YearEndSummaryReport() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [summary, setSummary] = useState<YearEndSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select('*, collections(name, businesses(name))')
        .gte('transaction_date', `${year}-01-01`)
        .lte('transaction_date', `${year}-12-31`);

      if (error) throw error;

      const receipts = data || [];
      const totalAmount = receipts.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

      const categoryMap = new Map<string, { amount: number; count: number }>();
      receipts.forEach(receipt => {
        const category = receipt.category || 'Uncategorized';
        const current = categoryMap.get(category) || { amount: 0, count: 0 };
        categoryMap.set(category, {
          amount: current.amount + Number(receipt.total_amount || 0),
          count: current.count + 1
        });
      });

      const categoryBreakdown = Array.from(categoryMap.entries())
        .map(([category, data]) => ({
          category,
          amount: data.amount,
          count: data.count,
          percentage: (data.amount / totalAmount) * 100
        }))
        .sort((a, b) => b.amount - a.amount);

      const monthlyMap = new Map<string, { amount: number; count: number }>();
      receipts.forEach(receipt => {
        if (!receipt.transaction_date) return;
        const date = new Date(receipt.transaction_date);
        const monthKey = date.toLocaleString('default', { month: 'short' });
        const current = monthlyMap.get(monthKey) || { amount: 0, count: 0 };
        monthlyMap.set(monthKey, {
          amount: current.amount + Number(receipt.total_amount || 0),
          count: current.count + 1
        });
      });

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyTrend = months.map(month => ({
        month,
        amount: monthlyMap.get(month)?.amount || 0,
        count: monthlyMap.get(month)?.count || 0
      }));

      const vendorMap = new Map<string, { amount: number; count: number }>();
      receipts.forEach(receipt => {
        const vendor = receipt.vendor_name || 'Unknown';
        const current = vendorMap.get(vendor) || { amount: 0, count: 0 };
        vendorMap.set(vendor, {
          amount: current.amount + Number(receipt.total_amount || 0),
          count: current.count + 1
        });
      });

      const topVendors = Array.from(vendorMap.entries())
        .map(([vendor, data]) => ({
          vendor,
          amount: data.amount,
          count: data.count
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      const businessMap = new Map<string, { amount: number; count: number }>();
      receipts.forEach(receipt => {
        const business = (receipt.collections as any)?.businesses?.name || 'Unknown';
        const current = businessMap.get(business) || { amount: 0, count: 0 };
        businessMap.set(business, {
          amount: current.amount + Number(receipt.total_amount || 0),
          count: current.count + 1
        });
      });

      const businessBreakdown = Array.from(businessMap.entries())
        .map(([business, data]) => ({
          business,
          amount: data.amount,
          count: data.count
        }))
        .sort((a, b) => b.amount - a.amount);

      setSummary({
        totalReceipts: receipts.length,
        totalAmount,
        totalGST: receipts.reduce((sum, r) => sum + Number(r.gst_amount || 0), 0),
        totalPST: receipts.reduce((sum, r) => sum + Number(r.pst_amount || 0), 0),
        categoryBreakdown,
        monthlyTrend,
        topVendors,
        businessBreakdown
      });
    } catch (error) {
      console.error('Error generating year-end summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!summary) return;

    const sections = [
      ['YEAR-END SUMMARY', year],
      [''],
      ['OVERVIEW'],
      ['Total Receipts', summary.totalReceipts.toString()],
      ['Total Amount', `$${summary.totalAmount.toFixed(2)}`],
      ['Total GST', `$${summary.totalGST.toFixed(2)}`],
      ['Total PST', `$${summary.totalPST.toFixed(2)}`],
      [''],
      ['CATEGORY BREAKDOWN'],
      ['Category', 'Amount', 'Count', 'Percentage'],
      ...summary.categoryBreakdown.map(c => [c.category, `$${c.amount.toFixed(2)}`, c.count.toString(), `${c.percentage.toFixed(1)}%`]),
      [''],
      ['MONTHLY TREND'],
      ['Month', 'Amount', 'Count'],
      ...summary.monthlyTrend.map(m => [m.month, `$${m.amount.toFixed(2)}`, m.count.toString()]),
      [''],
      ['TOP VENDORS'],
      ['Vendor', 'Amount', 'Count'],
      ...summary.topVendors.map(v => [v.vendor, `$${v.amount.toFixed(2)}`, v.count.toString()])
    ];

    const csvContent = sections.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `year-end-summary-${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let i = currentYear; i >= currentYear - 10; i--) {
    years.push(i.toString());
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Year-End Summary Report</h3>
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Complete annual expense breakdown with category analysis and spending trends
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 ">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={generateReport}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Calendar size={20} />
            <span>{loading ? 'Generating...' : 'Generate Report'}</span>
          </button>

          {summary && (
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              <Download size={20} />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {summary && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar size={20} className="text-blue-600" />
                </div>
                <span className="text-sm text-slate-600 dark:text-gray-400">Total Receipts</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{summary.totalReceipts}</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign size={20} className="text-green-600" />
                </div>
                <span className="text-sm text-slate-600 dark:text-gray-400">Total Amount</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">${summary.totalAmount.toFixed(2)}</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp size={20} className="text-orange-600" />
                </div>
                <span className="text-sm text-slate-600 dark:text-gray-400">Total GST</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">${summary.totalGST.toFixed(2)}</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingUp size={20} className="text-red-600" />
                </div>
                <span className="text-sm text-slate-600 dark:text-gray-400">Total PST</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">${summary.totalPST.toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h4 className="text-lg font-semibold text-slate-800 mb-4">Category Breakdown</h4>
              <div className="space-y-3">
                {summary.categoryBreakdown.map((item, index) => (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">{item.category}</span>
                      <span className="text-sm text-slate-600 dark:text-gray-400">{item.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-slate-800 min-w-[80px] text-right">
                        ${item.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h4 className="text-lg font-semibold text-slate-800 mb-4">Top 10 Vendors</h4>
              <div className="space-y-2">
                {summary.topVendors.map((vendor, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-gray-800 rounded">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{vendor.vendor}</p>
                      <p className="text-xs text-slate-600 dark:text-gray-400">{vendor.count} receipts</p>
                    </div>
                    <span className="ml-3 text-sm font-semibold text-slate-800 dark:text-white">
                      ${vendor.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            <h4 className="text-lg font-semibold text-slate-800 mb-4">Monthly Spending Trend</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Month</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Amount</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700">Receipts</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.monthlyTrend.map((item, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-700">{item.month}</td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-800 text-right">${item.amount.toFixed(2)}</td>
                      <td className="py-3 px-4 text-sm text-slate-700 dark:text-gray-300 text-right">{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {summary.businessBreakdown.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <h4 className="text-lg font-semibold text-slate-800 mb-4">Business Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ">
                {summary.businessBreakdown.map((business, index) => (
                  <div key={index} className="p-4 bg-slate-50 dark:bg-gray-800 rounded-lg">
                    <p className="font-semibold text-slate-800 mb-2">{business.business}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-gray-400">{business.count} receipts</span>
                      <span className="font-semibold text-slate-800 dark:text-white">${business.amount.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!summary && !loading && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 dark:bg-gray-700 rounded-full mb-4">
            <Calendar size={32} className="text-slate-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No Report Generated</h3>
          <p className="text-slate-600 dark:text-gray-400">
            Select a year and click "Generate Report" to view year-end summary
          </p>
        </div>
      )}
    </div>
  );
}
