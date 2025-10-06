import { User, Building2, Shield, Bell } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">Account Settings</h3>

        <div className="space-y-6">
          <div className="flex items-start gap-4 p-4 border border-slate-200 rounded-lg">
            <div className="p-3 bg-blue-50 rounded-lg">
              <User size={24} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-slate-800 mb-1">Profile Information</h4>
              <p className="text-sm text-slate-600 mb-3">
                Update your name, email, and contact details
              </p>
              <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm">
                Edit Profile
              </button>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 border border-slate-200 rounded-lg">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Shield size={24} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-slate-800 mb-1">Two-Factor Authentication</h4>
              <p className="text-sm text-slate-600 mb-3">
                Secure your account with 2FA using authenticator app or SMS
              </p>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm">
                Setup 2FA
              </button>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 border border-slate-200 rounded-lg">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Building2 size={24} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-slate-800 mb-1">Business Settings</h4>
              <p className="text-sm text-slate-600 mb-3">
                Manage business details, tax ID, and currency preferences
              </p>
              <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm">
                Manage Businesses
              </button>
            </div>
          </div>

          <div className="flex items-start gap-4 p-4 border border-slate-200 rounded-lg">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Bell size={24} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-slate-800 mb-1">Notifications</h4>
              <p className="text-sm text-slate-600 mb-3">
                Configure email and in-app notification preferences
              </p>
              <button className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm">
                Configure
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Settings functionality will be fully implemented in the next phase. 2FA is required before production use.
          </p>
        </div>
      </div>
    </div>
  );
}
