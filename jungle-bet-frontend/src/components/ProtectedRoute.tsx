import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/useAuthStore';

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

/**
 * Checks whether a JWT token has expired client-side
 */
function isJwtExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp === 'number') {
      const nowSec = Math.floor(Date.now() / 1000);
      return payload.exp < nowSec;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * ProtectedRoute Wrapper Component
 * Guards /wallet, /betting, /profile routes and redirects unauthenticated users to /login.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
}) => {
  const { isAuthenticated, token, user, logout } = useAuthStore();
  const location = useLocation();

  const effectiveToken =
    token ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('access_token') || localStorage.getItem('token')
      : null);

  const expired = isJwtExpired(effectiveToken);
  const authenticated = Boolean(isAuthenticated && effectiveToken && !expired);

  useEffect(() => {
    if (!authenticated) {
      if (expired && effectiveToken) {
        logout();
      }
      toast.error('Not authenticated. Please sign in to continue.', {
        id: 'protected-route-auth-error',
      });
    }
  }, [authenticated, expired, effectiveToken, logout]);

  if (!authenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location, error: 'Not authenticated' }}
        replace
      />
    );
  }

  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
