import { Menu, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
}

export function Header({ onMenuClick, title }: HeaderProps) {
  const { selectedBusiness, isSystemAdmin } = useAuth();

  return (
    <>
      <header className="bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 px-6 py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              <Menu size={24} className="text-slate-700 dark:text-gray-300" />
            </button>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{title}</h2>
          </div>
        </div>
      </header>

      {selectedBusiness?.suspended && isSystemAdmin && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800 px-6 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-orange-600 dark:text-orange-400 flex-shrink-0" size={20} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                This business is currently suspended
              </p>
              {selectedBusiness.suspension_reason && (
                <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                  Reason: {selectedBusiness.suspension_reason}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedBusiness?.soft_deleted && isSystemAdmin && (
        <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 px-6 py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                This business has been deleted
              </p>
              {selectedBusiness.deletion_reason && (
                <p className="text-xs text-red-700 dark:text-red-400 mt-1">
                  Reason: {selectedBusiness.deletion_reason}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
