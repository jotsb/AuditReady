import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings, RefreshCw, Check, X, Save, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { useLogger } from '../../hooks/useLogger';

interface LogConfig {
  id: string;
  category: string;
  min_level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  enabled: boolean;
  description: string;
  updated_at: string;
}

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'] as const;

const LEVEL_COLORS = {
  DEBUG: 'text-gray-500',
  INFO: 'text-blue-600',
  WARN: 'text-yellow-600',
  ERROR: 'text-orange-600',
  CRITICAL: 'text-red-600',
};

const LEVEL_BG_COLORS = {
  DEBUG: 'bg-gray-100 hover:bg-gray-200',
  INFO: 'bg-blue-100 hover:bg-blue-200',
  WARN: 'bg-yellow-100 hover:bg-yellow-200',
  ERROR: 'bg-orange-100 hover:bg-orange-200',
  CRITICAL: 'bg-red-100 hover:bg-red-200',
};

export function LogLevelConfiguration() {
  const logger = useLogger();
  const [configs, setConfigs] = useState<LogConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [changes, setChanges] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      setError('');

      const { data, error: fetchError } = await supabase
        .from('log_level_config')
        .select('*')
        .order('category');

      if (fetchError) throw fetchError;

      setConfigs(data || []);
      setChanges(new Set());

      logger.info('Loaded log level configurations', {
        page: 'AdminPage',
        section: 'LogLevelConfiguration',
        configCount: data?.length || 0,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load log configurations';
      setError(message);
      logger.error('Failed to load log configurations', err as Error, {
        page: 'AdminPage',
        section: 'LogLevelConfiguration',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (configId: string, updates: Partial<LogConfig>) => {
    try {
      setSaving(configId);
      setError('');
      setSuccess('');

      const { error: updateError } = await supabase
        .from('log_level_config')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', configId);

      if (updateError) throw updateError;

      setConfigs(prev =>
        prev.map(c => (c.id === configId ? { ...c, ...updates } : c))
      );

      const updatedChanges = new Set(changes);
      updatedChanges.delete(configId);
      setChanges(updatedChanges);

      setSuccess('Configuration updated successfully');
      setTimeout(() => setSuccess(''), 3000);

      const config = configs.find(c => c.id === configId);
      logger.info('Updated log level configuration', {
        page: 'AdminPage',
        section: 'LogLevelConfiguration',
        category: config?.category,
        updates,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update configuration';
      setError(message);
      logger.error('Failed to update log configuration', err as Error, {
        page: 'AdminPage',
        section: 'LogLevelConfiguration',
        configId,
      });
    } finally {
      setSaving(null);
    }
  };

  const handleLevelChange = (configId: string, newLevel: string) => {
    setConfigs(prev =>
      prev.map(c => (c.id === configId ? { ...c, min_level: newLevel as LogConfig['min_level'] } : c))
    );
    setChanges(prev => new Set(prev).add(configId));
  };

  const handleEnabledToggle = (configId: string, enabled: boolean) => {
    updateConfig(configId, { enabled });
  };

  const saveChanges = async (configId: string) => {
    const config = configs.find(c => c.id === configId);
    if (config) {
      await updateConfig(configId, { min_level: config.min_level });
    }
  };

  const discardChanges = (configId: string) => {
    loadConfigs();
  };

  const saveAllChanges = async () => {
    const changedConfigs = configs.filter(c => changes.has(c.id));

    for (const config of changedConfigs) {
      await updateConfig(config.id, { min_level: config.min_level });
    }
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
          <h2 className="text-2xl font-bold text-gray-900">Log Level Configuration</h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure minimum log levels for each category. Changes take effect immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {changes.size > 0 && (
            <button
              onClick={saveAllChanges}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              Save All Changes ({changes.size})
            </button>
          )}
          <button
            onClick={loadConfigs}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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

      {/* Log Level Legend */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Log Level Guide
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <span className="font-semibold text-gray-600">DEBUG:</span>
            <p className="text-gray-500">Detailed diagnostic info</p>
          </div>
          <div>
            <span className="font-semibold text-blue-600">INFO:</span>
            <p className="text-gray-500">General informational</p>
          </div>
          <div>
            <span className="font-semibold text-yellow-600">WARN:</span>
            <p className="text-gray-500">Warning messages</p>
          </div>
          <div>
            <span className="font-semibold text-orange-600">ERROR:</span>
            <p className="text-gray-500">Error conditions</p>
          </div>
          <div>
            <span className="font-semibold text-red-600">CRITICAL:</span>
            <p className="text-gray-500">Critical failures</p>
          </div>
        </div>
      </div>

      {/* Configuration Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Min Level
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {configs.map(config => {
              const hasChanges = changes.has(config.id);
              const isSaving = saving === config.id;

              return (
                <tr key={config.id} className={hasChanges ? 'bg-yellow-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Settings className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-gray-900">
                        {config.category}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-600">{config.description}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {LOG_LEVELS.map(level => (
                        <button
                          key={level}
                          onClick={() => handleLevelChange(config.id, level)}
                          disabled={isSaving}
                          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                            config.min_level === level
                              ? `${LEVEL_BG_COLORS[level]} ${LEVEL_COLORS[level]} ring-2 ring-offset-1 ring-gray-400`
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleEnabledToggle(config.id, !config.enabled)}
                      disabled={isSaving}
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        config.enabled
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      } ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {config.enabled ? (
                        <>
                          <Check className="w-3 h-3 mr-1" />
                          Enabled
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3 mr-1" />
                          Disabled
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {hasChanges ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveChanges(config.id)}
                          disabled={isSaving}
                          className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => discardChanges(config.id)}
                          disabled={isSaving}
                          className="text-gray-600 hover:text-gray-800 disabled:opacity-50"
                        >
                          Discard
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">No changes</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">How it works</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Logs below the minimum level for a category will not be recorded</li>
          <li>Disabled categories will not generate any logs</li>
          <li>Changes take effect immediately for new log entries</li>
          <li>Existing logs are not affected by configuration changes</li>
        </ul>
      </div>
    </div>
  );
}
