const request = require('supertest');

jest.mock('@clerk/express', () => ({
  verifyToken: jest.fn().mockResolvedValue({ sub: 'user-clerk-1' }),
}));

const mockEmitToUser = jest.fn();

jest.mock('../src/config/prisma', () => {
  const mockPrisma = {
    $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    doubt: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
    doubtImage: {
      createMany: jest.fn(),
    },
    doubtAnswer: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    doubtVote: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    $transaction: jest.fn((callbackOrArray) => {
      if (typeof callbackOrArray === 'function') {
        return callbackOrArray(mockPrisma);
      }
      return Promise.all(callbackOrArray);
    }),
  };
  return { prisma: mockPrisma, disconnectPrisma: jest.fn().mockResolvedValue() };
});

jest.mock('../src/config/redis', () => ({
  getRedisClients: jest.fn(() => ({
    base: { ping: jest.fn().mockResolvedValue('PONG'), quit: jest.fn().mockResolvedValue(), disconnect: jest.fn() },
    publisher: { quit: jest.fn().mockResolvedValue(), disconnect: jest.fn() },
    subscriber: { quit: jest.fn().mockResolvedValue(), disconnect: jest.fn() },
  })),
  closeRedis: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/config/socket', () => ({
  initSocketServer: jest.fn(),
  closeSocketServer: jest.fn().mockResolvedValue(),
  emitToUser: (...args) => mockEmitToUser(...args),
  emitToThread: jest.fn(),
}));

jest.mock('../src/workers/chatPersistenceWorker', () => ({
  startChatPersistenceWorker: jest.fn(),
  closeChatPersistenceWorker: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/services/chatService', () => ({
  broadcastToGlobal: jest.fn(),
}));

jest.mock('../src/services/sarvamAI', () => ({
  generateStudyHint: jest.fn(),
  transcribeAudio: jest.fn(),
  SUPPORTED_LANGUAGES: {},
}));

const mockAwardForumAnswer = jest.fn().mockResolvedValue({ awarded: true });
jest.mock('../src/services/tokenEconomy', () => ({
  awardForumAnswer: (...args) => mockAwardForumAnswer(...args),
}));

const { prisma } = require('../src/config/prisma');
const { generateStudyHint } = require('../src/services/sarvamAI');
const { app, doubtCreationLimiter } = require('../server');

const mockUser = {
  id: '11111111-1111-4111-8111-111111111111',
  clerkUserId: 'user-clerk-1',
  name: 'Test Student',
  email: 'student@example.com',
  photoUrl: '',
  deletedAt: null,
  college: { name: 'MIT' },
  department: { name: 'CSE' },
};

const makeDbDoubt = (overrides = {}) => ({
  id: '22222222-2222-4222-8222-222222222222',
  authorId: mockUser.id,
  title: 'Understanding Recursion Base Cases',
  content: 'Why does my recursive function hit stack overflow without a base case?',
  primaryTag: '#DSA',
  status: 'ACTIVE',
  upvoteCount: 3,
  answerCount: 1,
  aiHint: null,
  aiAssistProvider: 'sarvam-ai',
  aiAssistModel: null,
  aiAssistStatus: 'PENDING',
  aiAssistError: null,
  createdAt: new Date('2026-11-26T10:00:00Z'),
  deletedAt: null,
  author: mockUser,
  images: [],
  answers: [],
  votes: [],
  ...overrides,
});

