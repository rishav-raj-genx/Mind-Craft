const express = require('express');
const request = require('supertest');

jest.mock('../src/config/prisma', () => {
  const mockPrisma = {
    doubt: {
      groupBy: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
    doubtVote: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    doubtAnswer: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn((callbackOrArray) => {
      if (typeof callbackOrArray === 'function') {
        return callbackOrArray(mockPrisma);
      }
      return Promise.all(callbackOrArray);
    }),
  };
  return { prisma: mockPrisma };
});

jest.mock('../src/middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { clerkUserId: 'user-clerk-1', uid: 'user-clerk-1' };
    next();
  },
  optionalAuth: (req, _res, next) => {
    req.user = { clerkUserId: 'user-clerk-1', uid: 'user-clerk-1' };
    next();
  },
}));

jest.mock('../src/services/tokenEconomy', () => ({
  awardForumAnswer: jest.fn().mockResolvedValue({}),
}));

jest.mock('../src/services/chatService', () => ({
  broadcastToGlobal: jest.fn(),
}));

jest.mock('../src/services/sarvamAI', () => ({
  generateStudyHint: jest.fn().mockResolvedValue({ hint: 'Test hint' }),
}));

const { prisma } = require('../src/config/prisma');
const doubtRoutes = require('../src/routes/doubt');
const { globalErrorHandler } = require('../src/middleware/errorHandler');

describe('Doubt Routes & Upvotes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/doubt', doubtRoutes);
    app.use(globalErrorHandler);
  });

  it('HIGH-29: GET /api/doubt/trending is routed correctly before /:id', async () => {
    prisma.doubt.groupBy.mockResolvedValue([
      { primaryTag: '#DSA', _count: { id: 5 } },
      { primaryTag: '#Math', _count: { id: 3 } },
    ]);

    const res = await request(app).get('/api/doubt/trending');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([
      { tag: '#DSA', count: 5 },
      { tag: '#Math', count: 3 },
    ]);
    expect(prisma.doubt.groupBy).toHaveBeenCalled();
    expect(prisma.doubt.findUnique).not.toHaveBeenCalled();
  });

  it('HIGH-30: supports POST /api/doubt/:id/upvote', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'db-user-1', clerkUserId: 'user-clerk-1' });
    prisma.doubt.findUnique.mockResolvedValue({ id: 'doubt-1', upvoteCount: 4, deletedAt: null });
    prisma.doubtVote.findUnique.mockResolvedValue(null);
    prisma.doubt.update.mockResolvedValue({ upvoteCount: 5 });

    const res = await request(app).post('/api/doubt/doubt-1/upvote');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ upvotes: 5, hasUpvoted: true });
    expect(prisma.doubtVote.create).toHaveBeenCalledWith({
      data: { doubtId: 'doubt-1', userId: 'db-user-1' },
    });
  });

  it('HIGH-30: supports PATCH /api/doubt/:id/upvote and toggles off existing vote', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'db-user-1', clerkUserId: 'user-clerk-1' });
    prisma.doubt.findUnique.mockResolvedValue({ id: 'doubt-1', upvoteCount: 5, deletedAt: null });
    prisma.doubtVote.findUnique.mockResolvedValue({ id: 'vote-1' });
    prisma.doubt.update.mockResolvedValue({ upvoteCount: 4 });

    const res = await request(app).patch('/api/doubt/doubt-1/upvote');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ upvotes: 4, hasUpvoted: false });
    expect(prisma.doubtVote.delete).toHaveBeenCalled();
  });

  it('HIGH-31: prevents authors from answering their own doubt with HTTP 403', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'db-user-1', clerkUserId: 'user-clerk-1' });
    prisma.doubt.findUnique.mockResolvedValue({
      id: 'doubt-1',
      authorId: 'db-user-1',
      author: { clerkUserId: 'user-clerk-1' },
      deletedAt: null,
    });

    const res = await request(app)
      .post('/api/doubt/doubt-1/answer')
      .send({ content: 'Here is my own solution to my question.' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Authors cannot answer their own doubts');
  });

  it('HIGH-27: rejects invalid image format with HTTP 415', async () => {
    const res = await request(app)
      .post('/api/doubt')
      .field('title', 'Valid Question Title Here')
      .field('content', 'Valid content explaining the question here.')
      .field('tag', '#DSA')
      .attach('images', Buffer.from('fake pdf content'), {
        filename: 'notes.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(415);
  });
});
