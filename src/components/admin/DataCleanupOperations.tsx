import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Trash2, AlertTriangle, RefreshCw, CheckCircle, XCircle, Clock, FileX, Database, HardDrive } from 'lucide-react';
import { useLogger } from '../../hooks/useLogger';

interface CleanupJob {
  id: string;
  job_type: 'orphaned_files' | 'failed_extractions' | 'soft_deleted_receipts' | 'old_audit_logs';
  status: 'pending' | 'scanning' | 'ready' | 'running' | 'completed' | 'failed' | 'cancelled';
  items_found: number;
  items_processed: number;
  items_deleted: number;
  total_size_bytes: number;
  deleted_size_bytes: number;
  scan_results: any[];
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface CleanupOperation {
  type: 'orphaned_files' | 'failed_extractions' | 'soft_deleted_receipts';
  title: string;
  description: string;
  icon: any;
  color: string;
  warningText: string;
  scanFunction: string;
}

const operations: CleanupOperation[] = [
  {
    type: 'orphaned_files',
    title: 'Orphaned Files',
    description: 'Find and delete files in storage that have no corresponding database records',
    icon: FileX,
    color: 'orange',
    warningText: 'This will permanently delete files that cannot be linked to any receipt.',
    scanFunction: 'scan_orphaned_files'
  },
  {
    type: 'failed_extractions',
    title: 'Failed Extractions',
    description: 'Remove receipts that failed OCR processing (older than 7 days)',
    icon: XCircle,
    color: 'red',
    warningText: 'This will permanently delete receipts and their files that failed data extraction.',
    scanFunction: 'scan_failed_extractions'
  },
  {
    type: 'soft_deleted_receipts',
    title: 'Soft-Deleted Receipts',
    description: 'Permanently delete receipts that were soft-deleted over 30 days ago',
    icon: Trash2,
    color: 'purple',
    warningText: 'This will permanently delete receipts and their files that were marked for deletion.',
    scanFunction: 'scan_soft_deleted_receipts'
  }
];

export function DataCleanupOperations() {
  const [jobs, setJobs] = useState<CleanupJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const logger = useLogger();

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('cleanup_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      logger.error('Failed to load cleanup jobs', { error });
    } finally {
      setLoading(false);
    }
  };

