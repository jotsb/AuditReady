import { useState, ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { FloatingActionButton } from '../shared/FloatingActionButton';

interface MainLayoutProps {
  children: ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
  title: string;
  onQuickCapture?: (type: 'photo' | 'multipage' | 'upload' | 'manual') => void;
}

export function MainLayout({ children, currentView, onNavigate, title, onQuickCapture }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNavigate = (view: string) => {
    onNavigate(view);
    setSidebarOpen(false);
  };

  const handleTakePhotoClick = () => {
    if (onQuickCapture) {
      onQuickCapture('photo');
    } else {
      onNavigate('receipts');
    }
  };

  const handleMultiPagePhotoClick = () => {
    if (onQuickCapture) {
      onQuickCapture('multipage');
    } else {
      onNavigate('receipts');
    }
  };

  const handleUploadClick = () => {
    if (onQuickCapture) {
      onQuickCapture('upload');
    } else {
      onNavigate('receipts');
    }
  };

  const handleManualEntryClick = () => {
    if (onQuickCapture) {
      onQuickCapture('manual');
    } else {
      onNavigate('receipts');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-gray-800 dark:bg-gray-900">
      <Sidebar isOpen={sidebarOpen} currentView={currentView} onNavigate={handleNavigate} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} title={title} />

        <main className="flex-1 overflow-y-auto md:p-6">
          {children}
        </main>
      </div>

      <FloatingActionButton
        onTakePhotoClick={handleTakePhotoClick}
        onMultiPagePhotoClick={handleMultiPagePhotoClick}
        onUploadClick={handleUploadClick}
        onManualEntryClick={handleManualEntryClick}
      />
    </div>
  );
}
