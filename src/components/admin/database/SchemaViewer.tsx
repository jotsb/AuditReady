import { useState, useEffect } from 'react';
import { GitBranch, Shield, Search, ChevronDown, ChevronRight, ArrowRight, Lock, Unlock, Eye, CreditCard as Edit, PlusCircle, Trash2 } from 'lucide-react';
import {
  getForeignKeys, getRLSPolicies, getTableInfo,
  type ForeignKey, type RLSPolicy, type TableInfo
} from '../../../lib/dbManagementService';
import { LoadingSpinner } from '../../shared/LoadingSpinner';

export default function SchemaViewer() {
  const [activeTab, setActiveTab] = useState<'relationships' | 'policies'>('relationships');
  const [foreignKeys, setForeignKeys] = useState<ForeignKey[]>([]);
  const [policies, setPolicies] = useState<RLSPolicy[]>([]);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [fks, pols, tbls] = await Promise.all([
        getForeignKeys(),
        getRLSPolicies(),
        getTableInfo(),
      ]);
      setForeignKeys(fks);
      setPolicies(pols);
      setTables(tbls);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center p-12"><LoadingSpinner size="lg" /></div>;
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          <button
            onClick={() => setActiveTab('relationships')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${
              activeTab === 'relationships'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            Relationships ({foreignKeys.length})
          </button>
          <button
            onClick={() => setActiveTab('policies')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition ${
              activeTab === 'policies'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            <Shield className="w-4 h-4" />
            RLS Policies ({policies.length})
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter..."
            className="pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {activeTab === 'relationships' ? (
        <RelationshipsView foreignKeys={foreignKeys} searchTerm={searchTerm} />
      ) : (
        <PoliciesView policies={policies} tables={tables} searchTerm={searchTerm} />
      )}
    </div>
  );
}

function RelationshipsView({ foreignKeys, searchTerm }: { foreignKeys: ForeignKey[]; searchTerm: string }) {
  const grouped = foreignKeys
    .filter(fk =>
      fk.source_table.includes(searchTerm.toLowerCase()) ||
      fk.target_table.includes(searchTerm.toLowerCase()) ||
      fk.constraint_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .reduce((acc, fk) => {
      if (!acc[fk.source_table]) acc[fk.source_table] = [];
      acc[fk.source_table].push(fk);
      return acc;
    }, {} as Record<string, ForeignKey[]>);

  const sortedTables = Object.keys(grouped).sort();

  if (sortedTables.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <GitBranch className="w-8 h-8 mx-auto mb-2" />
        <p>No matching relationships found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedTables.map((table) => (
        <RelationshipGroup key={table} tableName={table} foreignKeys={grouped[table]} />
      ))}
    </div>
  );
}

function RelationshipGroup({ tableName, foreignKeys }: { tableName: string; foreignKeys: ForeignKey[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="font-medium text-sm text-gray-900 dark:text-white font-mono">{tableName}</span>
          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full">
            {foreignKeys.length} FK{foreignKeys.length !== 1 ? 's' : ''}
          </span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700/50">
          {foreignKeys.map((fk) => (
            <div key={fk.constraint_name} className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/20 text-sm">
              <span className="font-mono text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                {fk.source_column}
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
              <span className="font-mono text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                {fk.target_table}.{fk.target_column}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto truncate max-w-[200px]" title={fk.constraint_name}>
                {fk.constraint_name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PoliciesView({ policies, tables, searchTerm }: { policies: RLSPolicy[]; tables: TableInfo[]; searchTerm: string }) {
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  const tableNames = [...new Set(tables.map(t => t.table_name))].sort();
  const filteredTables = tableNames.filter(t =>
    t.includes(searchTerm.toLowerCase()) ||
    policies.some(p => p.table_name === t && p.policy_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getCmdIcon = (cmd: string) => {
    switch (cmd) {
      case 'SELECT': return <Eye className="w-3.5 h-3.5 text-green-500" />;
      case 'INSERT': return <PlusCircle className="w-3.5 h-3.5 text-blue-500" />;
      case 'UPDATE': return <Edit className="w-3.5 h-3.5 text-amber-500" />;
      case 'DELETE': return <Trash2 className="w-3.5 h-3.5 text-red-500" />;
      default: return <Shield className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  const getCmdColor = (cmd: string) => {
    switch (cmd) {
      case 'SELECT': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
      case 'INSERT': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300';
      case 'UPDATE': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
      case 'DELETE': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="space-y-2">
      {filteredTables.map((tableName) => {
        const tablePolicies = policies.filter(p => p.table_name === tableName);
        const tableInfo = tables.find(t => t.table_name === tableName);
        const isExpanded = expandedTable === tableName;

        return (
          <div key={tableName} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setExpandedTable(isExpanded ? null : tableName)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                <span className="font-medium text-sm text-gray-900 dark:text-white font-mono">{tableName}</span>
                {tableInfo?.rls_enabled ? (
                  <Lock className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-red-500" />
                )}
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  tablePolicies.length > 0
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                }`}>
                  {tablePolicies.length} {tablePolicies.length === 1 ? 'policy' : 'policies'}
                </span>
              </div>
            </button>
            {isExpanded && (
              <div className="border-t border-gray-100 dark:border-gray-700/50">
                {tablePolicies.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    {tableInfo?.rls_enabled
                      ? 'RLS enabled but no policies defined - table is locked down'
                      : 'No RLS or policies - table is open to all authenticated users'
                    }
                  </div>
                ) : (
                  tablePolicies.map((policy) => (
                    <div key={policy.policy_name} className="px-4 py-3 border-b border-gray-50 dark:border-gray-700/30 last:border-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getCmdIcon(policy.cmd)}
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${getCmdColor(policy.cmd)}`}>
                          {policy.cmd}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {policy.policy_name}
                        </span>
                        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${
                          policy.permissive === 'PERMISSIVE'
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                            : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                        }`}>
                          {policy.permissive}
                        </span>
                      </div>
                      {policy.qual && (
                        <div className="mt-1">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">USING</span>
                          <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-2 rounded mt-0.5 font-mono overflow-x-auto whitespace-pre-wrap">
                            {policy.qual}
                          </pre>
                        </div>
                      )}
                      {policy.with_check && (
                        <div className="mt-1">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">WITH CHECK</span>
                          <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-2 rounded mt-0.5 font-mono overflow-x-auto whitespace-pre-wrap">
                            {policy.with_check}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
