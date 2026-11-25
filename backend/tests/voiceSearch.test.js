const express = require('express');
const request = require('supertest');

jest.mock('../src/middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { clerkUserId: 'user-clerk-1', uid: 'user-clerk-1' };
    next();
  },
}));

jest.mock('../src/services/sarvamAI', () => ({
  transcribeAudio: jest.fn().mockResolvedValue({ transcript: 'learn python' }),
  SUPPORTED_LANGUAGES: {
    'hi-IN': 'Hindi',
    'en-IN': 'English (India)',
  },
}));

jest.mock('../src/services/intentParser', () => ({
  extractSkillIntent: jest.fn().mockReturnValue({ skill: 'Python', confidence: 0.95, method: 'regex' }),
}));

jest.mock('../src/services/matchingEngine', () => ({
  findMatches: jest.fn().mockResolvedValue([]),
}));

const voiceSearchRoutes = require('../src/routes/voiceSearch');
const { globalErrorHandler } = require('../src/middleware/errorHandler');

describe('Voice Search Route & Codec Support', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/voice-search', voiceSearchRoutes);
    app.use(globalErrorHandler);
  });

  it('HIGH-33: accepts audio/webm;codecs=opus uploads from Chrome/Firefox without 415', async () => {
    const res = await request(app)
      .post('/api/voice-search')
      .field('languageCode', 'hi-IN')
      .attach('audio', Buffer.from('fake webm opus audio bytes'), {
        filename: 'recording.webm',
        contentType: 'audio/webm;codecs=opus',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.transcript).toBe('learn python');
  });

  it('rejects unsupported audio media type with HTTP 415', async () => {
    const res = await request(app)
      .post('/api/voice-search')
      .field('languageCode', 'hi-IN')
      .attach('audio', Buffer.from('fake video'), {
        filename: 'video.mp4',
        contentType: 'video/mp4',
      });

    expect(res.status).toBe(415);
  });
});
