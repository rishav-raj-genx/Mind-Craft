import axios from 'axios';
import { auth } from './firebase';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 15_000, // 15s — prevents infinite hangs on flaky mobile networks
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Global response error interceptor ─────────────────────────────────
// Catches network errors & timeouts so the app never fails silently
// or shows a white screen on a flaky mobile connection.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Network error or timeout — no response from server
      const message = error.code === 'ECONNABORTED'
        ? 'Request timed out. Please check your connection and try again.'
        : 'Network error. Please check your internet connection.';
      console.error('🌐 Network error:', error.message);
      // Show a non-blocking toast / alert so the user knows what happened
      if (typeof window !== 'undefined' && !window.__mindcraft_network_toast_active) {
        window.__mindcraft_network_toast_active = true;
        alert(message);
        setTimeout(() => { window.__mindcraft_network_toast_active = false; }, 3000);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
