import api from '../config/api';

export const matchService = {
  getMatches: async (uid) => {
    const response = await api.get(`/match/${uid}`);
    return response.data;
  },

  getBroadMatches: async (uid) => {
    const response = await api.get(`/match/${uid}/broad`);
    return response.data;
  },

  sendRequest: async (matchRequest) => {
    const response = await api.post('/match/request', matchRequest);
    return response.data;
  },

  acceptRequest: async (requestId) => {
    const response = await api.post('/match/accept', { requestId });
    return response.data;
  },

  declineRequest: async (requestId) => {
    const response = await api.post('/match/decline', { requestId });
    return response.data;
  },

  getRequests: async (uid) => {
    const response = await api.get(`/match/requests/${uid}`);
    return response.data;
  }
};
