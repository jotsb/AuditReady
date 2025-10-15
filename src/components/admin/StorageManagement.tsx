import { useState, useEffect } from 'react';
import { HardDrive, TrendingUp, AlertTriangle, RefreshCw, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { calculateBusinessStorage, checkStorageLimit, type BusinessStorageInfo } from '../../lib/businessAdminService';
import { useLogger } from '../../hooks/useLogger';

interface BusinessStorage {
  id: string;
  name: string;
  storage_used_bytes: number;
  storage_limit_bytes: number;
  storage_info?: BusinessStorageInfo;
  receipt_count: number;
  last_storage_check?: string;
}

export function StorageManagement() {
  const logger = useLogger();
  const [businesses, setBusinesses] = useState<BusinessStorage[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'usage' | 'limit' | 'percent'>('percent');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedBusiness, setExpandedBusiness] = useState<string | null>(null);

  useEffect(() => {
    loadStorageData();
  }, []);

  const loadStorageData = async () => {
    try {
      setLoading(true);

      const { data: businessData, error } = await supabase
        .from('businesses')
        .select('id, name, storage_used_bytes, storage_limit_bytes, last_storage_check')
        .order('storage_used_bytes', { ascending: false });

      if (error) throw error;

      const enrichedBusinesses = await Promise.all(
        (businessData || []).map(async (business) => {
          const [receiptCount, storageInfo] = await Promise.all([
            supabase
              .from('collections')
              .select('id')
              .eq('business_id', business.id)
              .then(async (collectionsRes) => {
                if (!collectionsRes.data || collectionsRes.data.length === 0) return 0;
                const collectionIds = collectionsRes.data.map(c => c.id);
                const receiptsRes = await supabase
                  .from('receipts')
                  .select('id', { count: 'exact', head: true })
                  .in('collection_id', collectionIds);
                return receiptsRes.count || 0;
              }),
            checkStorageLimit(business.id).catch(() => null),
          ]);

          return {
            ...business,
            receipt_count: receiptCount,
            storage_info: storageInfo,
          };
        })
      );

      setBusinesses(enrichedBusinesses);
      logger.info('Storage data loaded', { businessCount: enrichedBusinesses.length });
    } catch (error) {
      logger.error('Failed to load storage data', error as Error);
    } finally {
      setLoading(false);
    }
  };


  const handleRecalculate = async (businessId: string) => {
    try {
      setCalculating(businessId);
      logger.info('Recalculating storage for business', { businessId }, 'USER_ACTION');

      await calculateBusinessStorage(businessId);
      await loadStorageData();

      logger.info('Storage recalculated successfully', { businessId });
    } catch (error) {
      logger.error('Failed to recalculate storage', error as Error, { businessId });
      alert('Failed to recalculate storage');
    } finally {
      setCalculating(null);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const filteredBusinesses = businesses.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedBusinesses = [...filteredBusinesses].sort((a, b) => {
    let aVal, bVal;
    if (sortBy === 'usage') {
      aVal = a.storage_used_bytes;
      bVal = b.storage_used_bytes;
    } else if (sortBy === 'limit') {
      aVal = a.storage_limit_bytes;
      bVal = b.storage_limit_bytes;
    } else {
      aVal = a.storage_info?.usage_percent || 0;
      bVal = b.storage_info?.usage_percent || 0;
    }
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const totalUsed = businesses.reduce((sum, b) => sum + (b.storage_used_bytes || 0), 0);
  const totalLimit = businesses.reduce((sum, b) => sum + (b.storage_limit_bytes || 0), 0);
  const overageBusinesses = businesses.filter(b => b.storage_info?.is_critical).length;
  const warningBusinesses = businesses.filter(b => b.storage_info?.is_warning && !b.storage_info?.is_critical).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600 dark:text-gray-400">Loading storage data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Platform Storage Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <HardDrive className="text-blue-600" size={20} />
            </div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-gray-400">Total Storage Used</h3>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatBytes(totalUsed)}</p>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            {((totalUsed / totalLimit) * 100).toFixed(1)}% of {formatBytes(totalLimit)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-green-600" size={20} />
            </div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-gray-400">Average Per Business</h3>
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">
            {formatBytes(totalUsed / businesses.length)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="text-yellow-600" size={20} />
            </div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-gray-400">Warnings</h3>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{warningBusinesses}</p>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">80-95% used</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="text-red-600" size={20} />
            </div>
            <h3 className="text-sm font-medium text-slate-600 dark:text-gray-400">Critical</h3>
          </div>
          <p className="text-2xl font-bold text-red-600">{overageBusinesses}</p>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Over 95% used</p>
        </div>
      </div>

      {/* Business Storage Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">Business Storage Usage</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search businesses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-slate-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-gray-700 border-b border-slate-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Business
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-600"
                  onClick={() => {
                    if (sortBy === 'usage') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    setSortBy('usage');
                  }}
                >
                  <div className="flex items-center gap-1">
                    Storage Used
                    {sortBy === 'usage' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-600"
                  onClick={() => {
                    if (sortBy === 'limit') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    setSortBy('limit');
                  }}
                >
                  <div className="flex items-center gap-1">
                    Limit
                    {sortBy === 'limit' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-gray-600"
                  onClick={() => {
                    if (sortBy === 'percent') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    setSortBy('percent');
                  }}
                >
                  <div className="flex items-center gap-1">
                    Usage %
                    {sortBy === 'percent' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Receipts
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Check
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
              {sortedBusinesses.map((business) => (
                <tr key={business.id} className="hover:bg-slate-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">{business.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-600 dark:text-gray-400">{formatBytes(business.storage_used_bytes)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-600 dark:text-gray-400">{formatBytes(business.storage_limit_bytes)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="w-32 bg-slate-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            business.storage_info?.is_critical
                              ? 'bg-red-600'
                              : business.storage_info?.is_warning
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(business.storage_info?.usage_percent || 0, 100)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-medium ${
                        business.storage_info?.is_critical
                          ? 'text-red-600'
                          : business.storage_info?.is_warning
                          ? 'text-yellow-600'
                          : 'text-slate-600 dark:text-gray-400'
                      }`}>
                        {business.storage_info?.usage_percent.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-600 dark:text-gray-400">{business.receipt_count}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-xs text-slate-500 dark:text-gray-400">{formatDate(business.last_storage_check)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleRecalculate(business.id)}
                      disabled={calculating === business.id}
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium disabled:opacity-50 flex items-center gap-1"
                    >
                      <RefreshCw size={14} className={calculating === business.id ? 'animate-spin' : ''} />
                      Recalculate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
