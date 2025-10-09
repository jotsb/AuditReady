import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { ReceiptDetailsPage } from './pages/ReceiptDetailsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import TeamPage from './pages/TeamPage';
import { AdminPage } from './pages/AdminPage';
import { EnhancedAuditLogsPage } from './pages/EnhancedAuditLogsPage';
import { SystemLogsPage } from './pages/SystemLogsPage';
import AcceptInvitePage from './pages/AcceptInvitePage';
import { MainLayout } from './components/layout/MainLayout';
import { ResetPasswordForm } from './components/auth/ResetPasswordForm';
import ErrorBoundary from './components/shared/ErrorBoundary';

function AppContent() {
  const { user, loading, mfaPending } = useAuth();
  const [currentView, setCurrentView] = useState(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    if (path === '/reset-password') return 'reset-password';
    if (path === '/accept-invite') return 'accept-invite';
    if (path === '/receipts') return 'receipts';
    if (path === '/receipt-details') return 'receipt-details';
    if (path === '/reports') return 'reports';
    if (path === '/team') return 'team';
    if (path === '/settings') return 'settings';
    if (path === '/audit') return 'audit';
    if (path === '/system-logs') return 'system-logs';
    if (path === '/admin') return 'admin';

    return 'dashboard';
  });

  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  });

  const [quickCaptureAction, setQuickCaptureAction] = useState<'photo' | 'upload' | 'manual' | null>(null);

  useEffect(() => {
    const handleNavigateToSettings = (event: CustomEvent) => {
      setCurrentView('settings');
      window.history.pushState({}, '', '/settings');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('settings-tab-change', {
          detail: { tab: event.detail.section }
        }));
      }, 100);
    };

    const handlePopState = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);

      if (path === '/reset-password') {
        setCurrentView('reset-password');
      } else if (path === '/accept-invite') {
        setCurrentView('accept-invite');
      } else if (path === '/receipts') {
        setCurrentView('receipts');
      } else if (path === '/receipt-details') {
        setCurrentView('receipt-details');
        setSelectedReceiptId(params.get('id'));
      } else if (path === '/reports') {
        setCurrentView('reports');
      } else if (path === '/team') {
        setCurrentView('team');
      } else if (path === '/settings') {
        setCurrentView('settings');
      } else if (path === '/audit') {
        setCurrentView('audit');
      } else if (path === '/system-logs') {
        setCurrentView('system-logs');
      } else if (path === '/admin') {
        setCurrentView('admin');
      } else {
        setCurrentView('dashboard');
      }
    };

    window.addEventListener('navigate-to-settings', handleNavigateToSettings as EventListener);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('navigate-to-settings', handleNavigateToSettings as EventListener);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (currentView === 'reset-password') {
    return <ResetPasswordForm />;
  }

  if (currentView === 'accept-invite') {
    return <AcceptInvitePage />;
  }

  if (!user || mfaPending) {
    return <AuthPage />;
  }

  const handleNavigate = (view: string, receiptId?: string) => {
    setCurrentView(view);
    if (view === 'receipt-details' && receiptId) {
      setSelectedReceiptId(receiptId);
      window.history.pushState({}, '', `/receipt-details?id=${receiptId}`);
    } else {
      setSelectedReceiptId(null);
      const path = view === 'dashboard' ? '/' : `/${view}`;
      window.history.pushState({}, '', path);
    }
    setQuickCaptureAction(null);
  };

  const handleQuickCapture = (type: 'photo' | 'upload' | 'manual') => {
    setQuickCaptureAction(type);
    setCurrentView('receipts');
    window.history.pushState({}, '', '/receipts');
  };

  const getTitle = () => {
    switch (currentView) {
      case 'dashboard':
        return 'Dashboard';
      case 'receipts':
        return 'Receipts';
      case 'receipt-details':
        return 'Receipt Details';
      case 'reports':
        return 'Reports';
      case 'team':
        return 'Team';
      case 'settings':
        return 'Settings';
      case 'audit':
        return 'Audit Logs';
      case 'system-logs':
        return 'System Logs';
      case 'admin':
        return 'System Administration';
      default:
        return 'AuditReady';
    }
  };

  const renderPage = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardPage onViewReceipt={(id) => handleNavigate('receipt-details', id)} />;
      case 'receipts':
        return <ReceiptsPage quickCaptureAction={quickCaptureAction} />;
      case 'receipt-details':
        return selectedReceiptId ? (
          <ReceiptDetailsPage
            receiptId={selectedReceiptId}
            onBack={() => handleNavigate('dashboard')}
          />
        ) : (
          <DashboardPage onViewReceipt={(id) => handleNavigate('receipt-details', id)} />
        );
      case 'reports':
        return <ReportsPage />;
      case 'team':
        return <TeamPage />;
      case 'settings':
        return <SettingsPage />;
      case 'audit':
        return <EnhancedAuditLogsPage />;
      case 'system-logs':
        return <SystemLogsPage />;
      case 'admin':
        return <AdminPage />;
      default:
        return <DashboardPage onViewReceipt={(id) => handleNavigate('receipt-details', id)} />;
    }
  };

  return (
    <ErrorBoundary name="main-content">
      <MainLayout
        currentView={currentView}
        onNavigate={handleNavigate}
        title={getTitle()}
        onQuickCapture={handleQuickCapture}
      >
        <ErrorBoundary name="page-content">
          {renderPage()}
        </ErrorBoundary>
      </MainLayout>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary name="app-root">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
