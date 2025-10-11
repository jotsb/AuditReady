import { useState } from 'react';
import { Ban, CheckCircle, Edit, Trash2, Download, HardDrive, AlertTriangle, X } from 'lucide-react';
import {
  suspendBusiness,
  unsuspendBusiness,
  softDeleteBusiness,
  restoreBusiness,
  updateBusinessDetails,
  exportBusinessData,
  setStorageLimit,
  checkStorageLimit,
  type BusinessStorageInfo
} from '../../lib/businessAdminService';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../lib/logger';

interface BusinessAdminActionsProps {
  business: {
    id: string;
    name: string;
    tax_id?: string;
    currency?: string;
    suspended?: boolean;
    suspension_reason?: string;
    soft_deleted?: boolean;
    deletion_reason?: string;
    storage_used_bytes?: number;
    storage_limit_bytes?: number;
  };
  onRefresh: () => void;
}

export function BusinessAdminActions({ business, onRefresh }: BusinessAdminActionsProps) {
  const { user } = useAuth();
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStorageModal, setShowStorageModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Suspend/Unsuspend state
  const [suspendReason, setSuspendReason] = useState('');

  // Edit state
  const [editName, setEditName] = useState(business.name);
  const [editTaxId, setEditTaxId] = useState(business.tax_id || '');
  const [editCurrency, setEditCurrency] = useState(business.currency || 'CAD');

  // Delete state
  const [deleteReason, setDeleteReason] = useState('');

  // Storage state
  const [storageLimit, setStorageLimitMB] = useState(
    Math.round((business.storage_limit_bytes || 10737418240) / 1048576)
  );
  const [storageInfo, setStorageInfo] = useState<BusinessStorageInfo | null>(null);

  const handleSuspend = async () => {
    if (!user || !suspendReason.trim()) {
      setError('Please provide a reason for suspension');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await suspendBusiness(business.id, suspendReason, user.id);
      setSuccess('Business suspended successfully');
      logger.info('Business suspended via admin UI', { businessId: business.id, businessName: business.name }, 'USER_ACTION');
      setTimeout(() => {
        setShowSuspendModal(false);
        onRefresh();
      }, 1500);
    } catch (err: any) {
      logger.error('Failed to suspend business', err, { businessId: business.id });
      setError(err.message || 'Failed to suspend business');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsuspend = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError('');
      await unsuspendBusiness(business.id, user.id);
      setSuccess('Business unsuspended successfully');
      logger.info('Business unsuspended via admin UI', { businessId: business.id, businessName: business.name }, 'USER_ACTION');
      setTimeout(() => {
        setShowSuspendModal(false);
        onRefresh();
      }, 1500);
    } catch (err: any) {
      logger.error('Failed to unsuspend business', err, { businessId: business.id });
      setError(err.message || 'Failed to unsuspend business');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!user || !editName.trim()) {
      setError('Business name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await updateBusinessDetails(
        business.id,
        {
          name: editName,
          tax_id: editTaxId || null,
          currency: editCurrency
        },
        user.id
      );
      setSuccess('Business updated successfully');
      logger.info('Business details updated via admin UI', { businessId: business.id, businessName: editName }, 'USER_ACTION');
      setTimeout(() => {
        setShowEditModal(false);
        onRefresh();
      }, 1500);
    } catch (err: any) {
      logger.error('Failed to update business', err, { businessId: business.id });
      setError(err.message || 'Failed to update business');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteReason.trim()) {
      setError('Please provide a reason for deletion');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await softDeleteBusiness(business.id, deleteReason, user.id);
      setSuccess('Business deleted successfully');
      logger.info('Business soft deleted via admin UI', { businessId: business.id, businessName: business.name }, 'USER_ACTION');
      setTimeout(() => {
        setShowDeleteModal(false);
        onRefresh();
      }, 1500);
    } catch (err: any) {
      logger.error('Failed to delete business', err, { businessId: business.id });
      setError(err.message || 'Failed to delete business');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError('');
      await restoreBusiness(business.id, user.id);
      setSuccess('Business restored successfully');
      logger.info('Business restored via admin UI', { businessId: business.id, businessName: business.name }, 'USER_ACTION');
      setTimeout(() => {
        setShowDeleteModal(false);
        onRefresh();
      }, 1500);
    } catch (err: any) {
      logger.error('Failed to restore business', err, { businessId: business.id });
      setError(err.message || 'Failed to restore business');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);
      setError('');
      const blob = await exportBusinessData(business.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `business-${business.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess('Business data exported successfully');
      logger.info('Business data exported via admin UI', { businessId: business.id, businessName: business.name }, 'USER_ACTION');
    } catch (err: any) {
      logger.error('Failed to export business data', err, { businessId: business.id });
      setError(err.message || 'Failed to export business data');
    } finally {
      setLoading(false);
    }
  };

  const loadStorageInfo = async () => {
    try {
      const info = await checkStorageLimit(business.id);
      setStorageInfo(info);
    } catch (err: any) {
      logger.error('Failed to load storage info', err, { businessId: business.id });
    }
  };

  const handleSetStorageLimit = async () => {
    if (!user || storageLimit < 0) {
      setError('Please enter a valid storage limit');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const limitBytes = storageLimit * 1048576; // Convert MB to bytes
      await setStorageLimit(business.id, limitBytes, user.id);
      setSuccess('Storage limit updated successfully');
      logger.info('Storage limit updated via admin UI', { businessId: business.id, limitMB: storageLimit }, 'USER_ACTION');
      await loadStorageInfo();
      setTimeout(() => {
        setShowStorageModal(false);
        onRefresh();
      }, 1500);
    } catch (err: any) {
      logger.error('Failed to set storage limit', err, { businessId: business.id });
      setError(err.message || 'Failed to set storage limit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 flex-wrap">
      {/* Suspend/Unsuspend Button */}
      {business.suspended ? (
        <button
          onClick={() => setShowSuspendModal(true)}
          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm"
          title="Unsuspend Business"
        >
          <CheckCircle size={16} />
          Unsuspend
        </button>
      ) : (
        <button
          onClick={() => setShowSuspendModal(true)}
          className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition flex items-center gap-2 text-sm"
          title="Suspend Business"
        >
          <Ban size={16} />
          Suspend
        </button>
      )}

      {/* Edit Button */}
      <button
        onClick={() => setShowEditModal(true)}
        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm"
        title="Edit Business"
      >
        <Edit size={16} />
        Edit
      </button>

      {/* Storage Button */}
      <button
        onClick={() => {
          loadStorageInfo();
          setShowStorageModal(true);
        }}
        className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2 text-sm"
        title="Manage Storage"
      >
        <HardDrive size={16} />
        Storage
      </button>

      {/* Delete/Restore Button */}
      {business.soft_deleted ? (
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 text-sm"
          title="Restore Business"
        >
          <CheckCircle size={16} />
          Restore
        </button>
      ) : (
        <button
          onClick={() => setShowDeleteModal(true)}
          className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 text-sm"
          title="Delete Business"
        >
          <Trash2 size={16} />
          Delete
        </button>
      )}

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={loading}
        className="px-3 py-1.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition flex items-center gap-2 text-sm disabled:opacity-50"
        title="Export Business Data"
      >
        <Download size={16} />
        Export
      </button>

      {/* Suspend/Unsuspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                {business.suspended ? 'Unsuspend Business' : 'Suspend Business'}
              </h3>
              <button
                onClick={() => setShowSuspendModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
                {success}
              </div>
            )}

            {business.suspended ? (
              <div className="space-y-4">
                <p className="text-slate-600 dark:text-gray-400">
                  Are you sure you want to unsuspend <strong>{business.name}</strong>?
                </p>
                {business.suspension_reason && (
                  <div className="p-3 bg-slate-50 dark:bg-gray-700 rounded border border-slate-200 dark:border-gray-600">
                    <p className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1">Current suspension reason:</p>
                    <p className="text-sm text-slate-700 dark:text-gray-300">{business.suspension_reason}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleUnsuspend}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Unsuspending...' : 'Unsuspend'}
                  </button>
                  <button
                    onClick={() => setShowSuspendModal(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-300 dark:hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-slate-600 dark:text-gray-400">
                  Suspending <strong>{business.name}</strong> will block all members from accessing it.
                </p>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                    Reason for Suspension *
                  </label>
                  <textarea
                    value={suspendReason}
                    onChange={(e) => setSuspendReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Violation of terms of service"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSuspend}
                    disabled={loading || !suspendReason.trim()}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Suspending...' : 'Suspend'}
                  </button>
                  <button
                    onClick={() => setShowSuspendModal(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-300 dark:hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Edit Business</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
                {success}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Business Name *
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Tax ID
                </label>
                <input
                  type="text"
                  value={editTaxId}
                  onChange={(e) => setEditTaxId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Currency
                </label>
                <select
                  value={editCurrency}
                  onChange={(e) => setEditCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleEdit}
                  disabled={loading || !editName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-300 dark:hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage Modal */}
      {showStorageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Storage Management</h3>
              <button
                onClick={() => setShowStorageModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
                {success}
              </div>
            )}

            <div className="space-y-4">
              {storageInfo && (
                <div>
                  <div className="flex justify-between text-sm text-slate-600 dark:text-gray-400 mb-2">
                    <span>Storage Used</span>
                    <span className="font-semibold">{storageInfo.used_mb.toFixed(2)} MB / {storageInfo.limit_mb.toFixed(2)} MB</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-gray-700 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        storageInfo.is_critical
                          ? 'bg-red-600'
                          : storageInfo.is_warning
                          ? 'bg-yellow-600'
                          : 'bg-green-600'
                      }`}
                      style={{ width: `${Math.min(storageInfo.usage_percent, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">
                    {storageInfo.usage_percent.toFixed(1)}% used
                  </p>

                  {storageInfo.is_critical && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                      <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-700 dark:text-red-400">Storage Critical</p>
                        <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                          Storage usage is above 95%. Consider increasing the limit or cleaning up old receipts.
                        </p>
                      </div>
                    </div>
                  )}

                  {storageInfo.is_warning && !storageInfo.is_critical && (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-2">
                      <AlertTriangle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Storage Warning</p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                          Storage usage is above 80%. Monitor usage and consider increasing the limit.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                  Storage Limit (MB)
                </label>
                <input
                  type="number"
                  value={storageLimit}
                  onChange={(e) => setStorageLimitMB(parseInt(e.target.value) || 0)}
                  min="0"
                  step="100"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">
                  Recommended: 10240 MB (10 GB) or higher
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSetStorageLimit}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
                >
                  {loading ? 'Setting...' : 'Set Limit'}
                </button>
                <button
                  onClick={() => setShowStorageModal(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-300 dark:hover:bg-gray-600 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete/Restore Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                {business.soft_deleted ? 'Restore Business' : 'Delete Business'}
              </h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
                {success}
              </div>
            )}

            {business.soft_deleted ? (
              <div className="space-y-4">
                <p className="text-slate-600 dark:text-gray-400">
                  Are you sure you want to restore <strong>{business.name}</strong>?
                </p>
                {business.deletion_reason && (
                  <div className="p-3 bg-slate-50 dark:bg-gray-700 rounded border border-slate-200 dark:border-gray-600">
                    <p className="text-xs font-semibold text-slate-600 dark:text-gray-400 mb-1">Deletion reason:</p>
                    <p className="text-sm text-slate-700 dark:text-gray-300">{business.deletion_reason}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleRestore}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Restoring...' : 'Restore'}
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-300 dark:hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    <strong>Warning:</strong> This will soft delete <strong>{business.name}</strong> and block access to all members. The business can be restored later.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                    Reason for Deletion *
                  </label>
                  <textarea
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                    placeholder="e.g., Requested by business owner"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={loading || !deleteReason.trim()}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {loading ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 rounded-lg hover:bg-slate-300 dark:hover:bg-gray-600 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
