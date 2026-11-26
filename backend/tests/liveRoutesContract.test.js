jest.mock('@clerk/express', () => ({
  verifyToken: jest.fn(),
  createClerkClient: jest.fn(() => ({
    users: {
      getUser: jest.fn().mockResolvedValue({
        id: 'user_brand_new_test_123',
        firstName: 'Brand',
        lastName: 'New',
        username: 'brandnew',
        imageUrl: 'https://example.com/avatar.png',
        primaryEmailAddressId: 'email-1',
        emailAddresses: [{ id: 'email-1', emailAddress: 'brand_new_test@mirai.edu' }],
      }),
    },
  })),
  clerkClient: {
    users: {
      getUser: jest.fn().mockResolvedValue({
        id: 'user_brand_new_test_123',
        firstName: 'Brand',
        lastName: 'New',
        username: 'brandnew',
        imageUrl: 'https://example.com/avatar.png',
        primaryEmailAddressId: 'email-1',
        emailAddresses: [{ id: 'email-1', emailAddress: 'brand_new_test@mirai.edu' }],
      }),
    },
  },
}));

jest.mock('../src/config/redis', () => ({
  getRedisClients: jest.fn(() => ({
    base: { on: jest.fn(), quit: jest.fn().mockResolvedValue(), disconnect: jest.fn(), ping: jest.fn().mockResolvedValue('PONG') },
    publisher: { on: jest.fn(), quit: jest.fn().mockResolvedValue(), disconnect: jest.fn() },
    subscriber: { on: jest.fn(), quit: jest.fn().mockResolvedValue(), disconnect: jest.fn() },
  })),
  closeRedis: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/config/socket', () => ({
  initSocketServer: jest.fn(),
  closeSocketServer: jest.fn().mockResolvedValue(),
  emitToUser: jest.fn(),
  emitToThread: jest.fn(),
  broadcastToThread: jest.fn(),
}));

jest.mock('../src/workers/chatPersistenceWorker', () => ({
  startChatPersistenceWorker: jest.fn(),
  closeChatPersistenceWorker: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/queues/chatPersistenceQueue', () => ({
  enqueueChatMessage: jest.fn().mockResolvedValue('job-123'),
  getChatPersistenceQueue: jest.fn(),
}));

jest.mock('../src/services/matchingCache', () => ({
  getCachedFeed: jest.fn().mockResolvedValue(null),
  setCachedFeed: jest.fn().mockResolvedValue(),
  invalidateMatchingFeeds: jest.fn().mockResolvedValue(),
}));

// In-memory state for the unseeded new user
const brandNewClerkId = 'user_brand_new_test_123';
const internalDbId = '11111111-2222-4333-8444-555555555555';

let inMemoryUser = null; // NOT pre-inserted in DB!

