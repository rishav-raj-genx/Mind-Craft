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

  /**
   * Records a daily check-in (app open). Idempotent — safe to call
   * multiple times per day. Returns full streak data including badges.
   */
  checkIn: async () => {
    const response = await api.post('/streak/checkin');
    return response.data;
  },

  /**
   * Gets dynamic badge progress for a user.
   * Returns badges, totalEarned, sessionHistory, badgeHistory.
   */
  getBadges: async (uid) => {
    const response = await api.get(`/badges/${uid}`);
    return response.data;
  },

  getLeaderboard: async () => {
    const response = await api.get('/leaderboard');
    return response.data;
  },

  awardForumTokens: async (questionId = '') => {
    const response = await api.post('/tokens/award/forum', { questionId });
    return response.data;
  },
  
  awardSessionTokens: async (teacherUid, learnerUid, sessionId) => {
    const response = await api.post('/tokens/award/session', { teacherUid, learnerUid, sessionId });
    return response.data;
  }
};
