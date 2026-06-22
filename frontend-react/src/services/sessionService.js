import api from '../config/api';

export const sessionService = {
  /**
   * Book a new tutoring session.
   * POST /api/session/book
   */
  book: async ({ matchId, teacherUid, learnerUid, skill, scheduledAt, mode, meetLink, location, notes }) => {
    const response = await api.post('/session/book', {
      matchId,
      teacherUid,
      learnerUid,
      skill,
      scheduledAt,
      mode: mode || 'Online',
      meetLink: meetLink || '',
      location: location || '',
      notes: notes || '',
    });
    return response.data;
  },

  /**
   * Get sessions for a user (optionally filtered by status).
   * GET /api/session/:uid?status=upcoming
   */
  getSessions: async (uid, status = null) => {
    const params = status ? { status } : {};
    const response = await api.get(`/session/${uid}`, { params });
    return response.data;
  },

  /**
   * Mark a session as complete.
   * PATCH /api/session/:sessionId/complete
   */
  complete: async (sessionId) => {
    const response = await api.patch(`/session/${sessionId}/complete`);
    return response.data;
  },

  /**
   * Rate a completed session (1-5 stars).
   * POST /api/session/:sessionId/rate
   */
  rate: async (sessionId, rating, comment = '') => {
    const response = await api.post(`/session/${sessionId}/rate`, { rating, comment });
    return response.data;
  },

  /**
   * Cancel an upcoming session.
   * POST /api/session/:sessionId/cancel
   */
  cancel: async (sessionId) => {
    const response = await api.post(`/session/${sessionId}/cancel`);
    return response.data;
  },

  /**
   * Export session to Google Calendar.
   * POST /api/session/:sessionId/export-calendar
   */
  exportToCalendar: async (sessionId, googleTokens) => {
    const response = await api.post(`/session/${sessionId}/export-calendar`, { googleTokens });
    return response.data;
  },

  /**
   * Get Google OAuth URL for calendar authorization.
   * GET /api/session/auth/google
   */
  getGoogleAuthUrl: async () => {
    const response = await api.get('/session/auth/google');
    return response.data;
  },
};
