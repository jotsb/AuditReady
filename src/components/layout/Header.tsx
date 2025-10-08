import { Menu } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
}

export function Header({ onMenuClick, title }: HeaderProps) {
  return (
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
  );
}
