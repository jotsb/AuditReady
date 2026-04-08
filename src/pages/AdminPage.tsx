import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Building2, Users, AlertCircle, Activity, Database,
  BarChart3, UserCog, HardDrive, Recycle, Settings,
  Copy, Heart, Trash2, LayoutDashboard,
} from 'lucide-react';
import { usePageTracking } from '../hooks/usePageTracking';
import { SectionLayout, SectionGroup } from '../components/layout/SectionLayout';
import { AdminOverview } from '../components/admin/AdminOverview';
import { AdminBusinessesTab } from '../components/admin/AdminBusinessesTab';
import { AdminAnalyticsTab } from '../components/admin/AdminAnalyticsTab';
import { AdminBulkOperationsTab } from '../components/admin/AdminBulkOperationsTab';
import { UserManagement } from '../components/admin/UserManagement';
import { AuditLogsView } from '../components/audit/AuditLogsView';
import { DeletedReceiptsManagement } from '../components/admin/DeletedReceiptsManagement';
import { StorageManagement } from '../components/admin/StorageManagement';
import { DataCleanupOperations } from '../components/admin/DataCleanupOperations';
import { LogLevelConfiguration } from '../components/admin/LogLevelConfiguration';
import { SystemConfiguration } from '../components/admin/SystemConfiguration';
import SystemHealthMonitor from '../components/admin/SystemHealthMonitor';
import DuplicateDetectionManager from '../components/admin/DuplicateDetectionManager';
import EnhancedErrorLogViewer from '../components/admin/EnhancedErrorLogViewer';
import DatabaseManagementHub from '../components/admin/database/DatabaseManagementHub';

type AdminSection =
  | 'overview' | 'businesses' | 'users' | 'storage'
  | 'logs' | 'analytics' | 'bulk-ops' | 'deleted-receipts'
  | 'cleanup' | 'log-config' | 'system-config' | 'health'
  | 'database' | 'duplicates' | 'errors';

const ADMIN_SECTIONS: SectionGroup[] = [
  {
    label: 'Overview',
    items: [
      { id: 'overview', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
      { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
    ],
  },
  {
    label: 'Management',
    items: [
      { id: 'businesses', label: 'Businesses', icon: <Building2 size={16} /> },
      { id: 'users', label: 'Users', icon: <UserCog size={16} /> },
      { id: 'storage', label: 'Storage', icon: <HardDrive size={16} /> },
    ],
  },
  {
    label: 'Data',
    items: [
      { id: 'deleted-receipts', label: 'Deleted Receipts', icon: <Trash2 size={16} /> },
      { id: 'cleanup', label: 'Data Cleanup', icon: <Recycle size={16} /> },
      { id: 'duplicates', label: 'Duplicates', icon: <Copy size={16} /> },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { id: 'logs', label: 'Audit Logs', icon: <Activity size={16} /> },
      { id: 'errors', label: 'Error Logs', icon: <AlertCircle size={16} /> },
      { id: 'bulk-ops', label: 'Bulk Operations', icon: <Users size={16} /> },
      { id: 'health', label: 'System Health', icon: <Heart size={16} /> },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { id: 'log-config', label: 'Log Settings', icon: <Settings size={16} /> },
      { id: 'system-config', label: 'System Config', icon: <Database size={16} /> },
      { id: 'database', label: 'Database', icon: <Database size={16} /> },
    ],
  },
];

export function AdminPage() {
  const { isSystemAdmin } = useAuth();
  usePageTracking('Admin', { section: 'admin' });
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');

  if (!isSystemAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full text-center border border-slate-200 dark:border-gray-700">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Access Denied</h2>
          <p className="text-slate-600 dark:text-gray-400">You do not have permission to access this page.</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <AdminOverview />;
      case 'businesses':
        return <AdminBusinessesTab />;
      case 'users':
        return <UserManagement />;
      case 'storage':
        return <StorageManagement />;
      case 'logs':
        return <AuditLogsView scope="system" showTitle={false} showBorder={false} />;
      case 'analytics':
        return <AdminAnalyticsTab />;
      case 'bulk-ops':
        return <AdminBulkOperationsTab />;
      case 'deleted-receipts':
        return <DeletedReceiptsManagement />;
      case 'cleanup':
        return <DataCleanupOperations />;
      case 'log-config':
        return <LogLevelConfiguration />;
      case 'system-config':
        return <SystemConfiguration />;
      case 'health':
        return <SystemHealthMonitor />;
      case 'database':
        return <DatabaseManagementHub />;
      case 'duplicates':
        return <DuplicateDetectionManager />;
      case 'errors':
        return <EnhancedErrorLogViewer />;
      default:
        return <AdminOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <div className="max-w-[1440px] mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <SectionLayout
          groups={ADMIN_SECTIONS}
          activeSection={activeSection}
          onSectionChange={(id) => setActiveSection(id as AdminSection)}
          accentColor="red"
        >
          {renderContent()}
        </SectionLayout>
      </div>
    </div>
  );
}