describe('Doubt Forum Remediation & Rate Limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    if (typeof doubtCreationLimiter?.resetKey === 'function') {
      doubtCreationLimiter.resetKey('user-clerk-1');
      doubtCreationLimiter.resetKey('::ffff:127.0.0.1');
      doubtCreationLimiter.resetKey('127.0.0.1');
    }
    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.user.findFirst.mockResolvedValue(mockUser);
    prisma.user.findMany.mockResolvedValue([]);
  });

  it('POST /api/doubt returns 201 immediately with status PENDING and runs Sarvam AI in background', async () => {
    let resolveHint;
    const deferredHint = new Promise((resolve) => {
      resolveHint = resolve;
    });
    generateStudyHint.mockReturnValue(deferredHint);

    const createdDoubt = makeDbDoubt({ aiAssistStatus: 'PENDING', aiHint: null });
    prisma.doubt.create.mockResolvedValue({ id: createdDoubt.id });
    prisma.doubt.findUnique.mockResolvedValue(createdDoubt);
    prisma.doubt.update.mockResolvedValue({
      ...createdDoubt,
      aiHint: 'English: Identify the smallest stopping input.',
      aiAssistStatus: 'GENERATED',
    });

    const startMs = Date.now();
    const res = await request(app)
      .post('/api/doubt')
      .set('Authorization', 'Bearer valid-test-token')
      .send({
        title: 'Understanding Recursion Base Cases',
        content: 'Why does my recursive function hit stack overflow without a base case?',
        tag: '#DSA',
      });
    const elapsedMs = Date.now() - startMs;

    expect(res.status).toBe(201);
    expect(elapsedMs).toBeLessThan(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.aiAssistStatus).toBe('pending');
    expect(res.body.data).toHaveProperty('aiAssistError', null);
    expect(prisma.doubt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          aiAssistStatus: 'PENDING',
        }),
      }),
    );

    // Resolve background AI hint and verify DB update + socket event
    resolveHint({
      hint: 'English: Identify the smallest stopping input.',
      model: 'sarvam-30b',
      usage: { total_tokens: 40 },
      fallback: false,
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(prisma.doubt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: createdDoubt.id },
        data: expect.objectContaining({
          aiHint: 'English: Identify the smallest stopping input.',
          aiAssistStatus: 'GENERATED',
        }),
      }),
    );
    expect(mockEmitToUser).toHaveBeenCalledWith(
      mockUser.id,
      'doubt:hint_ready',
      expect.objectContaining({
        doubtId: createdDoubt.id,
        aiHint: 'English: Identify the smallest stopping input.',
        aiAssistStatus: 'generated',
      }),
    );
  });

  it('POST /api/doubt rate limiter blocks the 6th submission within 10 minutes', async () => {
    generateStudyHint.mockResolvedValue({ hint: 'Quick hint', model: 'sarvam-30b', fallback: false });
    const createdDoubt = makeDbDoubt();
    prisma.doubt.create.mockResolvedValue({ id: createdDoubt.id });
    prisma.doubt.findUnique.mockResolvedValue(createdDoubt);
    prisma.doubt.update.mockResolvedValue(createdDoubt);

    for (let i = 1; i <= 5; i += 1) {
      const res = await request(app)
        .post('/api/doubt')
        .set('Authorization', 'Bearer valid-test-token')
        .send({
          title: `Recursion question number ${i}`,
          content: 'Detailed explanation of the recursion question for testing rate limit.',
          tag: '#DSA',
        });
      expect(res.status).toBe(201);
    }

    const blockedRes = await request(app)
      .post('/api/doubt')
      .set('Authorization', 'Bearer valid-test-token')
      .send({
        title: 'Recursion question number 6',
        content: 'This 6th request within 10 minutes must be blocked with HTTP 429.',
        tag: '#DSA',
      });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.success).toBe(false);
    expect(blockedRes.body.error).toMatch(/5 doubts/i);
  });

  it('GET /api/doubt?q=recursion filters doubts by text across title and content', async () => {
    const recursionDoubt = makeDbDoubt({
      aiAssistStatus: 'FAILED',
      aiAssistError: 'Sarvam timeout',
    });
    prisma.doubt.findMany.mockResolvedValue([recursionDoubt]);

    const res = await request(app)
      .get('/api/doubt?q=recursion&status=OPEN&sortBy=upvotes')
      .set('Authorization', 'Bearer valid-test-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].aiAssistError).toBe('Sarvam timeout');
    expect(res.body.data[0].status).toBe('OPEN');

    expect(prisma.doubt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          deletedAt: null,
          AND: expect.arrayContaining([
            {
              OR: [
                { title: { contains: 'recursion', mode: 'insensitive' } },
                { content: { contains: 'recursion', mode: 'insensitive' } },
              ],
            },
          ]),
        }),
        orderBy: [{ upvoteCount: 'desc' }, { createdAt: 'desc' }],
      }),
    );
  });

  it('GET /api/doubt?onlyMine=true returns author lifetime doubts via SQL authorId filter', async () => {
    const olderAuthorDoubt = makeDbDoubt({
      id: '33333333-3333-4333-8333-333333333333',
      title: 'Old Author Doubt Beyond Top 20 Global Slice',
      status: 'CLOSED',
    });
    prisma.doubt.findMany.mockResolvedValue([olderAuthorDoubt]);

    const res = await request(app)
      .get('/api/doubt?onlyMine=true')
      .set('Authorization', 'Bearer valid-test-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('33333333-3333-4333-8333-333333333333');
    expect(res.body.data[0].status).toBe('SOLVED');

    expect(prisma.doubt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ authorId: mockUser.id }]),
        }),
      }),
    );
  });

  it('Gate #4: rejects accepting a second answer on an already-CLOSED doubt with 409 and mints zero tokens', async () => {
    const closedDoubt = makeDbDoubt({ status: 'CLOSED' });
    const answerRecord = {
      id: 'ans-2',
      doubtId: closedDoubt.id,
      authorId: '33333333-3333-4333-8333-333333333333',
      author: { clerkUserId: 'helper-clerk-2', name: 'Helper Two' },
      isAccepted: false,
      deletedAt: null,
    };

    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.doubt.findUnique.mockResolvedValue(closedDoubt);
    prisma.doubtAnswer.findFirst.mockResolvedValueOnce(answerRecord);
    mockAwardForumAnswer.mockClear();

    const res = await request(app)
      .post(`/api/doubt/${closedDoubt.id}/accept-answer`)
      .set('Authorization', 'Bearer valid-test-token')
      .send({ answerId: 'ans-2' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(mockAwardForumAnswer).not.toHaveBeenCalled();
    expect(prisma.doubt.updateMany).not.toHaveBeenCalled();
  });

  it('Gate #4: rejects concurrent second accept-answer via conditional updateMany (count: 0) without minting tokens', async () => {
    const activeDoubt = makeDbDoubt({ status: 'ACTIVE' });
    const answerRecord = {
      id: 'ans-2',
      doubtId: activeDoubt.id,
      authorId: '33333333-3333-4333-8333-333333333333',
      author: { clerkUserId: 'helper-clerk-2', name: 'Helper Two' },
      isAccepted: false,
      deletedAt: null,
    };

    prisma.user.findUnique.mockResolvedValue(mockUser);
    prisma.doubt.findUnique.mockResolvedValue(activeDoubt);
    prisma.doubtAnswer.findFirst
      .mockResolvedValueOnce(answerRecord) // outer answer lookup
      .mockResolvedValueOnce(null);        // inner existingAccepted check before race
    prisma.doubt.updateMany.mockResolvedValueOnce({ count: 0 });
    mockAwardForumAnswer.mockClear();

    const res = await request(app)
      .post(`/api/doubt/${activeDoubt.id}/accept-answer`)
      .set('Authorization', 'Bearer valid-test-token')
      .send({ answerId: 'ans-2' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(prisma.doubt.updateMany).toHaveBeenCalledWith({
      where: { id: activeDoubt.id, status: { not: 'CLOSED' }, deletedAt: null },
      data: { status: 'CLOSED' },
    });
    expect(mockAwardForumAnswer).not.toHaveBeenCalled();
  });
});