const mockTx = {
  college: {
    upsert: jest.fn().mockResolvedValue({
      id: 'col-1',
      name: 'Mirai School of Technology',
      location: 'Bengaluru, India',
    }),
  },
  department: {
    upsert: jest.fn().mockResolvedValue({
      id: 'dept-1',
      name: 'CSE (AI/ML)',
    }),
  },
  skill: {
    upsert: jest.fn().mockImplementation(async ({ where, create }) => ({
      id: `skill-${where.name}`,
      name: create.name,
    })),
  },
  userSkill: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  },
  user: {
    findFirst: jest.fn().mockImplementation(async ({ where = {} } = {}) => {
      if (!inMemoryUser) return null;
      if (where.clerkUserId && where.clerkUserId === inMemoryUser.clerkUserId) return inMemoryUser;
      if (where.id && where.id === inMemoryUser.id) return inMemoryUser;
      if (Array.isArray(where.OR)) {
        const matched = where.OR.some((cond) => {
          if (cond.clerkUserId && cond.clerkUserId === inMemoryUser.clerkUserId) return true;
          if (cond.id && cond.id === inMemoryUser.id) return true;
          return false;
        });
        if (matched) return inMemoryUser;
      }
      return null;
    }),
    findUnique: jest.fn().mockImplementation(async () => inMemoryUser),
    create: jest.fn().mockImplementation(async ({ data }) => {
      inMemoryUser = {
        id: internalDbId,
        clerkUserId: data.clerkUserId,
        name: data.name || 'Brand New User',
        email: data.email || `${brandNewClerkId}@clerk.internal`,
        photoUrl: data.photoUrl || '',
        profileComplete: Boolean(data.profileComplete),
        collegeId: data.collegeId || null,
        collegeLocation: data.collegeLocation || '',
        departmentId: data.departmentId || null,
        year: data.year || '',
        latitude: data.latitude || 0,
        longitude: data.longitude || 0,
        deletedAt: null,
        mindTokens: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalSessions: 0,
        averageRating: 0,
        college: data.collegeId ? { name: 'Mirai School of Technology', location: 'Bengaluru, India' } : null,
        department: data.departmentId ? { name: 'CSE (AI/ML)' } : null,
        skills: [],
        updatedAt: new Date(),
        createdAt: new Date(),
      };
      return inMemoryUser;
    }),
    update: jest.fn().mockImplementation(async ({ data }) => {
      inMemoryUser = {
        ...(inMemoryUser || {}),
        ...data,
        updatedAt: new Date(),
      };
      return inMemoryUser;
    }),
  },
  tokenTransaction: {
    create: jest.fn().mockResolvedValue({ id: 'tx-1', amount: 5 }),
  },
  activityDay: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({ activityDate: new Date(), activityTypes: ['daily_login'] }),
  },
};

