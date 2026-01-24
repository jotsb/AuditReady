import { useState, useEffect, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AlertProvider } from './contexts/AlertContext';
import { AuthPage } from './pages/AuthPage';
import { MainLayout } from './components/layout/MainLayout';
import { ResetPasswordForm } from './components/auth/ResetPasswordForm';
import ErrorBoundary from './components/shared/ErrorBoundary';
import { LoadingSpinner } from './components/shared/LoadingSpinner';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ReceiptsPage = lazy(() => import('./pages/ReceiptsPage').then(m => ({ default: m.ReceiptsPage })));
const ReceiptDetailsPage = lazy(() => import('./pages/ReceiptDetailsPage').then(m => ({ default: m.ReceiptDetailsPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const AdminPage = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const EnhancedAuditLogsPage = lazy(() => import('./pages/EnhancedAuditLogsPage').then(m => ({ default: m.EnhancedAuditLogsPage })));
const SystemLogsPage = lazy(() => import('./pages/SystemLogsPage').then(m => ({ default: m.SystemLogsPage })));
const AcceptInvitePage = lazy(() => import('./pages/AcceptInvitePage'));

function AppContent() {
  const { user, loading, mfaPending } = useAuth();
  const [currentView, setCurrentView] = useState(() => {
    const path = window.location.pathname;

    if (path === '/reset-password') return 'reset-password';
    if (path === '/accept-invite') return 'accept-invite';
    if (path === '/auth' || path === '/login') return 'auth';
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

  const [quickCaptureAction, setQuickCaptureAction] = useState<'photo' | 'multipage' | 'upload' | 'manual' | null>(null);

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
      } else if (path === '/auth' || path === '/login') {
        setCurrentView('auth');
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

  if (currentView === 'auth') {
    return <AuthPage />;
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

  const handleQuickCapture = (type: 'photo' | 'multipage' | 'upload' | 'manual') => {
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
        return 'Audit Proof';
    }
  };

  const renderPage = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardPage onViewReceipt={(id) => handleNavigate('receipt-details', id)} />;
      case 'receipts':
        return <ReceiptsPage
          quickCaptureAction={quickCaptureAction}
          onQuickCaptureComplete={() => setQuickCaptureAction(null)}
        />;
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
          <Suspense fallback={<LoadingSpinner size="lg" text="Loading page..." />}>
            {renderPage()}
          </Suspense>
        </ErrorBoundary>
      </MainLayout>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ErrorBoundary name="app-root">
      <AuthProvider>
        <AlertProvider>
          <AppContent />
        </AlertProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
