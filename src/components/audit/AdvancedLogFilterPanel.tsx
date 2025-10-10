import { useState } from 'react';
import { X, Filter, Bookmark, Zap, Search } from 'lucide-react';
import { LogSavedFilterManager } from './LogSavedFilterManager';
import { MultiSelect } from '../shared/MultiSelect';

export interface LogFilters {
  searchTerm: string;
  actions: string[];
  resources: string[];
  statuses: string[];
  roles: string[];
  startDate: string;
  endDate: string;
  ipAddress: string;
  userEmail: string;
}

interface PresetFilter {
  name: string;
  icon: string;
  description: string;
  filters: Partial<LogFilters>;
}

interface AdvancedLogFilterPanelProps {
  filterType: 'audit' | 'system';
  filters: LogFilters;
  onChange: (filters: LogFilters) => void;
  onClear: () => void;
  onClose: () => void;
  actionOptions: string[];
  resourceOptions: string[];
  roleOptions: string[];
  presets: PresetFilter[];
}

export function AdvancedLogFilterPanel({
  filterType,
  filters,
  onChange,
  onClear,
  onClose,
  actionOptions,
  resourceOptions,
  roleOptions,
  presets
}: AdvancedLogFilterPanelProps) {
  const [activeTab, setActiveTab] = useState<'filters' | 'saved' | 'presets'>('filters');

  const handleChange = (field: keyof LogFilters, value: any) => {
    onChange({ ...filters, [field]: value });
  };

  const applyPreset = (preset: PresetFilter) => {
    onChange({ ...filters, ...preset.filters });
    setActiveTab('filters');
  };

  const hasActiveFilters =
    filters.searchTerm ||
    filters.actions.length > 0 ||
    filters.resources.length > 0 ||
    filters.statuses.length > 0 ||
    filters.roles.length > 0 ||
    filters.startDate ||
    filters.endDate ||
    filters.ipAddress ||
    filters.userEmail;

  const handleLoadSavedFilter = (loadedFilters: any) => {
    onChange(loadedFilters);
    setActiveTab('filters');
  };

  const statuses = ['success', 'failure', 'denied'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Filter size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
                Advanced Filters
              </h2>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Refine your {filterType === 'audit' ? 'audit' : 'system'} log search
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-gray-700 px-6">
          <button
            onClick={() => setActiveTab('filters')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'filters'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Filter size={16} />
              Filters
            </div>
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'presets'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap size={16} />
              Quick Filters
            </div>
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'saved'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Bookmark size={16} />
              Saved
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'filters' && (
            <div className="space-y-6">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                  <Search size={16} className="inline mr-1" />
                  Search
                </label>
                <input
                  type="text"
                  value={filters.searchTerm}
                  onChange={(e) => handleChange('searchTerm', e.target.value)}
                  placeholder="Search in logs..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-3">
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-gray-400 mb-1">From</label>
                    <input
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => handleChange('startDate', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 dark:text-gray-400 mb-1">To</label>
                    <input
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => handleChange('endDate', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Multi-Selects */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <MultiSelect
                  label="Actions"
                  options={actionOptions}
                  selected={filters.actions}
                  onChange={(selected) => handleChange('actions', selected)}
                  placeholder="All actions"
                />

                <MultiSelect
                  label="Resource Types"
                  options={resourceOptions}
                  selected={filters.resources}
                  onChange={(selected) => handleChange('resources', selected)}
                  placeholder="All resources"
                />

                <MultiSelect
                  label="Status"
                  options={statuses}
                  selected={filters.statuses}
                  onChange={(selected) => handleChange('statuses', selected)}
                  placeholder="All statuses"
                  formatLabel={(s) => s.charAt(0).toUpperCase() + s.slice(1)}
                />

                <MultiSelect
                  label="Roles"
                  options={roleOptions}
                  selected={filters.roles}
                  onChange={(selected) => handleChange('roles', selected)}
                  placeholder="All roles"
                />
              </div>

              {/* Advanced Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    IP Address
                  </label>
                  <input
                    type="text"
                    value={filters.ipAddress}
                    onChange={(e) => handleChange('ipAddress', e.target.value)}
                    placeholder="e.g., 192.168.1.1"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">
                    User Email
                  </label>
                  <input
                    type="text"
                    value={filters.userEmail}
                    onChange={(e) => handleChange('userEmail', e.target.value)}
                    placeholder="Filter by user email"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'presets' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
                Quick access to commonly used filter combinations
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {presets.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => applyPreset(preset)}
                    className="text-left p-4 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition">
                        <span className="text-xl">{preset.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                          {preset.name}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                          {preset.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'saved' && (
            <LogSavedFilterManager
              filterType={filterType}
              currentFilters={filters}
              onLoadFilter={handleLoadSavedFilter}
              onClose={onClose}
            />
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-50 dark:bg-gray-800 border-t border-slate-200 dark:border-gray-700 p-4 flex items-center justify-between">
          <div className="text-sm text-slate-600 dark:text-gray-400">
            {hasActiveFilters ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                Active filters applied
              </span>
            ) : (
              'No filters applied'
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                onClear();
                setActiveTab('filters');
              }}
              disabled={!hasActiveFilters}
              className="px-4 py-2 text-slate-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-slate-300 dark:border-gray-600 rounded-lg hover:bg-slate-50 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Clear All
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
