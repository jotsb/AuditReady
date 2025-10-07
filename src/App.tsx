import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { ReceiptDetailsPage } from './pages/ReceiptDetailsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import TeamPage from './pages/TeamPage';
import { AdminPage } from './pages/AdminPage';
import { EnhancedAuditLogsPage } from './pages/EnhancedAuditLogsPage';
import { SystemLogsPage } from './pages/SystemLogsPage';
import { MainLayout } from './components/layout/MainLayout';
import { ResetPasswordForm } from './components/auth/ResetPasswordForm';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);

  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/reset-password') {
      setCurrentView('reset-password');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (currentView === 'reset-password') {
    return <ResetPasswordForm />;
  }

  if (!user) {
    return <AuthPage />;
  }

  const handleNavigate = (view: string, receiptId?: string) => {
    setCurrentView(view);
    if (view === 'receipt-details' && receiptId) {
      setSelectedReceiptId(receiptId);
    } else {
      setSelectedReceiptId(null);
    }
  };

  const getTitle = () => {
    switch (currentView) {
      case 'dashboard':
        return 'Dashboard';
      case 'receipts':
        return 'Receipts';
      case 'receipt-details':
        return 'Receipt Details';
      case 'collections':
        return 'Collections';
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
        return <ReceiptsPage />;
      case 'receipt-details':
        return selectedReceiptId ? (
          <ReceiptDetailsPage
            receiptId={selectedReceiptId}
            onBack={() => handleNavigate('dashboard')}
          />
        ) : (
          <DashboardPage onViewReceipt={(id) => handleNavigate('receipt-details', id)} />
        );
      case 'collections':
        return <CollectionsPage />;
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
    <MainLayout
      currentView={currentView}
      onNavigate={handleNavigate}
      title={getTitle()}
    >
      {renderPage()}
    </MainLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