  const scanForCleanup = async (operation: CleanupOperation) => {
    setScanning(operation.type);
    try {
      const { data: scanData, error: scanError } = await supabase
        .rpc(operation.scanFunction);

      if (scanError) throw scanError;

      const totalSize = scanData.reduce((sum: number, item: any) => sum + (item.file_size || 0), 0);

      const { error: insertError } = await supabase
        .from('cleanup_jobs')
        .insert({
          job_type: operation.type,
          status: 'ready',
          items_found: scanData.length,
          total_size_bytes: totalSize,
          scan_results: scanData,
          started_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (insertError) throw insertError;

      logger.info('Cleanup scan completed', {
        operation: operation.type,
        itemsFound: scanData.length,
        totalSizeBytes: totalSize
      });

      await loadJobs();
    } catch (error) {
      logger.error('Scan failed', { operation: operation.type, error });
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      alert(`Failed to scan for cleanup items.\n\nError: ${errorMessage}\n\nCheck console for full details.`);
    } finally {
      setScanning(null);
    }
  };

  const executeCleanup = async (jobId: string) => {
    console.log('executeCleanup called with jobId:', jobId);
    setDeleting(jobId);
    setShowConfirm(null);

    try {
      const job = jobs.find(j => j.id === jobId);
      if (!job) throw new Error('Job not found');

      console.log('Job found:', job);
      console.log('Job type:', job.job_type);
      console.log('Scan results count:', job.scan_results?.length);

      await supabase
        .from('cleanup_jobs')
        .update({ status: 'running' })
        .eq('id', jobId);

      let deletedCount = 0;
      let deletedSize = 0;

      console.log('Starting deletion loop for', job.scan_results?.length, 'items');

      for (const item of job.scan_results) {
        console.log('Processing item:', item);
        try {
          if (job.job_type === 'orphaned_files') {
            console.log('Deleting storage file:', item.storage_path);
            const { error } = await supabase.storage
              .from('receipts')
              .remove([item.storage_path]);

            if (error) {
              console.error('Failed to delete storage file:', error);
              logger.error('Failed to delete storage file', { jobId, item, error });
            } else {
              console.log('Successfully deleted:', item.storage_path);
              deletedCount++;
              deletedSize += item.file_size || 0;
            }
          } else if (job.job_type === 'failed_extractions' || job.job_type === 'soft_deleted_receipts') {
            const { error } = await supabase
              .from('receipts')
              .delete()
              .eq('id', item.receipt_id);

            if (error) {
              logger.error('Failed to delete receipt', { jobId, item, error });
            } else {
              deletedCount++;
              deletedSize += item.file_size || 0;
            }
          }
        } catch (itemError) {
          logger.error('Failed to delete item', { jobId, item, error: itemError });
        }
      }

      console.log('Deletion loop completed. Deleted:', deletedCount, 'items');

      await supabase
        .from('cleanup_jobs')
        .update({
          status: 'completed',
          items_deleted: deletedCount,
          deleted_size_bytes: deletedSize,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      logger.info('Cleanup completed', {
        jobId,
        jobType: job.job_type,
        itemsDeleted: deletedCount,
        deletedSizeBytes: deletedSize
      });

      console.log('Cleanup completed successfully');
      await loadJobs();
    } catch (error) {
      console.error('Cleanup failed:', error);
      logger.error('Cleanup failed', { jobId, error });

      await supabase
        .from('cleanup_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      alert(`Cleanup failed.\n\nError: ${errorMessage}\n\nCheck console for full details.`);
    } finally {
      setDeleting(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = (status: CleanupJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'failed':
        return <XCircle size={16} className="text-red-600" />;
      case 'running':
        return <RefreshCw size={16} className="text-blue-600 animate-spin" />;
      default:
        return <Clock size={16} className="text-slate-400" />;
    }
  };

  const getStatusColor = (status: CleanupJob['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'running':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'ready':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <RefreshCw className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-1">Data Cleanup Operations</p>
            <p>These operations permanently delete data and cannot be undone. Always review scan results before executing cleanup.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {operations.map((operation) => {
          const Icon = operation.icon;
          const recentJob = jobs.find(j => j.job_type === operation.type && j.status === 'ready');

          return (
            <div key={operation.type} className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-slate-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 bg-${operation.color}-100 dark:bg-${operation.color}-900/30 rounded-lg flex items-center justify-center`}>
                  <Icon className={`text-${operation.color}-600 dark:text-${operation.color}-400`} size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">{operation.title}</h3>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
                {operation.description}
              </p>

              {recentJob && (
                <div className="mb-4 p-3 bg-slate-50 dark:bg-gray-700/50 rounded border border-slate-200 dark:border-gray-600">
                  <div className="text-xs text-slate-600 dark:text-gray-400 mb-1">Scan Results:</div>
                  <div className="text-sm font-semibold text-slate-800 dark:text-white">
                    {recentJob.items_found} items found
                  </div>
                  <div className="text-xs text-slate-600 dark:text-gray-400">
                    Total size: {formatBytes(recentJob.total_size_bytes)}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => scanForCleanup(operation)}
                  disabled={scanning === operation.type}
                  className="flex-1 px-4 py-2 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
                >
                  {scanning === operation.type ? (
                    <>
                      <RefreshCw className="inline animate-spin mr-2" size={14} />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Database className="inline mr-2" size={14} />
                      Scan
                    </>
                  )}
                </button>

                {recentJob && (
                  <button
                    onClick={() => setShowConfirm(recentJob.id)}
                    disabled={deleting === recentJob.id}
                    className={`flex-1 px-4 py-2 bg-${operation.color}-600 text-white rounded-lg hover:bg-${operation.color}-700 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium`}
                  >
                    {deleting === recentJob.id ? (
                      <>
                        <RefreshCw className="inline animate-spin mr-2" size={14} />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="inline mr-2" size={14} />
                        Delete
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-slate-200 dark:border-gray-700">
        <div className="p-6 border-b border-slate-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Cleanup History</h3>
          <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">Recent cleanup operations</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Items Found
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Items Deleted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Size Freed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Started
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500 dark:text-gray-400">
                    No cleanup operations yet
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-800 dark:text-white capitalize">
                        {job.job_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400">
                      {job.items_found}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400">
                      {job.items_deleted || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400">
                      {job.deleted_size_bytes > 0 ? formatBytes(job.deleted_size_bytes) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-gray-400">
                      {new Date(job.started_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-600" size={24} />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Confirm Deletion</h3>
            </div>

            {(() => {
              const job = jobs.find(j => j.id === showConfirm);
              const operation = operations.find(o => o.type === job?.job_type);

              return (
                <>
                  <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
                    {operation?.warningText}
                  </p>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-4">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                      This will permanently delete {job?.items_found} items ({formatBytes(job?.total_size_bytes || 0)})
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                      This action cannot be undone!
                    </p>
                  </div>
                </>
              );
            })()}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 px-4 py-2 bg-slate-100 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-200 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => executeCleanup(showConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
