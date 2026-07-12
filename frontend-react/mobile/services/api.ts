import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import type { AxiosError } from 'axios';

import { showGlobalAlert } from './globalAlert';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'mindcraft.authToken';
const USER_ID_KEY = 'mindcraft.userId';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60s — Render free-tier cold starts can take ~50s
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string }>) => {
    const status = error.response?.status;
    const serverMessage = error.response?.data?.error || error.response?.data?.message;
    const message = serverMessage
      || (error.code === 'ECONNABORTED'
        ? 'The request took too long. Please try again on a stronger connection.'
        : 'Please check your internet connection and try again.');

    showGlobalAlert({
      type: status && status < 500 ? 'warning' : 'error',
      title: status ? `Request failed (${status})` : 'Connection Lost',
      message,
    });

    return Promise.reject(error);
  },
);

export async function saveAuthToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function saveAuthSession(token: string, uid: string) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_ID_KEY, uid],
  ]);
}

export async function getStoredUserId() {
  return AsyncStorage.getItem(USER_ID_KEY);
}

export async function clearAuthToken() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_ID_KEY]);
}
