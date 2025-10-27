import { useState, useEffect } from 'react';
import { Database, Play, History, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { executeAdminQuery, getQueryHistory, type QueryResult } from '../../lib/adminService';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../shared/LoadingSpinner';
import { ErrorAlert } from '../shared/ErrorAlert';

export default function DatabaseQueryBrowser() {
  const { user } = useAuth();
  const [queryText, setQueryText] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    try {
      const data = await getQueryHistory(user.id, 20);
      setHistory(data);
    } catch (err: any) {
      console.error('Failed to load query history:', err);
    }
  };

  const handleExecute = async () => {
    if (!user || !queryText.trim()) return;

    setExecuting(true);
    setError(null);
    setResult(null);

    try {
      const data = await executeAdminQuery(queryText, user.id);
      setResult(data);
      await loadHistory();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExecuting(false);
    }
  };

  const handleLoadFromHistory = (query: any) => {
    setQueryText(query.query_text);
    setShowHistory(false);
  };

  const exampleQueries = [
    'SELECT COUNT(*) as total_users FROM profiles WHERE deleted_at IS NULL',
    'SELECT COUNT(*) as total_receipts FROM receipts WHERE deleted_at IS NULL',
    'SELECT business_id, COUNT(*) as receipt_count FROM receipts GROUP BY business_id ORDER BY receipt_count DESC LIMIT 10',
    'SELECT level, COUNT(*) as count FROM system_logs WHERE created_at > now() - interval \'24 hours\' GROUP BY level',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Database className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Database Query Browser</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Execute read-only SQL queries (SELECT, EXPLAIN, SHOW only)
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <History className="w-4 h-4" />
          {showHistory ? 'Hide' : 'Show'} History
        </button>
      </div>

      {/* Security Notice */}
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Security Restrictions</p>
            <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
              <li>Only SELECT, EXPLAIN, and SHOW statements are allowed</li>
              <li>No data modification (INSERT, UPDATE, DELETE) permitted</li>
              <li>No schema changes (CREATE, ALTER, DROP) permitted</li>
              <li>Results are automatically limited to 100 rows</li>
              <li>All queries are logged for audit purposes</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Query Input */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          SQL Query
        </label>
        <textarea
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="SELECT * FROM profiles LIMIT 10"
          rows={6}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleExecute}
            disabled={executing || !queryText.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executing ? (
              <>
                <LoadingSpinner size="sm" />
                Executing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Execute Query
              </>
            )}
          </button>
          <button
            onClick={() => {
              setQueryText('');
              setResult(null);
              setError(null);
            }}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Example Queries */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Example Queries</h3>
        <div className="space-y-2">
          {exampleQueries.map((query, index) => (
            <button
              key={index}
              onClick={() => setQueryText(query)}
              className="w-full text-left px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-600 font-mono"
            >
              {query}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && <ErrorAlert message={error} />}

      {/* Results */}
      {result && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Query Results</h3>
            <div className="flex items-center gap-4 text-sm">
              {result.success ? (
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  Success
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  Error
                </div>
              )}
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Clock className="w-4 h-4" />
                {result.execution_time_ms}ms
              </div>
            </div>
          </div>

          {result.success && result.rows ? (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {result.row_count} rows returned
              </p>
              <div className="overflow-x-auto">
                {result.rows.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        {Object.keys(result.rows[0]).map((key) => (
                          <th
                            key={key}
                            className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {result.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          {Object.values(row).map((value: any, colIndex) => (
                            <td key={colIndex} className="px-4 py-2 text-gray-900 dark:text-gray-100 font-mono text-xs">
                              {value === null ? (
                                <span className="text-gray-400 italic">NULL</span>
                              ) : typeof value === 'object' ? (
                                <span className="text-blue-600 dark:text-blue-400">
                                  {JSON.stringify(value)}
                                </span>
                              ) : (
                                String(value)
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-8">No rows returned</p>
                )}
              </div>
            </>
          ) : result.error ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-red-700 dark:text-red-300">
              {result.error}
            </div>
          ) : null}
        </div>
      )}

      {/* Query History */}
      {showHistory && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Queries</h3>
          {history.length > 0 ? (
            <div className="space-y-2">
              {history.map((query) => (
                <div
                  key={query.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleLoadFromHistory(query)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {query.success ? (
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(query.executed_at).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {query.execution_time_ms}ms
                    </span>
                  </div>
                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300 truncate">
                    {query.query_text}
                  </p>
                  {query.error_message && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{query.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No query history</p>
          )}
        </div>
      )}
    </div>
  );
}
