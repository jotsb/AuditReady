import { useState, ReactNode } from 'react';
import { ChevronRight, Menu, X } from 'lucide-react';

export interface SectionItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: string | number;
}

export interface SectionGroup {
  label: string;
  items: SectionItem[];
}

interface SectionLayoutProps {
  groups: SectionGroup[];
  activeSection: string;
  onSectionChange: (id: string) => void;
  children: ReactNode;
  accentColor?: 'blue' | 'red';
}

export function SectionLayout({
  groups,
  activeSection,
  onSectionChange,
  children,
  accentColor = 'blue',
}: SectionLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeItem = groups
    .flatMap((g) => g.items)
    .find((item) => item.id === activeSection);

  const accentClasses = {
    blue: {
      activeBg: 'bg-blue-50 dark:bg-blue-950/40',
      activeText: 'text-blue-700 dark:text-blue-300',
      activeBorder: 'border-blue-600 dark:border-blue-400',
      activeIndicator: 'bg-blue-600 dark:bg-blue-400',
      hoverBg: 'hover:bg-slate-50 dark:hover:bg-gray-800/60',
    },
    red: {
      activeBg: 'bg-red-50 dark:bg-red-950/40',
      activeText: 'text-red-700 dark:text-red-300',
      activeBorder: 'border-red-600 dark:border-red-400',
      activeIndicator: 'bg-red-600 dark:bg-red-400',
      hoverBg: 'hover:bg-slate-50 dark:hover:bg-gray-800/60',
    },
  };

  const accent = accentClasses[accentColor];

  return (
    <div className="flex flex-col lg:flex-row gap-0 lg:gap-6 min-h-0">
      <button
        onClick={() => setMobileNavOpen(!mobileNavOpen)}
        className="lg:hidden flex items-center justify-between w-full px-4 py-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm mb-4"
      >
        <div className="flex items-center gap-3">
          {activeItem && (
            <>
              <span className="text-slate-500 dark:text-gray-400">{activeItem.icon}</span>
              <span className="font-medium text-slate-800 dark:text-white text-sm">{activeItem.label}</span>
            </>
          )}
        </div>
        {mobileNavOpen ? (
          <X size={20} className="text-slate-500 dark:text-gray-400" />
        ) : (
          <Menu size={20} className="text-slate-500 dark:text-gray-400" />
        )}
      </button>

      {mobileNavOpen && (
        <div className="lg:hidden bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg shadow-sm mb-4 overflow-hidden">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="px-4 py-2 text-[11px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider bg-slate-50 dark:bg-gray-900/50">
                {group.label}
              </div>
              {group.items.map((item) => {
                const isActive = item.id === activeSection;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSectionChange(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                      isActive
                        ? `${accent.activeBg} ${accent.activeText} font-medium`
                        : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800/60'
                    }`}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="text-[11px] font-medium bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <nav className="hidden lg:block w-60 flex-shrink-0">
        <div className="sticky top-6 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
          {groups.map((group, groupIndex) => (
            <div key={group.label}>
              {groupIndex > 0 && (
                <div className="mx-3 border-t border-slate-100 dark:border-gray-700/60" />
              )}
              <div className="px-4 pt-4 pb-1.5 text-[11px] font-semibold text-slate-400 dark:text-gray-500 uppercase tracking-wider">
                {group.label}
              </div>
              <div className="px-2 pb-2 space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.id === activeSection;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onSectionChange(item.id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-all duration-150 group relative ${
                        isActive
                          ? `${accent.activeBg} ${accent.activeText} font-semibold`
                          : `text-slate-600 dark:text-gray-400 ${accent.hoverBg} hover:text-slate-800 dark:hover:text-gray-200`
                      }`}
                    >
                      {isActive && (
                        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full ${accent.activeIndicator}`} />
                      )}
                      <span className="flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4">{item.icon}</span>
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      {item.badge !== undefined && (
                        <span className="text-[10px] font-medium bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {item.badge}
                        </span>
                      )}
                      {!isActive && (
                        <ChevronRight
                          size={14}
                          className="text-slate-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
