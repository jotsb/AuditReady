import { useState, useEffect } from 'react';
import { Copy, Search, Check, X, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  detectDuplicateReceipts,
  getPotentialDuplicates,
  updateDuplicateStatus,
  mergeDuplicateReceipts,
  type PotentialDuplicate
} from '../../lib/adminService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';

interface Receipt {
  id: string;
  vendor_name: string;
  transaction_date: string;
  total_amount: number;
  file_path: string | null;
}

export default function DuplicateDetectionManager() {
  const { user } = useAuth();
  const [duplicates, setDuplicates] = useState<PotentialDuplicate[]>([]);
  const [receipts, setReceipts] = useState<Record<string, Receipt>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadDuplicates();
  }, [user, statusFilter]);

  const loadDuplicates = async () => {
    if (!user) return;

    try {
      setError(null);
      const data = await getPotentialDuplicates(user.id, statusFilter === 'all' ? undefined : statusFilter);
      setDuplicates(data);

      const receiptIds = new Set<string>();
      data.forEach(dup => {
        receiptIds.add(dup.receipt_id);
        receiptIds.add(dup.duplicate_of_receipt_id);
      });

      if (receiptIds.size > 0) {
        const { data: receiptData, error: receiptError } = await supabase
          .from('receipts')
          .select('id, vendor_name, transaction_date, total_amount, file_path')
          .in('id', Array.from(receiptIds));

        if (receiptError) throw receiptError;

        const receiptMap: Record<string, Receipt> = {};
        receiptData?.forEach(r => {
          receiptMap[r.id] = r as Receipt;
        });
        setReceipts(receiptMap);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async () => {
    if (!user) return;

    setScanning(true);
    setError(null);

    try {
      const count = await detectDuplicateReceipts(user.id);
      alert(`Scan complete! Found ${count} potential duplicates.`);
      await loadDuplicates();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleUpdateStatus = async (duplicateId: string, status: 'confirmed' | 'dismissed') => {
    if (!user) return;

    try {
      await updateDuplicateStatus(duplicateId, status, user.id);
      await loadDuplicates();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMerge = async (duplicate: PotentialDuplicate, keepId: string) => {
    if (!user) return;

    const deleteId = keepId === duplicate.receipt_id
      ? duplicate.duplicate_of_receipt_id
      : duplicate.receipt_id;

    if (!confirm(`Are you sure you want to delete receipt ${deleteId} and keep ${keepId}? This action cannot be undone.`)) {
      return;
    }

    try {
      await mergeDuplicateReceipts(keepId, deleteId, user.id);
      await loadDuplicates();
      alert('Receipts merged successfully!');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
    if (score >= 80) return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
    return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      confirmed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      dismissed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      merged: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <Copy className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Duplicate Detection</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Find and manage duplicate receipts based on vendor, date, and amount
            </p>
          </div>
        </div>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {scanning ? (
            <>
              <LoadingSpinner size="sm" />
              Scanning...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              Scan for Duplicates
            </>
          )}
        </button>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
              <li>Compares receipts by vendor name, transaction date, and total amount</li>
              <li>Confidence score indicates likelihood of duplicate (70-100%)</li>
              <li>Review each match and confirm, dismiss, or merge receipts</li>
              <li>Merged receipts are soft-deleted and can be recovered if needed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'pending', 'confirmed', 'dismissed', 'merged'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {error && <ErrorAlert message={error} onRetry={loadDuplicates} />}

      {/* Duplicates List */}
      {duplicates.length > 0 ? (
        <div className="space-y-4">
          {duplicates.map((duplicate) => {
            const receipt1 = receipts[duplicate.receipt_id];
            const receipt2 = receipts[duplicate.duplicate_of_receipt_id];
            const isExpanded = expandedId === duplicate.id;

            if (!receipt1 || !receipt2) return null;

            return (
              <div
                key={duplicate.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  onClick={() => setExpandedId(isExpanded ? null : duplicate.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(duplicate.confidence_score)}`}>
                        {duplicate.confidence_score}% match
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{receipt1.vendor_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(receipt1.transaction_date).toLocaleDateString()} • ${receipt1.total_amount.toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(duplicate.status)}`}>
                        {duplicate.status}
                      </span>
                      <RefreshCw className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-700/50">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Receipt 1 */}
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Receipt A</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">ID:</span>
                            <span className="ml-2 font-mono text-xs">{receipt1.id}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Vendor:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">{receipt1.vendor_name}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Date:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">
                              {new Date(receipt1.transaction_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">${receipt1.total_amount.toFixed(2)}</span>
                          </div>
                        </div>
                        {duplicate.status === 'pending' && (
                          <button
                            onClick={() => handleMerge(duplicate, receipt1.id)}
                            className="mt-4 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            Keep This One
                          </button>
                        )}
                      </div>

                      {/* Receipt 2 */}
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Receipt B</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">ID:</span>
                            <span className="ml-2 font-mono text-xs">{receipt2.id}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Vendor:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">{receipt2.vendor_name}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Date:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">
                              {new Date(receipt2.transaction_date).toLocaleDateString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                            <span className="ml-2 text-gray-900 dark:text-white">${receipt2.total_amount.toFixed(2)}</span>
                          </div>
                        </div>
                        {duplicate.status === 'pending' && (
                          <button
                            onClick={() => handleMerge(duplicate, receipt2.id)}
                            className="mt-4 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                          >
                            Keep This One
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Match Details */}
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <span className="font-medium">Match Reason:</span> {duplicate.match_reason}
                      </p>
                    </div>

                    {/* Actions */}
                    {duplicate.status === 'pending' && (
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => handleUpdateStatus(duplicate.id, 'confirmed')}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                        >
                          <Check className="w-4 h-4" />
                          Confirm Duplicate
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(duplicate.id, 'dismissed')}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                        >
                          <X className="w-4 h-4" />
                          Not a Duplicate
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <Copy className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            {statusFilter === 'pending' ? 'No pending duplicates found' : `No ${statusFilter} duplicates`}
          </p>
          {statusFilter === 'pending' && (
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Click "Scan for Duplicates" to check for potential matches
            </p>
          )}
        </div>
      )}
    </div>
  );
}
