import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Trash2, RotateCcw, Search, Calendar, DollarSign, Building2, FolderOpen } from 'lucide-react';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { useAuth } from '../../contexts/AuthContext';

interface DeletedReceipt {
  id: string;
  vendor_name: string;
  total_amount: number;
  transaction_date: string;
  deleted_at: string;
  deleted_by: string;
  deleted_by_name?: string;
  collection_id: string;
  collection_name?: string;
  business_name?: string;
  file_path: string;
}

interface DeletedReceiptsManagementProps {
  scope?: 'admin' | 'owner';
}

export function DeletedReceiptsManagement({ scope = 'admin' }: DeletedReceiptsManagementProps) {
  const { user } = useAuth();
  const [deletedReceipts, setDeletedReceipts] = useState<DeletedReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    loadDeletedReceipts();
  }, []);

  const loadDeletedReceipts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select(`
          id,
          vendor_name,
          total_amount,
          transaction_date,
          deleted_at,
          deleted_by,
          file_path,
          collection_id,
          collections!inner(
            name,
            businesses!inner(
              name
            )
          )
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (error) throw error;

      const receiptsWithDetails = await Promise.all(
        (data || []).map(async (receipt: any) => {
          const { data: deletedByProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', receipt.deleted_by)
            .maybeSingle();

          return {
            id: receipt.id,
            vendor_name: receipt.vendor_name,
            total_amount: receipt.total_amount,
            transaction_date: receipt.transaction_date,
            deleted_at: receipt.deleted_at,
            deleted_by: receipt.deleted_by,
            deleted_by_name: deletedByProfile?.full_name || 'Unknown',
            collection_id: receipt.collection_id,
            collection_name: receipt.collections?.name,
            business_name: receipt.collections?.businesses?.name,
            file_path: receipt.file_path,
          };
        })
      );

      setDeletedReceipts(receiptsWithDetails);
    } catch (error) {
      console.error('Failed to load deleted receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (receiptId: string) => {
    if (!confirm('Are you sure you want to restore this receipt?')) return;

    setRestoring(receiptId);
    try {
      const { error } = await supabase
        .from('receipts')
        .update({
          deleted_at: null,
          deleted_by: null,
        })
        .eq('id', receiptId);

      if (error) throw error;

      await loadDeletedReceipts();
      alert('Receipt restored successfully');
    } catch (error) {
      console.error('Failed to restore receipt:', error);
      alert('Failed to restore receipt');
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (receiptId: string, filePath: string) => {
    if (!confirm('Are you sure you want to PERMANENTLY delete this receipt? This action cannot be undone.')) return;

    setRestoring(receiptId);
    try {
      if (filePath) {
        await supabase.storage.from('receipts').remove([filePath]);
      }

      const { error } = await supabase
        .from('receipts')
        .delete()
        .eq('id', receiptId);

      if (error) throw error;

      await loadDeletedReceipts();
      alert('Receipt permanently deleted');
    } catch (error) {
      console.error('Failed to permanently delete receipt:', error);
      alert('Failed to permanently delete receipt');
    } finally {
      setRestoring(null);
    }
  };

  const filteredReceipts = deletedReceipts.filter((receipt) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      receipt.vendor_name?.toLowerCase().includes(searchLower) ||
      receipt.business_name?.toLowerCase().includes(searchLower) ||
      receipt.collection_name?.toLowerCase().includes(searchLower) ||
      receipt.deleted_by_name?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {scope === 'owner' ? 'My Deleted Receipts' : 'Deleted Receipts'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {filteredReceipts.length} soft-deleted receipt(s)
            {scope === 'owner' && ' from your businesses'}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by vendor, business, collection, or deleted by..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
        />
      </div>

      {filteredReceipts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Trash2 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            {searchQuery ? 'No deleted receipts match your search' : 'No deleted receipts found'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Transaction Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Business / Collection
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Deleted By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Deleted At
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {receipt.vendor_name || 'Unknown Vendor'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900 dark:text-white">
                        <DollarSign className="w-4 h-4 mr-1 text-gray-400" />
                        {receipt.total_amount?.toFixed(2) || '0.00'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="w-4 h-4 mr-1" />
                        {receipt.transaction_date
                          ? new Date(receipt.transaction_date).toLocaleDateString()
                          : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-start text-sm">
                        <Building2 className="w-4 h-4 mr-1 text-gray-400 mt-0.5" />
                        <div>
                          <div className="text-gray-900 dark:text-white">
                            {receipt.business_name || 'Unknown'}
                          </div>
                          <div className="flex items-center text-gray-500 dark:text-gray-400 text-xs">
                            <FolderOpen className="w-3 h-3 mr-1" />
                            {receipt.collection_name || 'Unknown'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {receipt.deleted_by_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(receipt.deleted_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRestore(receipt.id)}
                          disabled={restoring === receipt.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {restoring === receipt.id ? (
                            <LoadingSpinner size="sm" />
                          ) : (
                            <>
                              <RotateCcw className="w-4 h-4" />
                              Restore
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(receipt.id, receipt.file_path)}
                          disabled={restoring === receipt.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Forever
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
