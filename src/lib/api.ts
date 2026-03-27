import axios from 'axios';

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

// Debounce session-expiry redirect so we don't fire multiple times
let isRedirectingToLogin = false;

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isLoginRequest = requestUrl.includes('/auth/login');

    if (error.response?.status === 401 && !isLoginRequest && !isRedirectingToLogin) {
      isRedirectingToLogin = true;
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      sessionStorage.setItem('session_expired', '1');
      const basePath = import.meta.env.BASE_URL;
      window.location.href = `${basePath}login`;
    }
    return Promise.reject(error);
  }
);

export default api;
