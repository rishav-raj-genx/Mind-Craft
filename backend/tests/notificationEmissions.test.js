const express = require('express');
const request = require('supertest');

const mockBroadcastToGlobal = jest.fn();

jest.mock('../src/config/prisma', () => {
  const mockPrisma = {
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    chatThread: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    matchRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    doubt: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    doubtAnswer: {
      create: jest.fn(),
      findFirst: jest.fn(),
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
    req.user = { id: 'db-user-1', clerkUserId: 'clerk-user-1', uid: 'clerk-user-1', name: 'Alice' };
    next();
  },
  optionalAuth: (req, _res, next) => {
    req.user = { id: 'db-user-1', clerkUserId: 'clerk-user-1', uid: 'clerk-user-1', name: 'Alice' };
    next();
  },
}));

jest.mock('../src/services/chatService', () => ({
  broadcastToGlobal: (...args) => mockBroadcastToGlobal(...args),
}));

jest.mock('../src/services/tokenEconomy', () => ({
  awardForumAnswer: jest.fn().mockResolvedValue({}),
}));

jest.mock('../src/services/matchingEngine', () => ({
  findMatches: jest.fn().mockResolvedValue([]),
  findBroadMatches: jest.fn().mockResolvedValue([]),
  findAnyMatches: jest.fn().mockResolvedValue([]),
}));

jest.mock('../src/services/sarvamAI', () => ({
  generateStudyHint: jest.fn().mockResolvedValue({ hint: 'Hint' }),
}));

const { prisma } = require('../src/config/prisma');
const matchRoutes = require('../src/routes/match');
const doubtRoutes = require('../src/routes/doubt');
const { globalErrorHandler } = require('../src/middleware/errorHandler');

describe('Notification Emissions Contract', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/match', matchRoutes);
    app.use('/api/doubt', doubtRoutes);
    app.use(globalErrorHandler);
  });

  it('POST /api/match/request emits subType match_request with route /notifications', async () => {
    const requester = { id: 'db-user-1', clerkUserId: 'clerk-user-1', name: 'Alice' };
    const recipient = { id: 'db-user-2', clerkUserId: 'clerk-user-2', name: 'Bob' };

    prisma.user.findFirst
      .mockResolvedValueOnce(requester)
      .mockResolvedValueOnce(recipient);
    prisma.chatThread.findFirst.mockResolvedValue(null);
    prisma.matchRequest.findFirst.mockResolvedValue(null);
    prisma.matchRequest.create.mockResolvedValue({
      id: 'req-123',
      requesterId: requester.id,
      recipientId: recipient.id,
      sharedSkill: 'React',
      status: 'PENDING',
      createdAt: new Date('2026-11-26T10:00:00Z'),
    });

    const res = await request(app)
      .post('/api/match/request')
      .send({ toUid: 'clerk-user-2', sharedSkill: 'React' });

    expect(res.status).toBe(201);
    expect(mockBroadcastToGlobal).toHaveBeenCalledWith(
      'clerk-user-2',
      expect.objectContaining({
        type: 'global_notification',
        subType: 'match_request',
        data: expect.objectContaining({
          requestId: 'req-123',
          requesterName: 'Alice',
          route: '/notifications',
        }),
      }),
    );
  });

  it('POST /api/match/accept emits subType match_accepted with route /chat/:threadId', async () => {
    prisma.matchRequest.findUnique.mockResolvedValue({
      id: 'req-123',
      requesterId: 'db-user-2',
      recipientId: 'db-user-1',
      sharedSkill: 'React',
      status: 'PENDING',
      requester: { id: 'db-user-2', clerkUserId: 'clerk-user-2', name: 'Bob' },
      recipient: { id: 'db-user-1', clerkUserId: 'clerk-user-1', name: 'Alice' },
    });
    prisma.matchRequest.update.mockResolvedValue({ id: 'req-123', status: 'ACCEPTED' });
    prisma.chatThread.create.mockResolvedValue({ id: 'thread-456' });

    const res = await request(app)
      .post('/api/match/accept')
      .send({ requestId: 'req-123' });

    expect(res.status).toBe(200);
    expect(mockBroadcastToGlobal).toHaveBeenCalledWith(
      'clerk-user-2',
      expect.objectContaining({
        type: 'global_notification',
        subType: 'match_accepted',
        data: expect.objectContaining({
          matchId: 'thread-456',
          route: '/chat/thread-456',
        }),
      }),
    );
  });

  it('POST /api/doubt/:id/answer emits global_forum_doubt with subType new_answer and metadata', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'db-user-1',
      clerkUserId: 'clerk-user-1',
      name: 'Alice',
      photoUrl: '',
    });
    prisma.doubt.findUnique.mockResolvedValue({
      id: 'doubt-1',
      title: 'Binary Search Edge Cases',
      authorId: 'db-user-2',
      deletedAt: null,
      author: { id: 'db-user-2', clerkUserId: 'clerk-user-2', name: 'Bob' },
    });
    prisma.doubtAnswer.create.mockResolvedValue({
      id: 'ans-1',
      content: 'Always check mid calculation to avoid overflow.',
      createdAt: new Date('2026-11-26T10:05:00Z'),
    });
    prisma.doubt.update.mockResolvedValue({});

    const res = await request(app)
      .post('/api/doubt/doubt-1/answer')
      .send({ content: 'Always check mid calculation to avoid overflow.' });

    expect(res.status).toBe(201);
    expect(mockBroadcastToGlobal).toHaveBeenCalledWith(
      'clerk-user-2',
      expect.objectContaining({
        type: 'global_forum_doubt',
        subType: 'new_answer',
        data: expect.objectContaining({
          doubtId: 'doubt-1',
          doubtTitle: 'Binary Search Edge Cases',
          authorName: 'Alice',
          route: '/forum?doubtId=doubt-1',
        }),
      }),
    );
  });

  it('POST /api/doubt/:id/accept-answer emits subType answer_accepted to answer author', async () => {
    const doubtAuthor = { id: 'db-user-1', clerkUserId: 'clerk-user-1', name: 'Alice' };
    const answerAuthor = { id: 'db-user-2', clerkUserId: 'clerk-user-2', name: 'Bob' };

    prisma.user.findFirst.mockResolvedValue(doubtAuthor);
    prisma.doubt.findUnique.mockResolvedValue({
      id: 'doubt-99',
      title: 'Dynamic Programming Memoization',
      authorId: doubtAuthor.id,
      author: doubtAuthor,
      deletedAt: null,
    });
    prisma.doubtAnswer.findFirst
      .mockResolvedValueOnce({
        id: 'ans-99',
        doubtId: 'doubt-99',
        authorId: answerAuthor.id,
        author: answerAuthor,
        deletedAt: null,
      })
      .mockResolvedValueOnce(null);
    prisma.doubtAnswer.updateMany.mockResolvedValue({ count: 1 });
    prisma.doubtAnswer.update.mockResolvedValue({ id: 'ans-99', isAccepted: true });
    prisma.doubt.update.mockResolvedValue({ id: 'doubt-99', status: 'CLOSED' });
    prisma.doubt.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app)
      .post('/api/doubt/doubt-99/accept-answer')
      .send({ answerId: 'ans-99' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockBroadcastToGlobal).toHaveBeenCalledWith(
      'clerk-user-2',
      expect.objectContaining({
        type: 'global_forum_doubt',
        subType: 'answer_accepted',
        data: expect.objectContaining({
          doubtId: 'doubt-99',
          doubtTitle: 'Dynamic Programming Memoization',
          tokenReward: 10,
          route: '/forum?doubtId=doubt-99',
        }),
      }),
    );
  });
});
