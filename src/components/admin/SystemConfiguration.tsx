import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Database, Mail, FileText, HardDrive, Shield, Settings, Save, RefreshCw, AlertCircle, Check, Info } from 'lucide-react';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { useLogger } from '../../hooks/useLogger';

interface SystemConfig {
  // Storage Settings
  max_file_size_mb: number;
  allowed_file_types: string[];
  storage_quota_gb: number;

  // Email Settings
  smtp_enabled: boolean;
  email_from_name: string;
  email_from_address: string;

  // Application Settings
  app_name: string;
  app_version: string;
  maintenance_mode: boolean;

  // Feature Flags
  mfa_required: boolean;
  email_verification_required: boolean;
  ai_extraction_enabled: boolean;
  multi_page_receipts_enabled: boolean;
}

const DEFAULT_CONFIG: SystemConfig = {
  max_file_size_mb: 10,
  allowed_file_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  storage_quota_gb: 10,
  smtp_enabled: false,
  email_from_name: 'Audit Proof',
  email_from_address: 'noreply@auditproof.com',
  app_name: 'Audit Proof',
  app_version: '0.8.3',
  maintenance_mode: false,
  mfa_required: false,
  email_verification_required: true,
  ai_extraction_enabled: true,
  multi_page_receipts_enabled: true,
};

