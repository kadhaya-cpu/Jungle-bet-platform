import React, { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/useAuthStore';
import { useWalletStore } from './store/useWalletStore';
import { fetchCurrentUserProfile } from './services/auth';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Footer } from './components/layout/Footer';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Betting } from './pages/Betting';
import { Wallet } from './pages/Wallet';
import { Profile } from './pages/Profile';
import { Admin } from './pages/Admin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 10000,
    },
  },
});

const AppShell: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { isAuthenticated, theme, updateUser } = useAuthStore();
  const { setBalance } = useWalletStore();

  // Apply Dark / Light Theme to root HTML element
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);

  // Synchronize live profile & balance when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchCurrentUserProfile()
      .then((profile) => {
        updateUser(profile);
        setBalance(profile.balance_usd, profile.preferred_currency);
      })
      .catch(() => {
        // Handled by Axios interceptor if token expired
      });
  }, [isAuthenticated, updateUser, setBalance]);

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors duration-200 ${
        theme === 'light'
          ? 'bg-gray-100 text-gray-900 light-theme'
          : 'bg-[#0f0f0f] text-white'
      }`}
    >
      <Header onOpenMobileSidebar={() => setMobileSidebarOpen(true)} />

      <div className="flex-1 flex">
        <Sidebar
          isOpenMobile={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/betting"
              element={
                <ProtectedRoute>
                  <Betting />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wallet"
              element={
                <ProtectedRoute>
                  <Wallet />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <Footer />

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a1a1a',
            color: '#ffffff',
            border: '1px solid rgba(255, 215, 0, 0.35)',
            borderRadius: '14px',
            fontSize: '13px',
            fontWeight: 600,
          },
        }}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
