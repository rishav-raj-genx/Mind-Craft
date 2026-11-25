jest.mock('@clerk/express', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const express = require('express');
const request = require('supertest');
const { verifyToken } = require('@clerk/express');
const { prisma } = require('../src/config/prisma');
const { requireAuth, optionalAuth } = require('../src/middleware/auth');

describe('Auth middleware', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());

    app.get('/protected', requireAuth, (req, res) => {
      res.json({ success: true, auth: req.auth, user: req.user });
    });

    app.get('/optional', optionalAuth, (req, res) => {
      res.json({ success: true, auth: req.auth, user: req.user });
    });
  });

  it('rejects request without token with 401', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'Unauthorized: Invalid or missing token',
    });
  });

  it('rejects request with malformed or invalid token with 401', async () => {
    verifyToken.mockRejectedValue(new Error('Bad JWT'));
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid_token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'Unauthorized: Invalid or missing token',
    });
  });

  it('rejects when token has no subject with 401', async () => {
    verifyToken.mockResolvedValue({});
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid_token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'Unauthorized: Invalid or missing token',
    });
  });

  it('rejects when user does not exist in DB with 401', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_unknown' });
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid_token');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'Unauthorized: User record not found',
    });
  });

  it('rejects when user is deactivated with 403', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_deactivated' });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', clerkUserId: 'user_deactivated', deletedAt: new Date() });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid_token');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: 'This account has been deactivated',
    });
  });

  it('attaches req.auth and req.user on valid request', async () => {
    verifyToken.mockResolvedValue({ sub: 'user_123', email: 'test@example.com' });
    prisma.user.findUnique.mockResolvedValue({ id: 'u-123', clerkUserId: 'user_123', email: 'test@example.com', deletedAt: null });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer valid_token');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.auth.userId).toBe('user_123');
    expect(res.body.user.clerkUserId).toBe('user_123');
  });

  it('allows optionalAuth without token', async () => {
    const res = await request(app).get('/optional');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, auth: null, user: null });
  });
});
