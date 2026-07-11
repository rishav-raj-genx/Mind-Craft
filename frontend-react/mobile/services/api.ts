import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'mindcraft.authToken';
const USER_ID_KEY = 'mindcraft.userId';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 12000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
