import api from '../config/api';

export const doubtService = {
  // Fetch all doubts, optionally filtered by tag
  getAllDoubts: async (tag = 'All Doubts') => {
    const params = tag !== 'All Doubts' ? { tag } : {};
    const response = await api.get('/doubt', { params });
    return response.data;
  },

  // Create a new doubt
  createDoubt: async ({ title, content, tag }) => {
    const response = await api.post('/doubt', { title, content, tag });
    return response.data;
  },

  // Add an answer to a doubt
  addAnswer: async (doubtId, content) => {
    const response = await api.post(`/doubt/${doubtId}/answer`, { content });
    return response.data;
  },

  // Upvote or un-upvote a doubt
  toggleUpvote: async (doubtId) => {
    const response = await api.patch(`/doubt/${doubtId}/upvote`);
    return response.data;
  },

  // Get trending tags from recent doubts
  getTrending: async () => {
    const response = await api.get('/doubt/trending');
    return response.data;
  },

  // Resolve (delete) a doubt — author only
  resolveDoubt: async (doubtId) => {
    const response = await api.delete(`/doubt/${doubtId}`);
    return response.data;
  },
};
