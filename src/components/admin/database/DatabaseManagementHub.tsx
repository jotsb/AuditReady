import { useState, lazy, Suspense } from 'react';
import { Table2, GitBranch, BarChart3, Archive, Terminal } from 'lucide-react';
import { LoadingSpinner } from '../../shared/LoadingSpinner';

const TableExplorer = lazy(() => import('./TableExplorer'));
const SchemaViewer = lazy(() => import('./SchemaViewer'));
const DatabaseStats = lazy(() => import('./DatabaseStats'));
const BackupManager = lazy(() => import('./BackupManager'));
const DatabaseQueryBrowser = lazy(() => import('../DatabaseQueryBrowser'));

type Tab = 'tables' | 'schema' | 'stats' | 'query' | 'backups';

const tabs: { id: Tab; label: string; icon: typeof Table2 }[] = [
  { id: 'tables', label: 'Tables', icon: Table2 },
  { id: 'schema', label: 'Schema', icon: GitBranch },
  { id: 'stats', label: 'Statistics', icon: BarChart3 },
  { id: 'query', label: 'Query', icon: Terminal },
  { id: 'backups', label: 'Backups', icon: Archive },
];

export default function DatabaseManagementHub() {
  const [activeTab, setActiveTab] = useState<Tab>('tables');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition flex-1 justify-center ${
              activeTab === id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <Suspense fallback={
        <div className="flex justify-center items-center p-12">
          <LoadingSpinner size="lg" />
        </div>
      }>
        {activeTab === 'tables' && <TableExplorer />}
        {activeTab === 'schema' && <SchemaViewer />}
        {activeTab === 'stats' && <DatabaseStats />}
        {activeTab === 'query' && <DatabaseQueryBrowser />}
        {activeTab === 'backups' && <BackupManager />}
      </Suspense>
    </div>
  );
}
