import { useState, useEffect } from 'react';
import { User, Building2, Shield, Bell, Tag, Palette, Trash2 } from 'lucide-react';
import { BusinessCollectionManagement } from '../components/settings/BusinessCollectionManagement';
import { CategoryManagement } from '../components/settings/CategoryManagement';
import { ProfileManagement } from '../components/settings/ProfileManagement';
import { ThemeSettings } from '../components/settings/ThemeSettings';
import { MFAManagement } from '../components/settings/MFAManagement';
import { DeletedReceiptsManagement } from '../components/admin/DeletedReceiptsManagement';
import { usePageTracking } from '../hooks/usePageTracking';
import { captureException, captureMessage } from '../lib/sentry';
import { useAuth } from '../contexts/AuthContext';
import { SectionLayout, SectionGroup } from '../components/layout/SectionLayout';

type SettingsTab = 'profile' | '2fa' | 'businesses' | 'categories' | 'theme' | 'notifications' | 'deleted-receipts';

const SETTINGS_SECTIONS: SectionGroup[] = [
  {
    label: 'Account',
    items: [
      { id: 'profile', label: 'Profile', icon: <User size={16} /> },
      { id: '2fa', label: 'Security', icon: <Shield size={16} /> },
    ],
  },
  {
    label: 'Organization',
    items: [
      { id: 'businesses', label: 'Businesses & Collections', icon: <Building2 size={16} /> },
      { id: 'categories', label: 'Categories', icon: <Tag size={16} /> },
    ],
  },
  {
    label: 'Preferences',
    items: [
      { id: 'theme', label: 'Appearance', icon: <Palette size={16} /> },
      { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    ],
  },
  {
    label: 'Data',
    items: [
      { id: 'deleted-receipts', label: 'Deleted Receipts', icon: <Trash2 size={16} /> },
    ],
  },
];

export function SettingsPage() {
  usePageTracking('Settings', { section: 'settings' });
  const { user, selectedBusiness } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const businessId = selectedBusiness?.id;

  useEffect(() => {
    const handleTabChange = (event: CustomEvent) => {
      const tab = event.detail.tab;
      if (tab === 'business') {
        setActiveTab('businesses');
      } else {
        setActiveTab(tab);
      }
    };

    window.addEventListener('settings-tab-change', handleTabChange as EventListener);
    return () => {
      window.removeEventListener('settings-tab-change', handleTabChange as EventListener);
    };
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileManagement />;
      case '2fa':
        return <MFAManagement />;
      case 'businesses':
        return <BusinessCollectionManagement />;
      case 'categories':
        return <CategoryManagement businessId={businessId} />;
      case 'theme':
        return <ThemeSettings />;
      case 'notifications':
        return <NotificationsContent />;
      case 'deleted-receipts':
        return <DeletedReceiptsManagement scope="owner" />;
      default:
        return <ProfileManagement />;
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto">
      <SectionLayout
        groups={SETTINGS_SECTIONS}
        activeSection={activeTab}
        onSectionChange={(id) => setActiveTab(id as SettingsTab)}
        accentColor="blue"
      >
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-6">
          {renderContent()}
        </div>
      </SectionLayout>
    </div>
  );
}

function NotificationsContent() {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Notifications</h3>
      <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
        Configure email and in-app notification preferences
      </p>

      <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
        <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
          Test Sentry Error Tracking
        </h4>
        <p className="text-xs text-yellow-700 dark:text-yellow-400 mb-3">
          Click these buttons to test if Sentry is receiving errors. Check your Sentry dashboard after clicking.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              captureMessage('Test message from Settings page', 'info', {
                test: true,
                timestamp: new Date().toISOString(),
              });
              alert('Test message sent! Check your Sentry dashboard in ~30 seconds.');
            }}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Send Test Message
          </button>
          <button
            onClick={() => {
              try {
                throw new Error('Test error from Settings page - this is intentional!');
              } catch (error) {
                captureException(error as Error, {
                  test: true,
                  location: 'SettingsPage',
                  timestamp: new Date().toISOString(),
                });
                alert('Test error sent! Check your Sentry dashboard in ~30 seconds.');
              }
            }}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition"
          >
            Send Test Error
          </button>
        </div>
        <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-2">
          Remove these buttons once you've verified Sentry is working.
        </p>
      </div>
      <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Notification preferences will be implemented in the next phase.
        </p>
      </div>
    </div>
  );
}
