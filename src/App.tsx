import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { ReceiptsPage } from './pages/ReceiptsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import TeamPage from './pages/TeamPage';
import { AdminPage } from './pages/AdminPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { MainLayout } from './components/layout/MainLayout';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const getTitle = () => {
    switch (currentView) {
      case 'dashboard':
        return 'Dashboard';
      case 'receipts':
        return 'Receipts';
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
      case 'admin':
        return 'System Administration';
      default:
        return 'AuditReady';
    }
  };

  const renderPage = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardPage />;
      case 'receipts':
        return <ReceiptsPage />;
      case 'collections':
        return <CollectionsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'team':
        return <TeamPage />;
      case 'settings':
        return <SettingsPage />;
      case 'audit':
        return <AuditLogsPage />;
      case 'admin':
        return <AdminPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <MainLayout
      currentView={currentView}
      onNavigate={setCurrentView}
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
