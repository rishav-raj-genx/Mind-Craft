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

const mockTx = {
  college: {
    upsert: jest.fn(),
  },
  department: {
    upsert: jest.fn(),
  },
  skill: {
    upsert: jest.fn(),
  },
  userSkill: {
    deleteMany: jest.fn(),
    upsert: jest.fn(),
  },
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  college: {
    upsert: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  department: {
    upsert: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  skill: {
    upsert: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  userSkill: {
    deleteMany: jest.fn(),
    upsert: jest.fn(),
  },
  chatParticipant: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
  },
  chatMessage: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  chatThread: {
    findUnique: jest.fn(),
  },
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
const chatRoutes = require('../src/routes/chat');
const { globalErrorHandler } = require('../src/middleware/errorHandler');

describe('Onboarding and Chat Regression Tests', () => {
  let app;
  const newClerkId = 'user_3MbMz9999999999';
  const newDbUser = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    clerkUserId: newClerkId,
    email: 'newuser@mirai.edu',
    name: 'New Student',
    photoUrl: 'https://example.com/avatar.png',
    deletedAt: null,
    profileComplete: false,
    mindTokens: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalSessions: 0,
    averageRating: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/user', userRoutes);
    app.use('/api/chat', chatRoutes);
    app.use(globalErrorHandler);

    verifyToken.mockResolvedValue({
      sub: newClerkId,
      email: 'newuser@mirai.edu',
      name: 'New Student',
    });
  });

  describe('POST /api/user/register', () => {
    it('successfully registers and completes profile with custom college, department, and skills', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(newDbUser);
      mockTx.college.upsert.mockResolvedValue({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        name: 'Mirai School of Technology',
        location: 'Bengaluru, India',
      });
      mockTx.department.upsert.mockResolvedValue({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        name: 'CSE (AI/ML)',
      });
      mockTx.user.findFirst.mockResolvedValue(newDbUser);

      const registeredUserRecord = {
        ...newDbUser,
        name: 'Jane Doe',
        profileComplete: true,
        collegeId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        collegeLocation: 'Bengaluru, India',
        departmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        year: '3',
        college: { name: 'Mirai School of Technology', location: 'Bengaluru, India' },
        department: { name: 'CSE (AI/ML)' },
      };

      mockTx.user.update.mockResolvedValue(registeredUserRecord);
      mockTx.skill.upsert
        .mockResolvedValueOnce({ id: 's1', name: 'Web Dev' })
        .mockResolvedValueOnce({ id: 's2', name: 'DSA' })
        .mockResolvedValueOnce({ id: 's3', name: 'System Design' });
      mockTx.userSkill.upsert.mockResolvedValue({});

      mockPrisma.user.findFirst.mockResolvedValue({
        ...registeredUserRecord,
        skills: [
          { kind: 'TEACHES', skill: { name: 'Web Dev' } },
          { kind: 'TEACHES', skill: { name: 'DSA' } },
          { kind: 'LEARNS', skill: { name: 'System Design' } },
        ],
      });

      const res = await request(app)
        .post('/api/user/register')
        .set('Authorization', 'Bearer valid_clerk_token')
        .send({
          name: 'Jane Doe',
          college: 'Mirai School of Technology',
          collegeLocation: 'Bengaluru, India',
          department: 'CSE (AI/ML)',
          year: '3',
          teaches: ['Web Dev', 'DSA'],
          learns: ['System Design'],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profileComplete).toBe(true);
      expect(res.body.data.college).toBe('Mirai School of Technology');
      expect(res.body.data.department).toBe('CSE (AI/ML)');
      expect(res.body.data.teaches).toEqual(['Web Dev', 'DSA']);
      expect(res.body.data.learns).toEqual(['System Design']);
      expect(mockTx.college.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'Mirai School of Technology' },
        }),
      );
      expect(mockTx.department.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'CSE (AI/ML)' },
        }),
      );
    });

    it('auto-provisions user in PostgreSQL if missing when requireAuth runs', async () => {
      // First findUnique in requireAuth returns null
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      // Auto-provision user creation in userResolver
      mockPrisma.user.create.mockResolvedValueOnce({
        ...newDbUser,
        profileComplete: false,
      });

      mockTx.college.upsert.mockResolvedValue({ id: 'c1', name: 'MIT' });
      mockTx.department.upsert.mockResolvedValue({ id: 'd1', name: 'CS' });
      mockTx.user.findFirst.mockResolvedValue(newDbUser);
      mockTx.user.update.mockResolvedValue({
        ...newDbUser,
        name: 'Auto Provisioned',
        profileComplete: true,
      });
      mockTx.user.findUnique.mockResolvedValue({
        ...newDbUser,
        name: 'Auto Provisioned',
        profileComplete: true,
        skills: [],
      });

      const res = await request(app)
        .post('/api/user/register')
        .set('Authorization', 'Bearer valid_clerk_token')
        .send({
          name: 'Auto Provisioned',
          college: 'MIT',
          department: 'CS',
          teaches: [],
          learns: [],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.profileComplete).toBe(true);
    });
  });

  describe('GET /api/chat/threads/:userId resolution & empty-state', () => {
    it('returns 200 with [] when new user queries threads by clerkUserId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(newDbUser);
      mockPrisma.user.findFirst.mockResolvedValue(newDbUser);
      mockPrisma.chatParticipant.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/chat/threads/${newClerkId}`)
        .set('Authorization', 'Bearer valid_clerk_token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('returns 200 with [] when new user queries root GET /api/chat/threads', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(newDbUser);
      mockPrisma.user.findFirst.mockResolvedValue(newDbUser);
      mockPrisma.chatParticipant.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/chat/threads')
        .set('Authorization', 'Bearer valid_clerk_token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
    });

    it('rejects with 403 when user attempts to access another users thread list', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(newDbUser);
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        clerkUserId: 'user_other_student_999',
      });

      const res = await request(app)
        .get('/api/chat/threads/user_other_student_999')
        .set('Authorization', 'Bearer valid_clerk_token');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Cannot fetch another user's chat threads");
    });
  });
});
