import api from '../config/api';

export const userService = {
  register: async (userData) => {
    const response = await api.post('/user/register', userData);
    return response.data;
  },

  getProfile: async (uid) => {
    const response = await api.get(`/user/${uid}`);
    return response.data;
  },

  getFullProfile: async (uid) => {
    const response = await api.get(`/user/${uid}/profile`);
    return response.data;
  },

  updateProfile: async (uid, updates) => {
    const response = await api.patch(`/user/${uid}`, updates);
    return response.data;
  },

  deleteProfile: async (uid) => {
    const response = await api.delete(`/user/${uid}`);
    return response.data;
  },

  // Search users globally
  searchUsers: async (query) => {
    const response = await api.get(`/user/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  followUser: async (uid) => {
    const response = await api.post(`/user/${uid}/follow`);
    return response.data;
  },

  getFollowing: async (uid) => {
    const response = await api.get(`/user/${uid}/following`);
    return response.data;
  },

  getMetadataOptions: async () => {
    const response = await api.get('/user/metadata/options');
    return response.data;
  },

  saveFcmToken: async (uid, fcmToken) => {
    const response = await api.patch(`/user/${uid}`, { fcmToken });
    return response.data;
  }
};
