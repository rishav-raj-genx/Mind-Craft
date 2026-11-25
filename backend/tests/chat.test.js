jest.mock('@clerk/express', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../src/config/redis', () => ({
  getRedisClients: jest.fn(() => ({
    base: { on: jest.fn(), quit: jest.fn().mockResolvedValue(), disconnect: jest.fn() },
    publisher: { on: jest.fn(), quit: jest.fn().mockResolvedValue(), disconnect: jest.fn() },
    subscriber: { on: jest.fn(), quit: jest.fn().mockResolvedValue(), disconnect: jest.fn() },
  })),
  closeRedis: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/queues/chatPersistenceQueue', () => ({
  enqueueChatMessage: jest.fn().mockResolvedValue('job-123'),
  getChatPersistenceQueue: jest.fn(),
}));

jest.mock('../src/config/prisma', () => {
  const mockUser = {
    id: '11111111-1111-4111-8111-111111111111',
    clerkUserId: 'user_test_caller',
    name: 'Test Caller',
    email: 'caller@example.com',
    deletedAt: null,
  };

  return {
    prisma: {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockUser),
        findFirst: jest.fn().mockResolvedValue(mockUser),
      },
      chatParticipant: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      chatMessage: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      chatThread: {
        findUnique: jest.fn(),
      },
    },
    disconnectPrisma: jest.fn().mockResolvedValue(),
  };
});

const express = require('express');
const request = require('supertest');
const { verifyToken } = require('@clerk/express');
const { prisma } = require('../src/config/prisma');
const chatRoutes = require('../src/routes/chat');
const { globalErrorHandler } = require('../src/middleware/errorHandler');
const { closeChatPersistenceWorker } = require('../src/workers/chatPersistenceWorker');

describe('Chat Routes & RLS Authorization', () => {
  let app;
  const callerUser = {
    id: '11111111-1111-4111-8111-111111111111',
    clerkUserId: 'user_test_caller',
    name: 'Test Caller',
    email: 'caller@example.com',
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    verifyToken.mockResolvedValue({ sub: 'user_test_caller' });
    prisma.user.findUnique.mockResolvedValue(callerUser);
    prisma.user.findFirst.mockResolvedValue(callerUser);

    app = express();
    app.use(express.json());
    app.use('/api/chat', chatRoutes);
    app.use(globalErrorHandler);
  });

  afterAll(async () => {
    await closeChatPersistenceWorker();
  });

  it('rejects GET /api/chat/history/:threadId with 403 when caller is not a participant', async () => {
    prisma.chatParticipant.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .get('/api/chat/history/22222222-2222-4222-8222-222222222222')
      .set('Authorization', 'Bearer valid_token');

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Not a participant');
  });

  it('allows GET /api/chat/history/:threadId when caller is participant and clamps limit between 1 and 100', async () => {
    prisma.chatParticipant.findUnique.mockResolvedValue({
      threadId: '22222222-2222-4222-8222-222222222222',
      userId: callerUser.id,
      leftAt: null,
    });
    prisma.chatMessage.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/chat/history/22222222-2222-4222-8222-222222222222?limit=500')
      .set('Authorization', 'Bearer valid_token');

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(100);
    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
      }),
    );
  });

  it('clamps negative or zero limit to 1', async () => {
    prisma.chatParticipant.findUnique.mockResolvedValue({
      threadId: '22222222-2222-4222-8222-222222222222',
      userId: callerUser.id,
      leftAt: null,
    });
    prisma.chatMessage.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/chat/history/22222222-2222-4222-8222-222222222222?limit=-10')
      .set('Authorization', 'Bearer valid_token');

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(1);
    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 1,
      }),
    );
  });

  it('supports legacy path /api/chat/:matchId/history with RLS authorization', async () => {
    prisma.chatParticipant.findUnique.mockResolvedValue({
      threadId: '22222222-2222-4222-8222-222222222222',
      userId: callerUser.id,
      leftAt: null,
    });
    prisma.chatMessage.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get('/api/chat/22222222-2222-4222-8222-222222222222/history')
      .set('Authorization', 'Bearer valid_token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
