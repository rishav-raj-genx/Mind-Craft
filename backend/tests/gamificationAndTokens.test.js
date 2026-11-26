jest.mock('../src/config/prisma', () => {
  const tutoringSessionMock = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const mockTx = {
    user: {
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
    tokenTransaction: {
      create: jest.fn(),
    },
    activityDay: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    tutoringSession: tutoringSessionMock,
  };
  return {
    prisma: {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      tokenTransaction: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      activityDay: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      tutoringSession: tutoringSessionMock,
      doubtAnswer: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      userBadge: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      badge: {
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (cb) => {
        if (typeof cb === 'function') {
          return cb(mockTx);
        }
        return Promise.all(cb);
      }),
      _mockTx: mockTx,
    },
  };
});

jest.mock('../src/middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      clerkUserId: 'clerk-user-1',
    };
    next();
  },
  optionalAuth: (req, _res, next) => {
    req.user = {
      id: '00000000-0000-0000-0000-000000000001',
      clerkUserId: 'clerk-user-1',
    };
    next();
  },
}));

jest.mock('../src/services/chatService', () => ({
  broadcastToGlobal: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { prisma } = require('../src/config/prisma');
const tokenEconomy = require('../src/services/tokenEconomy');
const streakService = require('../src/services/streakService');
const gamificationRouter = require('../src/routes/gamification');
const sessionRouter = require('../src/routes/session');

describe('Token Economy & Gamification Security', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api', gamificationRouter);
    app.use('/api/session', sessionRouter);
  });

  describe('tokenEconomy service', () => {
    it('awards tokens with idempotency key inside atomic transaction', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        clerkUserId: 'clerk-user-1',
        mindTokens: 50,
      });
      prisma.tokenTransaction.findFirst.mockResolvedValue(null);

      prisma._mockTx.tokenTransaction.create.mockResolvedValue({ id: 'tx-123' });
      prisma._mockTx.user.update.mockResolvedValue({ mindTokens: 60 });
      prisma._mockTx.activityDay.findUnique.mockResolvedValue(null);
      prisma._mockTx.activityDay.upsert.mockResolvedValue({});

      const result = await tokenEconomy.awardTokens('clerk-user-1', 10, 'daily_login', {
        idempotencyKey: 'checkin_001_2026-11-25',
      });

      expect(result.alreadyAwarded).toBe(false);
      expect(result.newBalance).toBe(60);
      expect(prisma._mockTx.tokenTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: '00000000-0000-0000-0000-000000000001',
            amount: 10,
            type: 'CREDIT',
            idempotencyKey: 'checkin_001_2026-11-25',
          }),
        }),
      );
    });

    it('returns existing balance when idempotency key already exists', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        clerkUserId: 'clerk-user-1',
        mindTokens: 50,
      });
      prisma.tokenTransaction.findFirst.mockResolvedValue({ id: 'tx-existing' });

      const result = await tokenEconomy.awardTokens('clerk-user-1', 10, 'daily_login', {
        idempotencyKey: 'checkin_001_2026-11-25',
      });

      expect(result.alreadyAwarded).toBe(true);
      expect(result.newBalance).toBe(50);
      expect(result.transactionId).toBe('tx-existing');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('deductTokens prevents overdrafts via conditional update', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        clerkUserId: 'clerk-user-1',
        mindTokens: 50,
      });
      prisma.tokenTransaction.findFirst.mockResolvedValue(null);

      // Successful deduction
      prisma._mockTx.user.updateMany.mockResolvedValue({ count: 1 });
      prisma._mockTx.user.findUnique.mockResolvedValue({ mindTokens: 30 });
      prisma._mockTx.tokenTransaction.create.mockResolvedValue({ id: 'tx-debit-1' });

      const result = await tokenEconomy.deductTokens('clerk-user-1', 20, 'purchase_item');
      expect(result.newBalance).toBe(30);
      expect(prisma._mockTx.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: '00000000-0000-0000-0000-000000000001',
          mindTokens: { gte: 20 },
        },
        data: {
          mindTokens: { decrement: 20 },
        },
      });

      // Failed deduction when balance is insufficient
      prisma._mockTx.user.updateMany.mockResolvedValue({ count: 0 });
      await expect(
        tokenEconomy.deductTokens('clerk-user-1', 100, 'purchase_item'),
      ).rejects.toThrow('Insufficient token balance');
    });

    it('awardStreakBonus generates deterministic idempotency key', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        clerkUserId: 'clerk-user-1',
        mindTokens: 50,
      });
      prisma.tokenTransaction.findFirst.mockResolvedValue(null);
      prisma._mockTx.tokenTransaction.create.mockResolvedValue({ id: 'tx-streak-5' });
      prisma._mockTx.user.update.mockResolvedValue({ mindTokens: 75 });
      prisma._mockTx.activityDay.findUnique.mockResolvedValue(null);
      prisma._mockTx.activityDay.upsert.mockResolvedValue({});

      const result = await tokenEconomy.awardStreakBonus('clerk-user-1', 5);
      expect(result.alreadyAwarded).toBe(false);
      expect(prisma._mockTx.tokenTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: '5_day_streak',
            idempotencyKey: expect.stringMatching(/^streak_5_\d{4}-\d{2}-\d{2}$/),
          }),
        }),
      );
    });
  });

  describe('streakService freeze shield consumption and 90-day floor removal', () => {
    it('consumes freeze shield only when active on N-2, inactive on N-1, and shields > 0', () => {
      const now = new Date('2026-11-25T12:00:00Z');
      const today = streakService.toDateString(now);
      const yesterday = streakService.toDateString(new Date(now.getTime() - 86400000));
      const dayBeforeYesterday = streakService.toDateString(new Date(now.getTime() - 2 * 86400000));
      const threeDaysAgo = streakService.toDateString(new Date(now.getTime() - 3 * 86400000));

      // Case 1: Active N-2, inactive N-1, active today, 2 shields -> consumes 1 shield, streak preserved
      const set1 = new Set([threeDaysAgo, dayBeforeYesterday, today]);
      const res1 = streakService.computeCurrentStreakWithShields(set1, now, 2);
      expect(res1.streakFreezes).toBe(1);
      expect(res1.currentStreak).toBe(3); // today + bridged yesterday + N-2 & threeDaysAgo

      // Case 2: Continuous dormancy (inactive N-2 and N-1), active today, 2 shields -> does NOT consume shield
      const set2 = new Set([today]);
      const res2 = streakService.computeCurrentStreakWithShields(set2, now, 2);
      expect(res2.streakFreezes).toBe(2); // Shield preserved!
      expect(res2.currentStreak).toBe(1); // Fresh start

      // Case 3: Continuous dormancy, inactive today as well, 2 shields -> does NOT consume shield
      const set3 = new Set([threeDaysAgo]);
      const res3 = streakService.computeCurrentStreakWithShields(set3, now, 2);
      expect(res3.streakFreezes).toBe(2); // Shield preserved!
      expect(res3.currentStreak).toBe(0); // Streak is 0
    });

    it('calculates streak across full history without 90-day reset floor', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        clerkUserId: 'clerk-user-1',
      });

      // 105 consecutive days of activity
      const baseDate = new Date('2026-11-25T12:00:00Z');
      const mockRows = [];
      for (let i = 104; i >= 0; i--) {
        const d = new Date(baseDate.getTime() - i * 86400000);
        mockRows.push({ activityDate: d });
      }

      prisma.activityDay.findMany.mockResolvedValue(mockRows);
      prisma.user.update.mockResolvedValue({});

      const streak = await streakService.calculateStreak('clerk-user-1');
      expect(streak.longestStreak).toBe(105);
      expect(streak.currentStreak).toBe(105);
      expect(streak.totalActiveDays).toBe(105);
      // Century legend badge earned!
      const centuryBadge = streak.badges.earned.find((b) => b.name === 'Century Legend');
      expect(centuryBadge).toBeDefined();
    });
  });

  describe('Gamification Routes Authorization and Idempotency', () => {
    it('POST /api/tokens/award/session rejects non-participant callers with 403', async () => {
      prisma.tutoringSession.findUnique.mockResolvedValue({
        id: 'session-abc',
        status: 'COMPLETED',
        teacherId: 'teacher-uuid',
        teacher: { clerkUserId: 'clerk-teacher' },
        learnerId: 'learner-uuid',
        learner: { clerkUserId: 'clerk-learner' },
      });

      // Caller is clerk-user-1 (neither teacher nor learner)
      const res = await request(app)
        .post('/api/tokens/award/session')
        .send({
          sessionId: 'session-abc',
          teacherUid: 'clerk-teacher',
          learnerUid: 'clerk-learner',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/tokens/award/session rejects non-completed sessions with 403', async () => {
      prisma.tutoringSession.findUnique.mockResolvedValue({
        id: 'session-abc',
        status: 'UPCOMING',
        teacherId: '00000000-0000-0000-0000-000000000001',
        teacher: { clerkUserId: 'clerk-user-1' },
        learnerId: 'learner-uuid',
        learner: { clerkUserId: 'clerk-learner' },
      });

      const res = await request(app)
        .post('/api/tokens/award/session')
        .send({
          sessionId: 'session-abc',
          teacherUid: 'clerk-user-1',
          learnerUid: 'clerk-learner',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/tokens/award/forum rejects when caller is not author of accepted answer with 403', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        clerkUserId: 'clerk-user-1',
      });
      // No accepted answer for this question by this user
      prisma.doubtAnswer.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/tokens/award/forum')
        .send({
          doubtId: 'doubt-xyz',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/badges/:uid is pure read-only and does not mutate database', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        clerkUserId: 'clerk-user-1',
        currentStreak: 5,
        longestStreak: 10,
        mindTokens: 100,
        averageRating: 5.0,
      });
      prisma.tutoringSession.findMany.mockResolvedValue([]);
      prisma.doubtAnswer.count.mockResolvedValue(0);
      prisma.activityDay.findMany.mockResolvedValue([]);
      prisma.userBadge.findMany.mockResolvedValue([
        {
          badgeId: 'spark_starter',
          auditWeek: '2026-W47',
          awardedAt: new Date('2026-11-20T00:00:00Z'),
          badge: { name: 'Spark Starter', level: 1 },
        },
      ]);

      const res = await request(app).get('/api/badges/clerk-user-1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.badgeHistory).toHaveLength(1);
      // Ensure no mutations occurred: no token awards, no userBadge upserts
      expect(prisma.userBadge.upsert).not.toHaveBeenCalled();
      expect(prisma.badge.upsert).not.toHaveBeenCalled();
      expect(prisma._mockTx.user.update).not.toHaveBeenCalled();
    });

    it('POST /api/streak/check-in is idempotent and does not re-mint tokens if already checked in', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        clerkUserId: 'clerk-user-1',
      });
      const todayStr = streakService.toDateString(new Date());
      // Already checked in today
      prisma.activityDay.findUnique.mockResolvedValue({
        activityTypes: ['app_open'],
      });
      prisma.activityDay.findMany.mockResolvedValue([
        { activityDate: new Date(`${todayStr}T00:00:00Z`) },
      ]);
      prisma.activityDay.upsert.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      const res = await request(app).post('/api/streak/checkin');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alreadyCheckedIn).toBe(true);
      expect(res.body.data.loginTokens).toBeNull();
      expect(res.body.data.streakBonus).toBeNull();
    });
  });

  describe('Session GET and Complete routes', () => {
    it('GET /api/session/:uid does not auto-complete past sessions or award tokens on read', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        clerkUserId: 'clerk-user-1',
      });
      // Past session scheduled 2 hours ago
      const pastTime = new Date(Date.now() - 2 * 3600000);
      prisma.tutoringSession.findMany.mockResolvedValue([
        {
          id: 'session-past',
          teacherId: '00000000-0000-0000-0000-000000000001',
          learnerId: 'learner-uuid',
          scheduledFor: pastTime,
          status: 'UPCOMING',
          mode: 'ONLINE',
          teacher: { id: '00000000-0000-0000-0000-000000000001', clerkUserId: 'clerk-user-1', name: 'Teacher' },
          learner: { id: 'learner-uuid', clerkUserId: 'clerk-learner', name: 'Learner' },
        },
      ]);

      const res = await request(app).get('/api/session/clerk-user-1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].status).toBe('UPCOMING');
      // Verify no mutation occurred on GET
      expect(prisma.tutoringSession.update).not.toHaveBeenCalled();
    });

    it('POST /api/session/:id/complete explicitly completes session for participant', async () => {
      prisma.tutoringSession.findUnique.mockResolvedValue({
        id: 'session-past',
        teacherId: '00000000-0000-0000-0000-000000000001',
        learnerId: 'learner-uuid',
        status: 'UPCOMING',
        teacher: { id: '00000000-0000-0000-0000-000000000001', clerkUserId: 'clerk-user-1', name: 'Teacher' },
        learner: { id: 'learner-uuid', clerkUserId: 'clerk-learner', name: 'Learner' },
      });
      prisma.tutoringSession.update.mockResolvedValue({ id: 'session-past', status: 'COMPLETED' });
      prisma.user.findFirst.mockResolvedValue({ id: 'learner-uuid', clerkUserId: 'clerk-learner' });

      const res = await request(app).post('/api/session/session-past/complete');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