const mockPrisma = {
  user: {
    findUnique: jest.fn().mockImplementation(async ({ where }) => {
      if (!inMemoryUser) return null;
      if (where.clerkUserId && where.clerkUserId === inMemoryUser.clerkUserId) {
        return inMemoryUser;
      }
      if (where.id && where.id === inMemoryUser.id) {
        return inMemoryUser;
      }
      return null;
    }),
    findFirst: jest.fn().mockImplementation(async ({ where = {} } = {}) => {
      if (!inMemoryUser) return null;
      if (where.clerkUserId && where.clerkUserId === inMemoryUser.clerkUserId) {
        return inMemoryUser;
      }
      if (where.id && where.id === inMemoryUser.id) {
        return inMemoryUser;
      }
      if (where.email && where.email === inMemoryUser.email) {
        return inMemoryUser;
      }
      if (Array.isArray(where.OR)) {
        const matched = where.OR.some((cond) => {
          if (cond.clerkUserId && cond.clerkUserId === inMemoryUser.clerkUserId) return true;
          if (cond.id && cond.id === inMemoryUser.id) return true;
          if (cond.email && cond.email === inMemoryUser.email) return true;
          return false;
        });
        if (matched) return inMemoryUser;
      }
      return null;
    }),
    findMany: jest.fn().mockImplementation(async () => {
      return inMemoryUser ? [inMemoryUser] : [];
    }),
    create: jest.fn().mockImplementation(async ({ data }) => {
      inMemoryUser = {
        id: internalDbId,
        clerkUserId: data.clerkUserId,
        name: data.name || 'Brand New User',
        email: data.email || `${brandNewClerkId}@clerk.internal`,
        photoUrl: data.photoUrl || '',
        profileComplete: Boolean(data.profileComplete),
        deletedAt: null,
        mindTokens: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalSessions: 0,
        averageRating: 0,
        college: null,
        department: null,
        skills: [],
        updatedAt: new Date(),
        createdAt: new Date(),
      };
      return inMemoryUser;
    }),
    update: jest.fn().mockImplementation(async ({ data }) => {
      inMemoryUser = {
        ...(inMemoryUser || {}),
        ...data,
        updatedAt: new Date(),
      };
      return inMemoryUser;
    }),
    upsert: jest.fn().mockImplementation(async ({ where, create, update }) => {
      if (!inMemoryUser) {
        inMemoryUser = {
          id: internalDbId,
          clerkUserId: where.clerkUserId || brandNewClerkId,
          name: create.name || 'Brand New User',
          email: create.email || `${brandNewClerkId}@clerk.internal`,
          photoUrl: create.photoUrl || '',
          profileComplete: Boolean(create.profileComplete),
          deletedAt: null,
          mindTokens: 0,
          currentStreak: 0,
          longestStreak: 0,
          totalSessions: 0,
          averageRating: 0,
          college: null,
          department: null,
          skills: [],
          updatedAt: new Date(),
          createdAt: new Date(),
        };
      } else {
        inMemoryUser = {
          ...inMemoryUser,
          ...update,
          updatedAt: new Date(),
        };
      }
      return inMemoryUser;
    }),
  },
  college: {
    findMany: jest.fn().mockResolvedValue([{ name: 'Mirai School of Technology' }]),
    upsert: jest.fn().mockResolvedValue({ id: 'col-1', name: 'Mirai School of Technology' }),
  },
  department: {
    findMany: jest.fn().mockResolvedValue([{ name: 'CSE (AI/ML)' }]),
    upsert: jest.fn().mockResolvedValue({ id: 'dept-1', name: 'CSE (AI/ML)' }),
  },
  skill: {
    findMany: jest.fn().mockResolvedValue([{ name: 'Web Dev' }, { name: 'DSA' }]),
    upsert: jest.fn().mockResolvedValue({ id: 's-1', name: 'Web Dev' }),
  },
  userSkill: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
  },
  activityDay: {
    findUnique: jest.fn().mockResolvedValue(null),
    upsert: jest.fn().mockResolvedValue({ activityDate: new Date(), activityTypes: ['app_open'] }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  userBadge: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  doubtAnswer: {
    count: jest.fn().mockResolvedValue(0),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
  },
  doubt: {
    findMany: jest.fn().mockResolvedValue([]),
    groupBy: jest.fn().mockResolvedValue([
      { primaryTag: 'Web Dev', _count: { id: 5 } },
      { primaryTag: 'DSA', _count: { id: 3 } },
    ]),
  },
  tutoringSession: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
  },
  matchRequest: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'mr-1', status: 'PENDING' }),
  },
  chatParticipant: {
    findMany: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
  },
  chatMessage: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  tokenTransaction: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'tx-1', amount: 5 }),
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  },
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  $transaction: jest.fn(async (cb) => {
    if (typeof cb === 'function') {
      return cb(mockTx);
    }
    return Promise.all(cb);
  }),
  disconnectPrisma: jest.fn().mockResolvedValue(),
};

jest.mock('../src/config/prisma', () => ({
  prisma: mockPrisma,
  disconnectPrisma: jest.fn().mockResolvedValue(),
}));

const express = require('express');
const request = require('supertest');
const { verifyToken } = require('@clerk/express');
const userRoutes = require('../src/routes/user');
const matchRoutes = require('../src/routes/match');
const gamificationRoutes = require('../src/routes/gamification');
const chatRoutes = require('../src/routes/chat');
const sessionRoutes = require('../src/routes/session');
const doubtRoutes = require('../src/routes/doubt');
const { globalErrorHandler } = require('../src/middleware/errorHandler');

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/user', userRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api', gamificationRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/doubt', doubtRoutes);
app.use('/api/doubts', doubtRoutes);
app.use(globalErrorHandler);

