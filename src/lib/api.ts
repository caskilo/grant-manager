import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Enable credentials for CORS
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add authorization header if token exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─────────────────────────────────────────────────────────────────────────────
// Token refresh coordination
// ─────────────────────────────────────────────────────────────────────────────
// Debounce session-expiry redirect so we don't fire multiple times
let isRedirectingToLogin = false;
// Single in-flight refresh promise so concurrent 401s don't race
let refreshInFlight: Promise<string | null> | null = null;

function parseJwtExpiry(token: string): number | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded?.exp === 'number' ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;
  try {
    // Use a bare axios (not our instance) to avoid interceptor recursion.
    const res = await axios.post(
      `${API_URL}/auth/refresh`,
      { refreshToken },
      { headers: { 'Content-Type': 'application/json' }, withCredentials: true },
    );
    const newAccess = res.data?.accessToken;
    const newRefresh = res.data?.refreshToken;
    if (!newAccess) return null;
    localStorage.setItem('access_token', newAccess);
    if (newRefresh) localStorage.setItem('refresh_token', newRefresh);
    return newAccess;
  } catch (err) {
    console.warn('[auth] Refresh token exchange failed', err);
    return null;
  }
}

function scheduleExpiryWarning(token: string) {
  const expMs = parseJwtExpiry(token);
  if (!expMs) return;
  const remaining = expMs - Date.now();
  if (remaining > 0 && remaining < 1000 * 60 * 60 * 24 * 365) {
    console.info(
      `[auth] Access token expires in ${Math.round(remaining / 60000)} minutes (at ${new Date(expMs).toISOString()})`,
    );
  } else if (remaining <= 0) {
    console.warn('[auth] Access token already expired on load');
  }
}

// Announce token expiry once at boot for diagnostics
const bootToken = localStorage.getItem('access_token');
if (bootToken) scheduleExpiryWarning(bootToken);

function forceLogoutRedirect() {
  if (isRedirectingToLogin) return;
  isRedirectingToLogin = true;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  sessionStorage.setItem('session_expired', '1');
  const basePath = import.meta.env.BASE_URL;
  window.location.href = `${basePath}login`;
}

// Response interceptor: on 401, try refresh ONCE, then retry original request.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;
    const requestUrl = original?.url || '';
    const isLoginRequest = requestUrl.includes('/auth/login');
    const isRefreshRequest = requestUrl.includes('/auth/refresh');

    if (status === 401 && !isLoginRequest && !isRefreshRequest && original && !original._retried) {
      // Diagnostic log so "silent" logouts are visible in DevTools console
      console.warn(`[auth] 401 on ${requestUrl} — attempting token refresh`);

      original._retried = true;
      if (!refreshInFlight) refreshInFlight = performRefresh();
      const newToken = await refreshInFlight;
      refreshInFlight = null;

      if (newToken) {
        original.headers = original.headers || {};
        (original.headers as Record<string, string>).Authorization = `Bearer ${newToken}`;
        return api.request(original);
      }

      console.warn('[auth] Refresh failed — forcing logout redirect');
      forceLogoutRedirect();
    } else if (status === 401 && !isLoginRequest && !isRefreshRequest) {
      // Already retried — honour the logout
      forceLogoutRedirect();
    }

    return Promise.reject(error);
  },
);

export default api;
