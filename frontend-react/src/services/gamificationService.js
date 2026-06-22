import api from '../config/api';

export const gamificationService = {
  getTokens: async (uid) => {
    const response = await api.get(`/tokens/${uid}`);
    return response.data;
  },

  getStreak: async (uid) => {
    const response = await api.get(`/streak/${uid}`);
    return response.data;
  },

  awardForumTokens: async () => {
    const response = await api.post('/tokens/award/forum');
    return response.data;
  },
  
  awardSessionTokens: async (teacherUid, learnerUid, sessionId) => {
    const response = await api.post('/tokens/award/session', { teacherUid, learnerUid, sessionId });
    return response.data;
  }
};
