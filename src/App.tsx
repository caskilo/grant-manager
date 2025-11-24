import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@mantine/core';
import { useAuthStore } from './stores/authStore';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FundersPage from './pages/FundersPage';
import FunderDetailPage from './pages/FunderDetailPage';
import OpportunitiesPage from './pages/OpportunitiesPage';
import OpportunityDetailPage from './pages/OpportunityDetailPage';
import ApplicationsPage from './pages/ApplicationsPage';
import ApplicationDetailPage from './pages/ApplicationDetailPage';
import TemplatesPage from './pages/TemplatesPage';
import ContactsPage from './pages/ContactsPage';
import ContactDetailPage from './pages/ContactDetailPage';
import InteractionsPage from './pages/InteractionsPage';
import InteractionDetailPage from './pages/InteractionDetailPage';
import ImportPage from './pages/ImportPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AppHeader from './components/layout/AppHeader';
import AppNavbar from './components/layout/AppNavbar';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const user = useAuthStore((state) => state.user);
  const basename = import.meta.env.BASE_URL;

  if (!user) {
    return (
      <BrowserRouter basename={basename}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter basename={basename}>
      <AppShell
        header={{ height: 60 }}
        navbar={{ width: 250, breakpoint: 'sm' }}
        padding="md"
      >
        <AppShell.Header>
          <AppHeader />
        </AppShell.Header>

        <AppShell.Navbar>
          <AppNavbar />
        </AppShell.Navbar>

        <AppShell.Main>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/funders"
              element={
                <ProtectedRoute>
                  <FundersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/funders/:id"
              element={
                <ProtectedRoute>
                  <FunderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/opportunities"
              element={
                <ProtectedRoute>
                  <OpportunitiesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/opportunities/:id"
              element={
                <ProtectedRoute>
                  <OpportunityDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/applications"
              element={
                <ProtectedRoute>
                  <ApplicationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/applications/:id"
              element={
                <ProtectedRoute>
                  <ApplicationDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/templates"
              element={
                <ProtectedRoute>
                  <TemplatesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts"
              element={
                <ProtectedRoute>
                  <ContactsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contacts/:id"
              element={
                <ProtectedRoute>
                  <ContactDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interactions"
              element={
                <ProtectedRoute>
                  <InteractionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/interactions/:id"
              element={
                <ProtectedRoute>
                  <InteractionDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/import"
              element={
                <ProtectedRoute>
                  <ImportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AppShell.Main>
      </AppShell>
    </BrowserRouter>
  );
}

export default App;
