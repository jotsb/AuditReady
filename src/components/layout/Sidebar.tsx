import { Home, Receipt, FolderOpen, Settings, LogOut, BarChart3, Users, Shield, Activity, Database } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  currentView: string;
  onNavigate: (view: string) => void;
}

export function Sidebar({ isOpen, currentView, onNavigate }: SidebarProps) {
  const { signOut, isSystemAdmin } = useAuth();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'receipts', label: 'Receipts', icon: Receipt },
    { id: 'collections', label: 'Collections', icon: FolderOpen },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'audit', label: 'Audit Logs', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const adminMenuItems = [
    { id: 'admin', label: 'System Admin', icon: Shield },
    { id: 'system-logs', label: 'System Logs', icon: Database },
  ];

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => onNavigate(currentView)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full bg-slate-800 text-white w-64 z-50 transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static
        `}
      >
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <img
              src="/icon.svg"
              alt="AuditReady"
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-xl font-bold">AuditReady</h1>
              <p className="text-xs text-slate-400 dark:text-gray-500">Receipt Manager</p>
            </div>
          </div>
        </div>

        <nav className="p-4 flex-1">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;

              return (
                <li key={item.id}>
                  <button
                    onClick={() => onNavigate(item.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg transition
                      ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                      }
                    `}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {isSystemAdmin && (
            <>
              <div className="my-4 border-t border-slate-700"></div>
              <div className="mb-2 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Admin Tools
              </div>
              <ul className="space-y-2">
                {adminMenuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;

                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => onNavigate(item.id)}
                        className={`
                          w-full flex items-center gap-3 px-4 py-3 rounded-lg transition
                          ${
                            isActive
                              ? 'bg-red-600 text-white'
                              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                          }
                        `}
                      >
                        <Icon size={20} />
                        <span className="font-medium">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700 hover:text-white transition"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
