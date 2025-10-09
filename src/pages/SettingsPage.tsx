import { useState, useEffect } from 'react';
import { User, Building2, Shield, Bell, Tag, Palette } from 'lucide-react';
import { BusinessCollectionManagement } from '../components/settings/BusinessCollectionManagement';
import { CategoryManagement } from '../components/settings/CategoryManagement';
import { ProfileManagement } from '../components/settings/ProfileManagement';
import { ThemeSettings } from '../components/settings/ThemeSettings';
import { MFAManagement } from '../components/settings/MFAManagement';
import { usePageTracking } from '../hooks/usePageTracking';
import { actionTracker } from '../lib/actionTracker';

type SettingsTab = 'profile' | '2fa' | 'business' | 'businesses' | 'categories' | 'theme' | 'notifications';

export function SettingsPage() {
  usePageTracking('Settings', { section: 'settings' });
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

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

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700">
        <div className="border-b border-slate-200 dark:border-gray-700">
          <nav className="flex -mb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                activeTab === 'profile'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 hover:border-slate-300 dark:border-gray-600 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <User size={18} />
                Profile
              </div>
            </button>
            <button
              onClick={() => setActiveTab('2fa')}
              className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                activeTab === '2fa'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 hover:border-slate-300 dark:border-gray-600 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield size={18} />
                Security
              </div>
            </button>
            <button
              onClick={() => setActiveTab('businesses')}
              className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                activeTab === 'businesses'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 hover:border-slate-300 dark:border-gray-600 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 size={18} />
                Businesses & Collections
              </div>
            </button>
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                activeTab === 'categories'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 hover:border-slate-300 dark:border-gray-600 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <Tag size={18} />
                Categories
              </div>
            </button>
            <button
              onClick={() => setActiveTab('theme')}
              className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                activeTab === 'theme'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 hover:border-slate-300 dark:border-gray-600 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <Palette size={18} />
                Appearance
              </div>
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                activeTab === 'notifications'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 hover:border-slate-300 dark:border-gray-600 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <Bell size={18} />
                Notifications
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && <ProfileManagement />}

          {activeTab === '2fa' && <MFAManagement />}

          {activeTab === 'businesses' && <BusinessCollectionManagement />}

          {activeTab === 'categories' && <CategoryManagement />}

          {activeTab === 'theme' && <ThemeSettings />}

          {activeTab === 'notifications' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Notifications</h3>
              <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
                Configure email and in-app notification preferences
              </p>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  Notification preferences will be implemented in the next phase.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
