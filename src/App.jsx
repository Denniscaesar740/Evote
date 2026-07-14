import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ElectionProvider, useElection } from './context/ElectionContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import VoterPortal from './pages/VoterPortal';
import AdminPanel from './pages/AdminPanel';
import AuditorView from './pages/AuditorView';
import ResultsView from './pages/ResultsView';
import ProfilePage from './pages/ProfilePage';
import DepartmentsPage from './pages/DepartmentsPage';
import { ToastContainer, SessionWarningModal } from './components/SharedUI';

function MainApp() {
  const { isAuthenticated, user, sessionWarning, extendSession, logout } = useAuth();
  const { toasts, removeToast } = useElection();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (!isAuthenticated) return <LoginPage />;

  const renderPage = () => {
    if (currentPage === 'profile') return <ProfilePage />;
    if (currentPage === 'results') return <ResultsView />;

    switch (user?.role) {
      case 'voter':
        return <VoterPortal />;

      case 'admin':
        if (currentPage === 'departments') return <DepartmentsPage />;
        // All other admin pages are tabs within AdminPanel
        return <AdminPanel activeTab={currentPage} onNavigateTab={setCurrentPage} />;

      case 'auditor':
        if (currentPage === 'departments') return <DepartmentsPage />;
        return <AuditorView activeTab={currentPage} onNavigateTab={setCurrentPage} />;

      default:
        return <VoterPortal />;
    }
  };

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <SessionWarningModal isOpen={sessionWarning} onExtend={extendSession} onLogout={logout} />
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ElectionProvider>
        <MainApp />
      </ElectionProvider>
    </AuthProvider>
  );
}