export function SystemConfiguration() {
  const logger = useLogger();
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError('');

      // Call the RPC function to get system config
      const { data, error: fetchError } = await supabase.rpc('get_system_config');

      if (fetchError) throw fetchError;

      if (data) {
        // Map database format to component format
        setConfig({
          max_file_size_mb: data.storage_settings.max_file_size_mb,
          allowed_file_types: data.storage_settings.allowed_file_types,
          storage_quota_gb: data.storage_settings.default_storage_quota_gb,
          smtp_enabled: data.email_settings.smtp_enabled,
          email_from_name: data.email_settings.email_from_name,
          email_from_address: data.email_settings.email_from_address,
          app_name: data.app_settings.app_name,
          app_version: data.app_settings.app_version,
          maintenance_mode: data.app_settings.maintenance_mode,
          mfa_required: data.feature_flags.mfa_required,
          email_verification_required: data.feature_flags.email_verification_required,
          ai_extraction_enabled: data.feature_flags.ai_extraction_enabled,
          multi_page_receipts_enabled: data.feature_flags.multi_page_receipts_enabled,
        });
      }

      setHasChanges(false);

      logger.info('Loaded system configuration', {
        page: 'AdminPage',
        section: 'SystemConfiguration',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load system configuration';
      setError(message);
      logger.error('Failed to load system configuration', err as Error, {
        page: 'AdminPage',
        section: 'SystemConfiguration',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Call the RPC function to update system config
      const { data, error: saveError } = await supabase.rpc('update_system_config', {
        p_storage_settings: {
          max_file_size_mb: config.max_file_size_mb,
          allowed_file_types: config.allowed_file_types,
          default_storage_quota_gb: config.storage_quota_gb,
        },
        p_email_settings: {
          smtp_enabled: config.smtp_enabled,
          email_from_name: config.email_from_name,
          email_from_address: config.email_from_address,
        },
        p_app_settings: {
          app_name: config.app_name,
          app_version: config.app_version,
          maintenance_mode: config.maintenance_mode,
        },
        p_feature_flags: {
          mfa_required: config.mfa_required,
          email_verification_required: config.email_verification_required,
          ai_extraction_enabled: config.ai_extraction_enabled,
          multi_page_receipts_enabled: config.multi_page_receipts_enabled,
        },
      });

      if (saveError) throw saveError;

      setHasChanges(false);
      setSuccess('System configuration saved successfully');
      setTimeout(() => setSuccess(''), 3000);

      logger.info('Saved system configuration', {
        page: 'AdminPage',
        section: 'SystemConfiguration',
        config,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save system configuration';
      setError(message);
      logger.error('Failed to save system configuration', err as Error, {
        page: 'AdminPage',
        section: 'SystemConfiguration',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<SystemConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Configuration</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage system-wide settings and configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <button
              onClick={saveConfig}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
          <button
            onClick={loadConfig}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <Check className="w-5 h-5" />
          {success}
        </div>
      )}


      {/* Storage Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <HardDrive className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Storage Settings</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum File Size (MB)
            </label>
            <input
              type="number"
              value={config.max_file_size_mb}
              onChange={(e) => updateConfig({ max_file_size_mb: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              max="100"
            />
            <p className="mt-1 text-xs text-gray-500">Maximum file size for receipt uploads</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Default Storage Quota (GB per business)
            </label>
            <input
              type="number"
              value={config.storage_quota_gb}
              onChange={(e) => updateConfig({ storage_quota_gb: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              max="1000"
            />
            <p className="mt-1 text-xs text-gray-500">Default storage limit for new businesses</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Allowed File Types
            </label>
            <div className="space-y-2">
              {config.allowed_file_types.map((type, index) => (
                <div key={index} className="inline-flex items-center mr-4">
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                    {type}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">MIME types allowed for upload</p>
          </div>
        </div>
      </div>

      {/* Email Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Mail className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Email Settings</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-700">SMTP Email Delivery</label>
              <p className="text-xs text-gray-500 mt-1">Use custom SMTP server for email delivery</p>
            </div>
            <button
              onClick={() => updateConfig({ smtp_enabled: !config.smtp_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.smtp_enabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.smtp_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email From Name
            </label>
            <input
              type="text"
              value={config.email_from_name}
              onChange={(e) => updateConfig({ email_from_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Audit Proof"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email From Address
            </label>
            <input
              type="email"
              value={config.email_from_address}
              onChange={(e) => updateConfig({ email_from_address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="noreply@auditproof.com"
            />
          </div>
        </div>
      </div>

      {/* Application Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Application Settings</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Application Name
            </label>
            <input
              type="text"
              value={config.app_name}
              onChange={(e) => updateConfig({ app_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Application Version
            </label>
            <input
              type="text"
              value={config.app_version}
              onChange={(e) => updateConfig({ app_version: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              readOnly
            />
            <p className="mt-1 text-xs text-gray-500">Read-only: Updated via releases</p>
          </div>

          <div className="flex items-center justify-between py-2 border-t border-gray-200">
            <div>
              <label className="text-sm font-medium text-gray-700">Maintenance Mode</label>
              <p className="text-xs text-gray-500 mt-1">Disable access for non-admin users</p>
            </div>
            <button
              onClick={() => updateConfig({ maintenance_mode: !config.maintenance_mode })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.maintenance_mode ? 'bg-red-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.maintenance_mode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Feature Flags */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Feature Flags</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <label className="text-sm font-medium text-gray-700">Require MFA for All Users</label>
              <p className="text-xs text-gray-500 mt-1">Force all users to enable two-factor authentication</p>
            </div>
            <button
              onClick={() => updateConfig({ mfa_required: !config.mfa_required })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.mfa_required ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.mfa_required ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <label className="text-sm font-medium text-gray-700">Email Verification Required</label>
              <p className="text-xs text-gray-500 mt-1">Users must verify email before accessing app</p>
            </div>
            <button
              onClick={() => updateConfig({ email_verification_required: !config.email_verification_required })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.email_verification_required ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.email_verification_required ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <label className="text-sm font-medium text-gray-700">AI Receipt Extraction</label>
              <p className="text-xs text-gray-500 mt-1">Enable automatic data extraction from receipt images</p>
            </div>
            <button
              onClick={() => updateConfig({ ai_extraction_enabled: !config.ai_extraction_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.ai_extraction_enabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.ai_extraction_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <label className="text-sm font-medium text-gray-700">Multi-Page Receipts</label>
              <p className="text-xs text-gray-500 mt-1">Allow uploading and processing multi-page PDF receipts</p>
            </div>
            <button
              onClick={() => updateConfig({ multi_page_receipts_enabled: !config.multi_page_receipts_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config.multi_page_receipts_enabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config.multi_page_receipts_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Implementation Status */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-green-900 mb-2">✅ Fully Functional</h3>
        <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
          <li>System configuration persisted in <code className="bg-green-100 px-1 rounded">system_config</code> table</li>
          <li>RLS policies enforce system admin access only</li>
          <li>Complete audit trail for all configuration changes</li>
          <li>Real-time updates via <code className="bg-green-100 px-1 rounded">get_system_config()</code> and <code className="bg-green-100 px-1 rounded">update_system_config()</code> functions</li>
          <li>Feature flags enable/disable features without deployment</li>
        </ul>
      </div>
    </div>
  );
}