describe('Live Routes Contract Suite (Zero 404s for New Unseeded Clerk User)', () => {
  const token = 'Bearer mock_valid_clerk_jwt';

  beforeEach(() => {
    verifyToken.mockResolvedValue({
      sub: brandNewClerkId,
      email: 'brand_new_test@mirai.edu',
      name: 'Brand New User',
    });
  });

  // Verify initial state: user NOT pre-inserted
  it('starts with no pre-existing user in DB', () => {
    expect(inMemoryUser).toBeNull();
  });

  // Route 1: POST /api/user/register
  it('1. POST /api/user/register succeeds (200/201) and completes onboarding', async () => {
    const res = await request(app)
      .post('/api/user/register')
      .set('Authorization', token)
      .send({
        name: 'Brand New User',
        college: 'Mirai School of Technology',
        collegeLocation: 'Bengaluru, India',
        department: 'CSE (AI/ML)',
        year: '3',
        teaches: ['Web Dev', 'DSA'],
        learns: ['Machine Learning'],
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(inMemoryUser).not.toBeNull();
    expect(inMemoryUser.clerkUserId).toBe(brandNewClerkId);
  });

  // Route 2: GET /api/user/metadata/options
  it('2. GET /api/user/metadata/options returns 200 with options lists', async () => {
    const res = await request(app).get('/api/user/metadata/options');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.colleges)).toBe(true);
    expect(Array.isArray(res.body.data.departments)).toBe(true);
  });

  // Route 3: GET /api/user/:id (tested with clerkId)
  it('3. GET /api/user/:id returns 200 for newly registered user', async () => {
    const res = await request(app)
      .get(`/api/user/${brandNewClerkId}`)
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uid).toBe(brandNewClerkId);
  });

  // Route 4: GET /api/user/:id/profile
  it('4. GET /api/user/:id/profile returns 200 with full stats', async () => {
    const res = await request(app)
      .get(`/api/user/${brandNewClerkId}/profile`)
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.profileComplete).toBe(true);
    expect(res.body.data.stats).toBeDefined();
  });

  // Route 5: GET /api/user/:id/following
  it('5. GET /api/user/:id/following returns 200 with empty list', async () => {
    const res = await request(app)
      .get(`/api/user/${brandNewClerkId}/following`)
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  // Route 6: GET /api/streak/:id
  it('6. GET /api/streak/:id returns 200 with streak info', async () => {
    const res = await request(app)
      .get(`/api/streak/${brandNewClerkId}`)
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentStreak).toBeDefined();
  });

  // Route 7: POST /api/streak/checkin
  it('7. POST /api/streak/checkin returns 200 and logs daily check-in', async () => {
    const res = await request(app)
      .post('/api/streak/checkin')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.alreadyCheckedIn).toBeDefined();
  });

  // Route 8: GET /api/badges/:id
  it('8. GET /api/badges/:id returns 200 with badges list', async () => {
    const res = await request(app)
      .get(`/api/badges/${brandNewClerkId}`)
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.badges)).toBe(true);
  });

  // Route 9: GET /api/leaderboard
  it('9. GET /api/leaderboard returns 200 with leaderboard data', async () => {
    const res = await request(app)
      .get('/api/leaderboard')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.leaderboard)).toBe(true);
  });

  // Route 10: GET /api/doubt
  it('10. GET /api/doubt returns 200 with doubt feed', async () => {
    const res = await request(app)
      .get('/api/doubt')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // Route 11: GET /api/doubt/trending
  it('11. GET /api/doubt/trending returns 200 with trending tags', async () => {
    const res = await request(app).get('/api/doubt/trending');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // Route 12: GET /api/match/:id
  it('12. GET /api/match/:id returns 200 with empty matches array for brand new user', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([]);

    const res = await request(app)
      .get(`/api/match/${brandNewClerkId}`)
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // Route 13: GET /api/session/user/:id (supports ?status=upcoming)
  it('13. GET /api/session/user/:id?status=upcoming returns 200 with empty sessions array', async () => {
    const res = await request(app)
      .get(`/api/session/user/${brandNewClerkId}?status=upcoming`)
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  // Route 14: GET /api/chat/threads/:id
  it('14. GET /api/chat/threads/:id returns 200 with empty threads array', async () => {
    const res = await request(app)
      .get(`/api/chat/threads/${brandNewClerkId}`)
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toEqual([]);
  });

  // Route 15: GET /api/match/requests/:id
  it('15. GET /api/match/requests/:id returns 200 with empty match requests array', async () => {
    const res = await request(app)
      .get(`/api/match/requests/${brandNewClerkId}`)
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toEqual([]);
  });
});
