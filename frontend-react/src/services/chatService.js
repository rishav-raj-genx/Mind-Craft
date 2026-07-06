import api from '../config/api';

export const chatService = {
  getHistory: async (matchId, before = null) => {
    const params = before ? { before } : {};
    const response = await api.get(`/chat/${matchId}/history`, { params });
    return response.data;
  },

  sendMessage: async (matchId, text) => {
    const response = await api.post(`/chat/${matchId}/send`, { text });
    return response.data;
  },

  getThreads: async (uid) => {
    const response = await api.get(`/chat/threads/${uid}`);
    return response.data;
  },

  getThreadDetail: async (matchId) => {
    const response = await api.get(`/chat/${matchId}/detail`);
    return response.data;
  },

  getOrCreateThread: async (partnerUid) => {
    const response = await api.post(`/chat/thread`, { partnerUid });
    return response.data;
  },

  editMessage: async (matchId, messageId, text) => {
    const response = await api.patch(`/chat/${matchId}/message/${messageId}`, { text });
    return response.data;
  },

  deleteMessage: async (matchId, messageId) => {
    const response = await api.delete(`/chat/${matchId}/message/${messageId}`);
    return response.data;
  }
};
