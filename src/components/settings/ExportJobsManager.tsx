import { useState, useEffect } from 'react';
import { Download, Loader } from 'lucide-react';
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
  const [latestJob, setLatestJob] = useState<ExportJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadLatestExportJob();

    // Poll for updates every 5 seconds
    const interval = setInterval(loadLatestExportJob, 5000);
    return () => clearInterval(interval);
  }, [businessId]);

  const loadLatestExportJob = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('export_jobs')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;
      setLatestJob(data);
      setError('');
    } catch (err: any) {
      logger.error('Failed to load export job', err, { businessId });
      // Don't show error for initial load
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

      logger.info('Export job started', { businessId }, 'USER_ACTION');

      // Reload job status
      await loadLatestExportJob();
    } catch (err: any) {
      logger.error('Failed to start export', err, { businessId });
      setError(err.message || 'Failed to start export');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!latestJob?.file_path) return;

    try {
      setDownloading(true);
      setError('');

      const { data, error: downloadError } = await supabase.storage
        .from('receipts')
        .download(latestJob.file_path);

      if (downloadError) throw downloadError;

      if (data) {
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${businessName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-export-${new Date(latestJob.created_at).toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        logger.info('Export downloaded', { jobId: latestJob.id, businessId }, 'USER_ACTION');
      }
    } catch (err: any) {
      logger.error('Failed to download export', err, { jobId: latestJob?.id });
      setError(err.message || 'Failed to download export');
    } finally {
      setDownloading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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

  // Determine what to show
  const isProcessing = latestJob && (latestJob.status === 'pending' || latestJob.status === 'processing');
  const isCompleted = latestJob?.status === 'completed' && latestJob.file_path;
  const isFailed = latestJob?.status === 'failed';

  return (
    <div className="flex items-center gap-3">
      {/* Export Button */}
      <button
        onClick={handleStartExport}
        disabled={loading || isProcessing}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        title="Export all business data (receipts, images, CSV files)"
      >
        {loading || isProcessing ? (
          <>
            <Loader className="animate-spin" size={16} />
            {isProcessing ? 'Processing...' : 'Starting...'}
          </>
        ) : (
          <>
            <Download size={16} />
            Export Data
          </>
        )}
      </button>

      {/* Download Button - Only show when export is ready */}
      {isCompleted && (
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          title={`Download ${formatFileSize(latestJob.file_size_bytes)} - ${getExpiresIn(latestJob.expires_at)}`}
        >
          {downloading ? (
            <>
              <Loader className="animate-spin" size={16} />
              Downloading...
            </>
          ) : (
            <>
              <Download size={16} />
              Download ({formatFileSize(latestJob.file_size_bytes)})
            </>
          )}
        </button>
      )}

      {/* Status Messages */}
      {isProcessing && (
        <span className="text-sm text-blue-600 dark:text-blue-400">
          Preparing export... You'll receive an email when ready.
        </span>
      )}

      {isFailed && (
        <span className="text-sm text-red-600 dark:text-red-400">
          Export failed: {latestJob.error_message}
        </span>
      )}

      {isCompleted && (
        <span className="text-sm text-orange-600 dark:text-orange-400">
          {getExpiresIn(latestJob.expires_at)}
        </span>
      )}

      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
