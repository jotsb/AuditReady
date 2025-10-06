import { useState } from 'react';
import { User, Building2, Shield, Bell, FolderOpen, Tag } from 'lucide-react';
import { BusinessManagement } from '../components/settings/BusinessManagement';
import { CollectionManagement } from '../components/settings/CollectionManagement';
import { CategoryManagement } from '../components/settings/CategoryManagement';

type SettingsTab = 'profile' | '2fa' | 'businesses' | 'collections' | 'categories' | 'notifications';

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('businesses');

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px overflow-x-auto">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                activeTab === 'profile'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
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
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
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
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
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
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
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
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Tag size={18} />
                Categories
              </div>
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition ${
                activeTab === 'notifications'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
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
          {activeTab === 'profile' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Profile Information</h3>
              <p className="text-sm text-slate-600 mb-4">
                Update your name, email, and contact details
              </p>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Profile editing will be implemented in the next phase.
                </p>
              </div>
            </div>
          )}

          {activeTab === '2fa' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Two-Factor Authentication</h3>
              <p className="text-sm text-slate-600 mb-4">
                Secure your account with 2FA using authenticator app or SMS
              </p>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>Important:</strong> 2FA setup will be implemented before production use.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'businesses' && <BusinessManagement />}

          {activeTab === 'collections' && <CollectionManagement />}

          {activeTab === 'categories' && <CategoryManagement />}

          {activeTab === 'notifications' && (
            <div>
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Notifications</h3>
              <p className="text-sm text-slate-600 mb-4">
                Configure email and in-app notification preferences
              </p>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
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
