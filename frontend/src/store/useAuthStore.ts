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

export interface ComplianceAcceptanceRecord {
  termsAccepted: boolean;
  fxSpreadAccepted: boolean;
  privacyAccepted: boolean;
  responsibleGamingAccepted: boolean;
  acceptedAt: string | null;
}

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  hasAcceptedTerms: boolean;
  complianceRecord: ComplianceAcceptanceRecord;
  theme: 'dark' | 'light';
  language: LanguageCode;
  login: (user: UserProfile, token: string, refreshToken?: string) => void;
  setAuth: (user: UserProfile, token: string, refreshToken?: string) => void;
  updateUser: (partial: Partial<UserProfile>) => void;
  setTokens: (token: string, refreshToken?: string) => void;
  logout: () => void;
  acceptTerms: () => void;
  toggleTheme: () => void;
  setLanguage: (lang: LanguageCode) => void;
}

export const COMPLIANCE_STORAGE_KEYS = {
  ALL_ACCEPTED: 'junglebet_compliance_accepted',
  HAS_ACCEPTED_TERMS: 'hasAcceptedTerms',
  TERMS_FX: 'junglebet_terms_fx_accepted',
  PRIVACY: 'junglebet_privacy_accepted',
  RESPONSIBLE_GAMING: 'junglebet_responsible_gaming_accepted',
  ACCEPTED_AT: 'junglebet_compliance_accepted_at',
  AGE_VERIFIED: 'junglebet_age_verified',
  LAST_ACTIVITY: 'junglebet_last_activity_ts',
} as const;

export const readComplianceFromStorage = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const allAccepted = localStorage.getItem(COMPLIANCE_STORAGE_KEYS.ALL_ACCEPTED) === 'true';
    const hasAccepted = localStorage.getItem(COMPLIANCE_STORAGE_KEYS.HAS_ACCEPTED_TERMS) === 'true';
    const termsFx = localStorage.getItem(COMPLIANCE_STORAGE_KEYS.TERMS_FX) === 'true';
    const privacy = localStorage.getItem(COMPLIANCE_STORAGE_KEYS.PRIVACY) === 'true';
    const rg = localStorage.getItem(COMPLIANCE_STORAGE_KEYS.RESPONSIBLE_GAMING) === 'true';
    return Boolean((allAccepted || hasAccepted) && termsFx && privacy && rg);
  } catch {
    return false;
  }
};

const writeComplianceToStorage = (acceptedAt: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COMPLIANCE_STORAGE_KEYS.ALL_ACCEPTED, 'true');
    localStorage.setItem(COMPLIANCE_STORAGE_KEYS.HAS_ACCEPTED_TERMS, 'true');
    localStorage.setItem(COMPLIANCE_STORAGE_KEYS.TERMS_FX, 'true');
    localStorage.setItem(COMPLIANCE_STORAGE_KEYS.PRIVACY, 'true');
    localStorage.setItem(COMPLIANCE_STORAGE_KEYS.RESPONSIBLE_GAMING, 'true');
    localStorage.setItem(COMPLIANCE_STORAGE_KEYS.ACCEPTED_AT, acceptedAt);
  } catch {
    // Ignore storage quota or SSR errors
  }
};

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
      hasAcceptedTerms: readComplianceFromStorage(),
      complianceRecord: {
        termsAccepted: readComplianceFromStorage(),
        fxSpreadAccepted: readComplianceFromStorage(),
        privacyAccepted: readComplianceFromStorage(),
        responsibleGamingAccepted: readComplianceFromStorage(),
        acceptedAt:
          typeof window !== 'undefined'
            ? localStorage.getItem(COMPLIANCE_STORAGE_KEYS.ACCEPTED_AT)
            : null,
      },
      theme: 'dark',
      language: 'en',

      login: (user, token, refreshToken) => {
        const effectiveRefresh = refreshToken || token;
        syncTokenStorage(token, effectiveRefresh);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(
              COMPLIANCE_STORAGE_KEYS.LAST_ACTIVITY,
              String(Date.now())
            );
          } catch {
            // Ignore storage errors
          }
        }
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
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(
              COMPLIANCE_STORAGE_KEYS.LAST_ACTIVITY,
              String(Date.now())
            );
          } catch {
            // Ignore storage errors
          }
        }
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
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(COMPLIANCE_STORAGE_KEYS.LAST_ACTIVITY);
          } catch {
            // Ignore storage errors
          }
        }
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      acceptTerms: () => {
        const nowIso = new Date().toISOString();
        writeComplianceToStorage(nowIso);
        set({
          hasAcceptedTerms: true,
          complianceRecord: {
            termsAccepted: true,
            fxSpreadAccepted: true,
            privacyAccepted: true,
            responsibleGamingAccepted: true,
            acceptedAt: nowIso,
          },
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
