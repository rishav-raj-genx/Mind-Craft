import axios from 'axios';

function normalizeBaseUrl(raw) {
  if (!raw || typeof raw !== 'string') return 'http://localhost:3000';
  let url = raw.trim();
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/api\/?$/i, '');
  url = url.replace(/\/+$/, '');
  return url || 'http://localhost:3000';
}

const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
export const API_BASE_URL = normalizeBaseUrl(RAW_API_BASE_URL);
export const WS_BASE_URL = (import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:3000').trim().replace(/\/+$/, '');

let clerkTokenProvider = null;

export function setClerkTokenProvider(provider) {
  clerkTokenProvider = provider;
}

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  async (config) => {
    if (clerkTokenProvider) {
      const token = await clerkTokenProvider();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      const message = error.code === 'ECONNABORTED'
        ? 'Waking up server... (this can take up to 60 seconds on the free tier)'
        : 'Network error. Please check your internet connection.';
      console.error('Network error:', error.message);
      if (typeof window !== 'undefined' && !window.__mindcraft_network_toast_active) {
        window.__mindcraft_network_toast_active = true;
        alert(message);
        setTimeout(() => { window.__mindcraft_network_toast_active = false; }, 3000);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
