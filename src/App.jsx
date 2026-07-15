import { useState, useEffect } from 'react';
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
import acsesLogo from './ACSES.jpg';

function MainApp() {
  const { isAuthenticated, user, sessionWarning, extendSession, logout, isInitializing } = useAuth();
  const { toasts, removeToast } = useElection();

  const [currentPage, setCurrentPage] = useState(() => {
    return localStorage.getItem('currentPage') || 'dashboard';
  });

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      localStorage.setItem('currentPage', currentPage);
    }
  }, [currentPage, isAuthenticated, isInitializing]);

  useEffect(() => {
    if (!isInitializing && !isAuthenticated) {
      localStorage.removeItem('currentPage');
      setCurrentPage('dashboard');
    }
  }, [isAuthenticated, isInitializing]);

  if (isInitializing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-page)', flexDirection: 'column', gap: 20 }}>
        <div style={{ width: 140, height: 140, borderRadius: 24, overflow: 'hidden', border: '3px solid var(--green-100)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', animation: 'pulse 2s ease-in-out infinite', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={acsesLogo} alt="ACSES Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 14, height: 14, border: '2px solid var(--green-100)', borderTopColor: 'var(--green-600)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-500)', letterSpacing: '0.01em' }}>Verifying security credentials...</span>
        </div>
      </div>
    );
  }

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
