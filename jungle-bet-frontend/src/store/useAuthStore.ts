import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LanguageCode } from '../utils/constants';

export interface UserProfile {
  id: number | string;
  username: string;
  email?: string | null;
  balance_usd: number;
  preferred_currency: string;
  location?: string | null;
  role: 'user' | 'admin';
  is_flagged?: boolean;
  flag_reason?: string | null;
  is_banned?: boolean;
  kyc_status?: 'unverified' | 'pending' | 'verified';
  referral_code?: string;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  theme: 'dark' | 'light';
  language: LanguageCode;
  login: (user: UserProfile, token: string, refreshToken?: string) => void;
  setAuth: (user: UserProfile, token: string, refreshToken?: string) => void;
  updateUser: (partial: Partial<UserProfile>) => void;
  setTokens: (token: string, refreshToken?: string) => void;
  logout: () => void;
  toggleTheme: () => void;
  setLanguage: (lang: LanguageCode) => void;
}

const syncTokenStorage = (token: string | null, refreshToken?: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      localStorage.setItem('access_token', token);
      localStorage.setItem('token', token);
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }
    } else {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
    }
  } catch {
    // Ignore storage quota or SSR errors
  }
};

const normalizeUser = (user: UserProfile): UserProfile => ({
  ...user,
  role:
    user.role ||
    (user.username?.toLowerCase().includes('admin') || Number(user.id) === 1
      ? 'admin'
      : 'user'),
  kyc_status: user.kyc_status || 'unverified',
  referral_code:
    user.referral_code ||
    `JB-${(user.username || 'RACER').toUpperCase().slice(0, 6)}-2026`,
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      theme: 'dark',
      language: 'en',

      login: (user, token, refreshToken) => {
        const effectiveRefresh = refreshToken || token;
        syncTokenStorage(token, effectiveRefresh);
        set({
          user: normalizeUser(user),
          token,
          refreshToken: effectiveRefresh,
          isAuthenticated: Boolean(token),
        });
      },

      setAuth: (user, token, refreshToken) => {
        const effectiveRefresh = refreshToken || token;
        syncTokenStorage(token, effectiveRefresh);
        set({
          user: normalizeUser(user),
          token,
          refreshToken: effectiveRefresh,
          isAuthenticated: Boolean(token),
        });
      },

      updateUser: (partial) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...partial } : null,
        })),

      setTokens: (token, refreshToken) =>
        set((state) => {
          const effectiveRefresh = refreshToken || state.refreshToken || token;
          syncTokenStorage(token, effectiveRefresh);
          return {
            token,
            refreshToken: effectiveRefresh,
            isAuthenticated: Boolean(token),
          };
        }),

      logout: () => {
        syncTokenStorage(null, null);
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      toggleTheme: () =>
        set((state) => {
          const next = state.theme === 'dark' ? 'light' : 'dark';
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', next === 'dark');
            document.documentElement.classList.toggle('light', next === 'light');
          }
          return { theme: next };
        }),

      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'junglebet-auth-storage',
    }
  )
);
