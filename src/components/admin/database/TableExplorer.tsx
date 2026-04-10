import { useState, useEffect } from 'react';
import {
  Table2, ChevronRight, ChevronDown, Search, Key, Hash, Type,
  ArrowUpDown, ArrowUp, ArrowDown, Layers, RefreshCw, Eye
} from 'lucide-react';
import {
  getTableInfo, getTableColumns, getTableIndexes, browseTableData,
  type TableInfo, type ColumnInfo, type IndexInfo, type TableDataResult
} from '../../../lib/dbManagementService';
import { LoadingSpinner } from '../../shared/LoadingSpinner';

export default function TableExplorer() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<'structure' | 'data' | 'indexes'>('structure');

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTableInfo();
      setTables(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTables = tables.filter(t =>
    t.table_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSize = tables.reduce((sum, t) => sum + t.size_bytes, 0);
  const totalRows = tables.reduce((sum, t) => sum + t.row_estimate, 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-[calc(100vh-320px)] min-h-[500px]">
      <div className="w-80 flex-shrink-0 flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter tables..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{tables.length} tables</span>
            <span>{formatBytes(totalSize)}</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredTables.map((table) => (
            <button
              key={table.table_name}
              onClick={() => setSelectedTable(table.table_name)}
              className={`w-full text-left px-3 py-2.5 border-b border-gray-100 dark:border-gray-700/50 transition hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                selectedTable === table.table_name
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Table2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {table.table_name}
                  </span>
                </div>
                {selectedTable === table.table_name ? (
                  <ChevronDown className="w-4 h-4 text-blue-500 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
                <span>{table.row_estimate.toLocaleString()} rows</span>
                <span>{table.size_pretty}</span>
                {table.rls_enabled && (
                  <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-[10px] font-medium">
                    RLS
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={loadTables}
            className="flex items-center gap-2 w-full justify-center px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {selectedTable ? (
          <TableDetail
            tableName={selectedTable}
            activeView={activeView}
            onChangeView={setActiveView}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
            <Table2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 font-medium">Select a table to explore</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {totalRows.toLocaleString()} total rows across {tables.length} tables
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TableDetail({
  tableName,
  activeView,
  onChangeView,
}: {
  tableName: string;
  activeView: 'structure' | 'data' | 'indexes';
  onChangeView: (view: 'structure' | 'data' | 'indexes') => void;
}) {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Table2 className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">{tableName}</h3>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
          {(['structure', 'data', 'indexes'] as const).map((view) => (
            <button
              key={view}
              onClick={() => onChangeView(view)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                activeView === view
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {view === 'structure' ? 'Structure' : view === 'data' ? 'Data' : 'Indexes'}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {activeView === 'structure' && <ColumnsView tableName={tableName} />}
        {activeView === 'data' && <DataView tableName={tableName} />}
        {activeView === 'indexes' && <IndexesView tableName={tableName} />}
      </div>
    </div>
  );
}

function ColumnsView({ tableName }: { tableName: string }) {
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTableColumns(tableName)
      .then(setColumns)
      .catch(() => setColumns([]))
      .finally(() => setLoading(false));
  }, [tableName]);

  if (loading) return <div className="flex justify-center p-8"><LoadingSpinner /></div>;

  return (
    <table className="w-full text-sm">
      <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
        <tr>
          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Column</th>
          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nullable</th>
          <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Default</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
        {columns.map((col) => (
          <tr key={col.column_name} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
            <td className="px-4 py-2.5 text-gray-400 text-xs">{col.ordinal_position}</td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-2">
                {col.is_primary_key ? (
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <Hash className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                )}
                <span className="font-medium text-gray-900 dark:text-white font-mono text-xs">
                  {col.column_name}
                </span>
                {col.is_primary_key && (
                  <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-[10px] font-medium">
                    PK
                  </span>
                )}
              </div>
            </td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-gray-400" />
                <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                  {col.udt_name}
                  {col.character_maximum_length ? `(${col.character_maximum_length})` : ''}
                </span>
              </div>
            </td>
            <td className="px-4 py-2.5">
              <span className={`text-xs ${
                col.is_nullable === 'YES'
                  ? 'text-gray-400 dark:text-gray-500'
                  : 'text-red-500 dark:text-red-400 font-medium'
              }`}>
                {col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'}
              </span>
            </td>
            <td className="px-4 py-2.5">
              {col.column_default ? (
                <span className="font-mono text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate block">
                  {col.column_default}
                </span>
              ) : (
                <span className="text-xs text-gray-300 dark:text-gray-600">--</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DataView({ tableName }: { tableName: string }) {
  const [data, setData] = useState<TableDataResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('ASC');
  const limit = 25;

  useEffect(() => {
    setPage(0);
    setSortCol(undefined);
    setSortDir('ASC');
  }, [tableName]);

  useEffect(() => {
    loadData();
  }, [tableName, page, sortCol, sortDir]);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await browseTableData(tableName, limit, page * limit, sortCol, sortDir);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortCol(col);
      setSortDir('ASC');
    }
    setPage(0);
  };

  if (loading && !data) return <div className="flex justify-center p-8"><LoadingSpinner /></div>;
  if (!data || data.rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-500 dark:text-gray-400">
        <Eye className="w-8 h-8 mb-2" />
        <p>No data in this table</p>
      </div>
    );
  }

  const columns = Object.keys(data.rows[0]);
  const totalPages = Math.ceil(data.total_count / limit);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 whitespace-nowrap"
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    {col}
                    {sortCol === col ? (
                      sortDir === 'ASC' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {data.rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2 text-gray-900 dark:text-gray-100 font-mono whitespace-nowrap max-w-[250px] truncate">
                    {formatCellValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {data.total_count.toLocaleString()} total rows
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {page + 1} / {totalPages || 1}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="px-2.5 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function IndexesView({ tableName }: { tableName: string }) {
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getTableIndexes(tableName)
      .then(setIndexes)
      .catch(() => setIndexes([]))
      .finally(() => setLoading(false));
  }, [tableName]);

  if (loading) return <div className="flex justify-center p-8"><LoadingSpinner /></div>;

  if (indexes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-500 dark:text-gray-400">
        <Layers className="w-8 h-8 mb-2" />
        <p>No indexes on this table</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
      {indexes.map((idx) => (
        <div key={idx.index_name} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-sm text-gray-900 dark:text-white font-mono">
                {idx.index_name}
              </span>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{idx.size_pretty}</span>
          </div>
          <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-2 rounded font-mono overflow-x-auto">
            {idx.index_def}
          </pre>
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
