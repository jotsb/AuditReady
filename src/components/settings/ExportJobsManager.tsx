import { useState, useEffect } from 'react';
import { Download, Clock, CheckCircle, XCircle, Loader, FileArchive, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { useAuth } from '../../contexts/AuthContext';

interface ExportJob {
  id: string;
  business_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_path: string | null;
  file_size_bytes: number;
  error_message: string | null;
  metadata: {
    receipts_count?: number;
    images_downloaded?: number;
    collections_count?: number;
  };
  created_at: string;
  completed_at: string | null;
  expires_at: string;
}

interface ExportJobsManagerProps {
  businessId: string;
  businessName: string;
}

export function ExportJobsManager({ businessId, businessName }: ExportJobsManagerProps) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadExportJobs();

    // Poll for updates every 10 seconds
    const interval = setInterval(loadExportJobs, 10000);
    return () => clearInterval(interval);
  }, [businessId]);

  const loadExportJobs = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('export_jobs')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (fetchError) throw fetchError;
      setJobs(data || []);
      setError('');
    } catch (err: any) {
      logger.error('Failed to load export jobs', err, { businessId });
      setError(err.message || 'Failed to load export jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (job: ExportJob) => {
    if (!job.file_path) return;

    try {
      setDownloading(job.id);
      setError('');

      const { data, error: downloadError } = await supabase.storage
        .from('receipts')
        .download(job.file_path);

      if (downloadError) throw downloadError;

      if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${businessName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-export-${new Date(job.created_at).toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        logger.info('Export downloaded successfully', { jobId: job.id, businessId }, 'USER_ACTION');
      }
    } catch (err: any) {
      logger.error('Failed to download export', err, { jobId: job.id });
      setError(err.message || 'Failed to download export');
    } finally {
      setDownloading(null);
    }
  };

  const handleStartExport = async () => {
    try {
      setLoading(true);
      setError('');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-export-job`;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ businessId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start export');
      }

      logger.info('Export job started from settings', { businessId }, 'USER_ACTION');

      // Reload jobs
      await loadExportJobs();
    } catch (err: any) {
      logger.error('Failed to start export', err, { businessId });
      setError(err.message || 'Failed to start export');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: ExportJob['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="text-slate-500" size={16} />;
      case 'processing':
        return <Loader className="text-blue-500 animate-spin" size={16} />;
      case 'completed':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'failed':
        return <XCircle className="text-red-500" size={16} />;
    }
  };

  const getStatusText = (status: ExportJob['status']) => {
    switch (status) {
      case 'pending':
        return 'Queued';
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Ready';
      case 'failed':
        return 'Failed';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getExpiresIn = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'Expires today';
    if (diffDays === 1) return 'Expires in 1 day';
    return `Expires in ${diffDays} days`;
  };

  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Data Exports</h3>
          <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
            Export all business data including receipts, images, and CSV files. Exports expire after 7 days.
          </p>
        </div>
        <button
          onClick={handleStartExport}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader className="animate-spin" size={16} />
              Starting...
            </>
          ) : (
            <>
              <FileArchive size={16} />
              New Export
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 dark:bg-gray-800 rounded-lg">
          <FileArchive className="mx-auto text-slate-400 mb-3" size={48} />
          <p className="text-slate-600 dark:text-gray-400">No exports yet</p>
          <p className="text-sm text-slate-500 dark:text-gray-500 mt-1">
            Click "New Export" to create your first data export
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(job.status)}
                    <span className="font-medium text-slate-800 dark:text-white">
                      {getStatusText(job.status)}
                    </span>
                    {job.status === 'completed' && job.file_size_bytes > 0 && (
                      <span className="text-sm text-slate-500 dark:text-gray-400">
                        {formatFileSize(job.file_size_bytes)}
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-slate-600 dark:text-gray-400 space-y-1">
                    <div>Created: {formatDate(job.created_at)}</div>
                    {job.completed_at && (
                      <div>Completed: {formatDate(job.completed_at)}</div>
                    )}
                    {job.status === 'completed' && (
                      <div className="text-orange-600 dark:text-orange-400">
                        {getExpiresIn(job.expires_at)}
                      </div>
                    )}
                    {job.metadata.receipts_count !== undefined && (
                      <div className="mt-2 text-xs">
                        Contains: {job.metadata.receipts_count} receipts, {job.metadata.images_downloaded} images, {job.metadata.collections_count} collections
                      </div>
                    )}
                    {job.error_message && (
                      <div className="text-red-600 dark:text-red-400 mt-2">
                        Error: {job.error_message}
                      </div>
                    )}
                  </div>
                </div>

                {job.status === 'completed' && job.file_path && (
                  <button
                    onClick={() => handleDownload(job)}
                    disabled={downloading === job.id}
                    className="ml-4 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloading === job.id ? (
                      <>
                        <Loader className="animate-spin" size={16} />
                        Downloading...
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        Download
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
