import api from './api';
import { API_ENDPOINTS } from '../utils/constants';
import { useAuthStore, UserProfile } from '../store/useAuthStore';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  password: string;
  email?: string;
  preferred_currency?: string;
  location?: string;
}

export interface AuthResponse {
  message?: string;
  access_token: string;
  refresh_token?: string;
  token_type: string;
  user?: UserProfile;
  balance_usd?: number;
  preferred_currency?: string;
}

/**
 * Authenticate an existing user via POST /login and hydrate user profile
 */
export async function loginUser(payload: LoginPayload): Promise<{
  token: string;
  refreshToken: string;
  user: UserProfile;
  access_token: string;
}> {
  const { data } = await api.post<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, payload);
  const token = data.access_token;
  const refresh = data.refresh_token || token;

  if (data.user) {
    useAuthStore.getState().login(data.user, token, refresh);
    return { token, refreshToken: refresh, user: data.user, access_token: token };
  }

  // Fallback: fetch profile from /me/balance if backend only returned token
  const profileRes = await api.get(API_ENDPOINTS.AUTH.PROFILE, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const isAdmin =
    payload.username.toLowerCase().includes('admin') ||
    Number(profileRes.data?.id) === 1;

  const user: UserProfile = {
    id: profileRes.data?.id ?? payload.username,
    username: profileRes.data?.username || payload.username,
    balance_usd: Number(profileRes.data?.balance_usd ?? 0),
    preferred_currency: profileRes.data?.preferred_currency || 'UGX',
    location: profileRes.data?.location || null,
    role: profileRes.data?.role || (isAdmin ? 'admin' : 'user'),
    is_flagged: Boolean(profileRes.data?.is_flagged),
    flag_reason: profileRes.data?.flag_reason || null,
    is_banned: Boolean(profileRes.data?.is_banned),
  };

  useAuthStore.getState().login(user, token, refresh);
  return { token, refreshToken: refresh, user, access_token: token };
}

/**
 * login(username, password) -> authenticates user, persists JWT token, and returns access_token
 */
export async function login(username: string, password: string): Promise<string> {
  const result = await loginUser({ username, password });
  return result.access_token;
}

/**
 * Register a new user via POST /register and auto-login if token is not included
 */
export async function registerUser(payload: RegisterPayload): Promise<{
  token: string;
  refreshToken: string;
  user: UserProfile;
  access_token: string;
}> {
  const { data } = await api.post<AuthResponse>(API_ENDPOINTS.AUTH.REGISTER, payload);

  if (data.access_token && data.user) {
    const userWithEmail: UserProfile = {
      ...data.user,
      email: payload.email || data.user.email || null,
    };
    const refresh = data.refresh_token || data.access_token;
    useAuthStore.getState().login(userWithEmail, data.access_token, refresh);
    return {
      token: data.access_token,
      refreshToken: refresh,
      user: userWithEmail,
      access_token: data.access_token,
    };
  }

  // Auto-login immediately after registration
  return loginUser({
    username: payload.username,
    password: payload.password,
  });
}

/**
 * register(username, password, email) -> creates user account on backend & stores JWT token
 */
export async function register(
  username: string,
  password: string,
  email?: string,
  preferred_currency: string = 'UGX',
  location?: string
) {
  return registerUser({
    username,
    password,
    email,
    preferred_currency,
    location,
  });
}

/**
 * Refresh JWT token via POST /auth/refresh
 */
export async function refreshAuthToken(candidateRefreshToken?: string): Promise<AuthResponse> {
  const state = useAuthStore.getState();
  const tokenToRefresh =
    candidateRefreshToken ||
    state.refreshToken ||
    state.token ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('refresh_token') || localStorage.getItem('access_token')
      : null);

  if (!tokenToRefresh) {
    throw new Error('Not authenticated');
  }

  const { data } = await api.post<AuthResponse>(
    API_ENDPOINTS.AUTH.REFRESH,
    { refresh_token: tokenToRefresh },
    {
      headers: {
        Authorization: `Bearer ${tokenToRefresh}`,
      },
    }
  );

  if (data.access_token) {
    useAuthStore
      .getState()
      .setTokens(data.access_token, data.refresh_token || data.access_token);
  }
  return data;
}

/**
 * refreshToken() -> auto-refresh expired tokens and return new access_token
 */
export async function refreshToken(candidateRefreshToken?: string): Promise<string> {
  const data = await refreshAuthToken(candidateRefreshToken);
  return data.access_token;
}

/**
 * logout() -> clear JWT token from localStorage and Zustand store
 */
export function logout(): void {
  useAuthStore.getState().logout();
}

/**
 * Fetch current authenticated user profile & balance from GET /me/balance
 */
export async function fetchCurrentUserProfile(): Promise<UserProfile> {
  const { data } = await api.get(API_ENDPOINTS.AUTH.PROFILE);
  const isAdmin =
    String(data.username || '').toLowerCase().includes('admin') ||
    Number(data.id) === 1;

  return {
    id: data.id ?? data.username,
    username: data.username,
    balance_usd: Number(data.balance_usd ?? data.v_coins ?? 0),
    preferred_currency: data.preferred_currency || 'UGX',
    location: data.location || null,
    role: data.role || (isAdmin ? 'admin' : 'user'),
    is_flagged: Boolean(data.is_flagged),
    flag_reason: data.flag_reason || null,
    is_banned: Boolean(data.is_banned),
  };
}
