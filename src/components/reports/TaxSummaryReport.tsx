import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calendar, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TaxSummary {
  totalGST: number;
  totalPST: number;
  totalSubtotal: number;
  totalAmount: number;
  receiptCount: number;
  monthlyBreakdown: {
    month: string;
    gst: number;
    pst: number;
    total: number;
  }[];
}

export function TaxSummaryReport() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [selectedBusiness, setSelectedBusiness] = useState<string>('all');
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [summary, setSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadBusinesses();
  }, []);

  const loadBusinesses = async () => {
    try {
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .order('name');

      setBusinesses(data || []);
    } catch (error) {
      console.error('Error loading businesses:', error);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('receipts')
        .select('*, collections(business_id)')
        .gte('transaction_date', `${year}-01-01`)
        .lte('transaction_date', `${year}-12-31`);

      if (selectedBusiness !== 'all') {
        query = query.eq('collections.business_id', selectedBusiness);
      }

      const { data, error } = await query;

      if (error) throw error;

      const receipts = data || [];

      const totalGST = receipts.reduce((sum, r) => sum + Number(r.gst_amount || 0), 0);
      const totalPST = receipts.reduce((sum, r) => sum + Number(r.pst_amount || 0), 0);
      const totalSubtotal = receipts.reduce((sum, r) => sum + Number(r.subtotal || 0), 0);
      const totalAmount = receipts.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);

      const monthlyMap = new Map<string, { gst: number; pst: number; total: number }>();

      receipts.forEach(receipt => {
        if (!receipt.transaction_date) return;

        const date = new Date(receipt.transaction_date);
        const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });

        const current = monthlyMap.get(monthKey) || { gst: 0, pst: 0, total: 0 };
        monthlyMap.set(monthKey, {
          gst: current.gst + Number(receipt.gst_amount || 0),
          pst: current.pst + Number(receipt.pst_amount || 0),
          total: current.total + Number(receipt.total_amount || 0)
        });
      });

      const monthlyBreakdown = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({
          month,
          gst: data.gst,
          pst: data.pst,
          total: data.total
        }))
        .sort((a, b) => {
          const [aMonth, aYear] = a.month.split(' ');
          const [bMonth, bYear] = b.month.split(' ');
          if (aYear !== bYear) return parseInt(aYear) - parseInt(bYear);
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return months.indexOf(aMonth) - months.indexOf(bMonth);
        });

      setSummary({
        totalGST,
        totalPST,
        totalSubtotal,
        totalAmount,
        receiptCount: receipts.length,
        monthlyBreakdown
      });
    } catch (error) {
      console.error('Error generating tax summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!summary) return;

    const headers = ['Month', 'GST', 'PST', 'Total Amount'];
    const rows = summary.monthlyBreakdown.map(m => [
      m.month,
      m.gst.toFixed(2),
      m.pst.toFixed(2),
      m.total.toFixed(2)
    ]);

    const summaryRow = ['TOTAL', summary.totalGST.toFixed(2), summary.totalPST.toFixed(2), summary.totalAmount.toFixed(2)];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      '',
      summaryRow.map(cell => `"${cell}"`).join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tax-summary-${year}.csv`;
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
        <div className="mb-6">
          <h3 className="text-xl font-semibold text-slate-800 mb-2">Tax Summary Report</h3>
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Generate a comprehensive GST and PST summary for tax filing purposes
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

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
              Business
            </label>
            <select
              value={selectedBusiness}
              onChange={(e) => setSelectedBusiness(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Businesses</option>
              {businesses.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp size={20} className="text-orange-600" />
                </div>
                <span className="text-sm text-slate-600 dark:text-gray-400">Total GST</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">${summary.totalGST.toFixed(2)}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-red-100 rounded-lg">
                  <TrendingUp size={20} className="text-red-600" />
                </div>
                <span className="text-sm text-slate-600 dark:text-gray-400">Total PST</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">${summary.totalPST.toFixed(2)}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign size={20} className="text-green-600" />
                </div>
                <span className="text-sm text-slate-600 dark:text-gray-400">Total Amount</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">${summary.totalAmount.toFixed(2)}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar size={20} className="text-blue-600" />
                </div>
                <span className="text-sm text-slate-600 dark:text-gray-400">Receipts</span>
              </div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{summary.receiptCount}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <h4 className="text-lg font-semibold text-slate-800 mb-4">Monthly Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-gray-300">Month</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-gray-300">GST</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-gray-300">PST</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-gray-300">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.monthlyBreakdown.map((item, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-700 dark:text-gray-300">{item.month}</td>
                      <td className="py-3 px-4 text-sm text-slate-700 dark:text-gray-300 text-right">${item.gst.toFixed(2)}</td>
                      <td className="py-3 px-4 text-sm text-slate-700 dark:text-gray-300 text-right">${item.pst.toFixed(2)}</td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-800 text-right">${item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 dark:bg-gray-800 font-semibold">
                    <td className="py-3 px-4 text-sm text-slate-800 dark:text-white">TOTAL</td>
                    <td className="py-3 px-4 text-sm text-slate-800 text-right">${summary.totalGST.toFixed(2)}</td>
                    <td className="py-3 px-4 text-sm text-slate-800 text-right">${summary.totalPST.toFixed(2)}</td>
                    <td className="py-3 px-4 text-sm text-slate-800 text-right">${summary.totalAmount.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!summary && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 dark:bg-gray-700 rounded-full mb-4">
            <TrendingUp size={32} className="text-slate-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No Report Generated</h3>
          <p className="text-slate-600 dark:text-gray-400">
            Select a year and click "Generate Report" to view tax summary
          </p>
        </div>
      )}
    </div>
  );
}
