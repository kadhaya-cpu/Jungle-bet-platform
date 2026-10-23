import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import { API_BASE_URL, API_ENDPOINTS } from '../utils/constants';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Shared Axios HTTP Client with JWT Bearer attachment, automatic 401 token refresh,
 * network error handling, and unauthenticated redirect to /login.
 */
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Auto-attach JWT Bearer token to all requests
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const storeToken = useAuthStore.getState().token;
    const storageToken =
      typeof window !== 'undefined'
        ? localStorage.getItem('access_token') || localStorage.getItem('token')
        : null;
    const token = storeToken || storageToken;

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Auto-refresh expired JWT on 401 & catch network errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ detail?: string; message?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Network / Connection Error Handling
    if (!error.response) {
      const friendlyMessage =
        'Network error: Unable to connect to Jungle Bet backend server. Please verify your internet connection.';
      error.message = friendlyMessage;
      return Promise.reject(error);
    }

    const isAuthRoute =
      originalRequest?.url?.includes(API_ENDPOINTS.AUTH.LOGIN) ||
      originalRequest?.url?.includes(API_ENDPOINTS.AUTH.REGISTER) ||
      originalRequest?.url?.includes(API_ENDPOINTS.AUTH.REFRESH);

    if (error.response.status === 401 && !isAuthRoute) {
      const { refreshToken, token, setTokens, logout } = useAuthStore.getState();

      // If this request already retried token refresh and still failed with 401, force auto-logout
      if (!originalRequest || originalRequest._retry) {
        logout();
        toast.error('Session expired (401). You have been logged out automatically.', {
          id: 'auth-expired-toast',
        });
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      const candidateToken =
        refreshToken ||
        token ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('refresh_token') || localStorage.getItem('access_token')
          : null);

      if (!candidateToken) {
        logout();
        toast.error('Not authenticated. Please sign in to continue.', {
          id: 'auth-expired-toast',
        });
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(new Error('Not authenticated'));
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (newToken: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }
              resolve(api(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await axios.post(
          `${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`,
          { refresh_token: candidateToken },
          {
            headers: {
              Authorization: `Bearer ${candidateToken}`,
            },
          }
        );

        const newAccessToken: string = refreshResponse.data.access_token;
        const newRefreshToken: string =
          refreshResponse.data.refresh_token || newAccessToken;

        setTokens(newAccessToken, newRefreshToken);
        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        logout();
        toast.error('Not authenticated: Session expired. Please sign in again.', {
          id: 'auth-expired-toast',
        });
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
