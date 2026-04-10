import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

export function AdminBulkOperationsTab() {
  const [operations, setOperations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBulkOperations();
  }, []);

  const loadBulkOperations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .in('category', ['USER_ACTION'])
        .ilike('message', '%bulk%')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setOperations(data || []);
    } catch (error) {
      logger.error('Error loading bulk operations', error as Error, { page: 'AdminBulkOperationsTab', operation: 'load' });
    } finally {
      setLoading(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('delete')) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    if (action.includes('categorize')) return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    if (action.includes('move')) return 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
    if (action.includes('export')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    return 'bg-slate-100 text-slate-800 dark:bg-gray-700 dark:text-gray-300';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-slate-600 dark:text-gray-400">Loading bulk operations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-gray-400">
          Track bulk actions performed by users ({operations.length} operations)
        </p>
        <button onClick={loadBulkOperations} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
          Refresh
        </button>
      </div>

      {operations.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
          <Activity size={48} className="mx-auto text-slate-400 dark:text-gray-500 mb-4" />
          <p className="text-slate-600 dark:text-gray-400">No bulk operations recorded yet</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-gray-900/50 border-b border-slate-200 dark:border-gray-700">
                <tr>
                  {['Timestamp', 'Action', 'Message', 'Details', 'Status'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-600 dark:text-gray-300 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                {operations.map((op) => {
                  const action = op.metadata?.action || 'unknown';
                  const isError = op.level === 'ERROR';
                  return (
                    <tr key={op.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/50 transition">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400">{new Date(op.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getActionBadgeColor(action)}`}>{action}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-800 dark:text-white">{op.message}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-gray-400">
                        {op.metadata?.receipt_count && <div>Receipts: {op.metadata.receipt_count}</div>}
                        {op.metadata?.execution_time_ms && <div>Time: {op.metadata.execution_time_ms}ms</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${isError ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                          {isError ? 'Failed' : 'Success'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
