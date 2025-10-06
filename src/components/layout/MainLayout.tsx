import { useState, ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
  title: string;
}

export function MainLayout({ children, currentView, onNavigate, title }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNavigate = (view: string) => {
    onNavigate(view);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} currentView={currentView} onNavigate={handleNavigate} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} title={title} />

        <main className="flex-1 overflow-y-auto md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
