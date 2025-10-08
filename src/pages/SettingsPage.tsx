import { useState } from 'react';
import { User, Building2, Shield, Bell, FolderOpen, Tag, Palette } from 'lucide-react';
import { BusinessManagement } from '../components/settings/BusinessManagement';
import { CollectionManagement } from '../components/settings/CollectionManagement';
import { CategoryManagement } from '../components/settings/CategoryManagement';
import { ProfileManagement } from '../components/settings/ProfileManagement';
import { ThemeSettings } from '../components/settings/ThemeSettings';
import { usePageTracking } from '../hooks/usePageTracking';
import { actionTracker } from '../lib/actionTracker';

type SettingsTab = 'profile' | '2fa' | 'businesses' | 'collections' | 'categories' | 'theme' | 'notifications';

export function SettingsPage() {
  usePageTracking('Settings', { section: 'settings' });
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

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
                Businesses
              </div>
            </button>
            <button
              onClick={() => setActiveTab('collections')}
              className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                activeTab === 'collections'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-600 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200 hover:border-slate-300 dark:border-gray-600 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-2">
                <FolderOpen size={18} />
                Collections
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

          {activeTab === '2fa' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Two-Factor Authentication</h3>
              <p className="text-sm text-slate-600 dark:text-gray-400 mb-4">
                Secure your account with 2FA using authenticator app or SMS
              </p>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  <strong>Important:</strong> 2FA setup will be implemented before production use.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'businesses' && <BusinessManagement />}

          {activeTab === 'collections' && <CollectionManagement />}

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
