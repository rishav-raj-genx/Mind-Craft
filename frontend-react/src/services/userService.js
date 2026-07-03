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

  // Search users globally
  searchUsers: async (query) => {
    const response = await api.get(`/user/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }
};
