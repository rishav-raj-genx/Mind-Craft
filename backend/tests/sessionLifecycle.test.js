jest.mock('@clerk/express', () => ({
  verifyToken: jest.fn(),
}));

const mockState = {
  users: {},
  sessions: [],
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(async ({ where }) => {
      if (where?.clerkUserId) {
        return Object.values(mockState.users).find((u) => u.clerkUserId === where.clerkUserId) || null;
      }
      if (where?.id) {
        return mockState.users[where.id] || null;
      }
      return null;
    }),
    findFirst: jest.fn(async ({ where = {} }) => {
      const all = Object.values(mockState.users);
      if (where.clerkUserId) return all.find((u) => u.clerkUserId === where.clerkUserId) || null;
      if (where.id) return all.find((u) => u.id === where.id) || null;
      if (Array.isArray(where.OR)) {
        return all.find((u) => where.OR.some((c) => (c.clerkUserId && c.clerkUserId === u.clerkUserId) || (c.id && c.id === u.id))) || null;
      }
      return null;
    }),
    update: jest.fn(async ({ where, data }) => {
      const existing = mockState.users[where.id];
      if (!existing) throw new Error('User not found');
      mockState.users[where.id] = { ...existing, ...data };
      return mockState.users[where.id];
    }),
  },
  tutoringSession: {
    findUnique: jest.fn(async ({ where }) => {
      const found = mockState.sessions.find((s) => s.id === where.id);
      if (!found) return null;
      return {
        ...found,
        teacher: mockState.users[found.teacherId] || found.teacher,
        learner: mockState.users[found.learnerId] || found.learner,
      };
    }),
    findFirst: jest.fn(async ({ where = {} }) => {
      return mockState.sessions.find((s) => {
        if (where.id?.not && s.id === where.id.not) return false;
        if (where.status?.in && !where.status.in.includes(s.status)) return false;
        if (Array.isArray(where.OR)) {
          const participantMatch = where.OR.some((clause) => (
            (clause.teacherId && s.teacherId === clause.teacherId)
            || (clause.learnerId && s.learnerId === clause.learnerId)
          ));
          if (!participantMatch) return false;
        }
        if (where.scheduledFor && s.scheduledFor) {
          const ts = new Date(s.scheduledFor).getTime();
          if (where.scheduledFor.gt && !(ts > new Date(where.scheduledFor.gt).getTime())) return false;
          if (where.scheduledFor.lt && !(ts < new Date(where.scheduledFor.lt).getTime())) return false;
        }
        return true;
      }) || null;
    }),
    findMany: jest.fn(async ({ where = {} }) => {
      return mockState.sessions.filter((s) => {
        if (where.status && s.status !== where.status) return false;
        if (where.completionKey?.not === null && !s.completionKey) return false;
        if (Array.isArray(where.OR)) {
          return where.OR.some((c) => (c.teacherId && s.teacherId === c.teacherId) || (c.learnerId && s.learnerId === c.learnerId));
        }
        return true;
      }).map((s) => ({
        ...s,
        teacher: mockState.users[s.teacherId],
        learner: mockState.users[s.learnerId],
      }));
    }),
    create: jest.fn(async ({ data }) => {
      const created = {
        id: `session-${mockState.sessions.length + 1}`,
        ...data,
        createdAt: new Date(),
      };
      mockState.sessions.push(created);
      return {
        ...created,
        teacher: mockState.users[created.teacherId],
        learner: mockState.users[created.learnerId],
      };
    }),
    update: jest.fn(async ({ where, data }) => {
      const idx = mockState.sessions.findIndex((s) => s.id === where.id);
      if (idx === -1) throw new Error('Session not found');
      mockState.sessions[idx] = { ...mockState.sessions[idx], ...data };
      return {
        ...mockState.sessions[idx],
        teacher: mockState.users[mockState.sessions[idx].teacherId],
        learner: mockState.users[mockState.sessions[idx].learnerId],
      };
    }),
    count: jest.fn(async ({ where = {} }) => {
      return mockState.sessions.filter((s) => {
        if (where.status && s.status !== where.status) return false;
        if (where.teacherId && s.teacherId !== where.teacherId) return false;
        if (where.learnerId && s.learnerId !== where.learnerId) return false;
        if (Array.isArray(where.OR)) {
          const match = where.OR.some((c) => (c.teacherId && s.teacherId === c.teacherId) || (c.learnerId && s.learnerId === c.learnerId));
          if (!match) return false;
        }
        if (where.completionKey?.contains) {
          if (!s.completionKey || !s.completionKey.includes(where.completionKey.contains)) return false;
        }
        return true;
      }).length;
    }),
    aggregate: jest.fn(async ({ where = {} }) => {
      const matching = mockState.sessions.filter((s) => {
        if (where.status && s.status !== where.status) return false;
        if (Array.isArray(where.OR)) {
          return where.OR.some((c) => (c.teacherId && s.teacherId === c.teacherId) || (c.learnerId && s.learnerId === c.learnerId));
        }
        return true;
      });
      const totalDuration = matching.reduce((acc, s) => acc + (s.duration || 60), 0);
      return { _sum: { duration: totalDuration } };
    }),
  },
  $transaction: jest.fn(async (ops) => {
    if (typeof ops === 'function') return ops(mockPrisma);
    return Promise.all(ops);
  }),
};

jest.mock('../src/config/prisma', () => ({
  prisma: mockPrisma,
  disconnectPrisma: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/services/chatService', () => ({
  broadcastToGlobal: jest.fn(),
}));

jest.mock('../src/services/tokenEconomy', () => ({
  awardSessionComplete: jest.fn().mockResolvedValue({}),
  getBalance: jest.fn().mockResolvedValue(100),
  getTransactionHistory: jest.fn().mockResolvedValue([]),
}));

jest.mock('../src/services/matchingEngine', () => ({
  getUserSkillGraph: jest.fn().mockResolvedValue({ teaches: [], learns: [] }),
}));

jest.mock('../src/services/streakCalculator', () => ({
  calculateStreak: jest.fn().mockResolvedValue({ currentStreak: 2, longestStreak: 5, activeDates: [], activityDays: [], grid: [] }),
  recordCheckIn: jest.fn().mockResolvedValue({ alreadyCheckedIn: true }),
}));

const express = require('express');
const request = require('supertest');
const { verifyToken } = require('@clerk/express');
const sessionRoutes = require('../src/routes/session');
const userRoutes = require('../src/routes/user');
const { globalErrorHandler } = require('../src/middleware/errorHandler');

describe('Session Lifecycle, Overlap, Reschedule, Calendar & Mutual Rating', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/session', sessionRoutes);
    app.use('/api/user', userRoutes);
    app.use(globalErrorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockState.users = {
      'tutor-1': {
        id: 'tutor-1',
        clerkUserId: 'clerk-tutor-1',
        name: 'Tutor One',
        email: 'tutor@mindcraft.edu',
        deletedAt: null,
        totalSessions: 10,
        averageRating: 0,
        profileComplete: true,
        skills: [],
      },
      'learner-1': {
        id: 'learner-1',
        clerkUserId: 'clerk-learner-1',
        name: 'Learner One',
        email: 'learner@mindcraft.edu',
        deletedAt: null,
        totalSessions: 4,
        averageRating: 0,
        profileComplete: true,
        skills: [],
      },
      'learner-2': {
        id: 'learner-2',
        clerkUserId: 'clerk-learner-2',
        name: 'Learner Two',
        email: 'learner2@mindcraft.edu',
        deletedAt: null,
        totalSessions: 2,
        averageRating: 0,
        profileComplete: true,
        skills: [],
      },
      'tutor-2': {
        id: 'tutor-2',
        clerkUserId: 'clerk-tutor-2',
        name: 'Tutor Two',
        email: 'tutor2@mindcraft.edu',
        deletedAt: null,
        totalSessions: 3,
        averageRating: 0,
        profileComplete: true,
        skills: [],
      },
    };
    mockState.sessions = [];
  });

  it('prevents overlapping bookings for both tutor and learner while allowing adjacent slots', async () => {
    const baseStart = Date.now() + 24 * 60 * 60 * 1000; // tomorrow
    mockState.sessions.push({
      id: 'existing-1',
      teacherId: 'tutor-1',
      learnerId: 'learner-1',
      title: 'Algorithms',
      mode: 'ONLINE',
      status: 'UPCOMING',
      scheduledFor: new Date(baseStart),
      duration: 60,
    });

    // 1) Overlapping slot for tutor-1 with a different learner (30 mins after baseStart)
    verifyToken.mockResolvedValue({ sub: 'clerk-learner-2' });
    const tutorOverlapRes = await request(app)
      .post('/api/session/book')
      .set('Authorization', 'Bearer tok')
      .send({
        matchId: 'match-1',
        teacherUid: 'clerk-tutor-1',
        learnerUid: 'clerk-learner-2',
        skill: 'Graphs',
        scheduledAt: baseStart + 30 * 60 * 1000,
        mode: 'Online',
      });

    expect(tutorOverlapRes.status).toBe(409);
    expect(tutorOverlapRes.body.error).toBe('Tutor is not available at the selected time');

    // 2) Overlapping slot for learner-1 with a different tutor (30 mins before baseStart)
    verifyToken.mockResolvedValue({ sub: 'clerk-learner-1' });
    const learnerOverlapRes = await request(app)
      .post('/api/session/book')
      .set('Authorization', 'Bearer tok')
      .send({
        matchId: 'match-2',
        teacherUid: 'clerk-tutor-2',
        learnerUid: 'clerk-learner-1',
        skill: 'Calculus',
        scheduledAt: baseStart - 30 * 60 * 1000,
        mode: 'Online',
      });

    expect(learnerOverlapRes.status).toBe(409);
    expect(learnerOverlapRes.body.error).toBe('Learner is not available at the selected time');

    // 3) Adjacent slot (exact end time = baseStart + 60m) is allowed
    const adjacentRes = await request(app)
      .post('/api/session/book')
      .set('Authorization', 'Bearer tok')
      .send({
        matchId: 'match-2',
        teacherUid: 'clerk-tutor-2',
        learnerUid: 'clerk-learner-1',
        skill: 'Calculus',
        scheduledAt: baseStart + 60 * 60 * 1000,
        mode: 'Online',
      });

    expect(adjacentRes.status).toBe(201);
    expect(adjacentRes.body.data.meetLink).toMatch(/^https:\/\/meet\.jit\.si\/MindCraft-/);
  });

  it('reschedules pending/upcoming sessions via PATCH /api/session/:id/reschedule and enforces overlap', async () => {
    const baseStart = Date.now() + 24 * 60 * 60 * 1000;
    mockState.sessions.push(
      {
        id: 'sess-resched-1',
        teacherId: 'tutor-1',
        learnerId: 'learner-1',
        title: 'DSA',
        mode: 'ONLINE',
        status: 'UPCOMING',
        scheduledFor: new Date(baseStart),
        createdAt: new Date(),
      },
      {
        id: 'sess-conflict-2',
        teacherId: 'tutor-1',
        learnerId: 'learner-2',
        title: 'OS',
        mode: 'ONLINE',
        status: 'PENDING',
        scheduledFor: new Date(baseStart + 3 * 60 * 60 * 1000),
        createdAt: new Date(),
      },
    );

    verifyToken.mockResolvedValue({ sub: 'clerk-learner-1' });

    // Reschedule into conflicting slot -> 409
    const conflictRes = await request(app)
      .patch('/api/session/sess-resched-1/reschedule')
      .set('Authorization', 'Bearer tok')
      .send({ scheduledAt: baseStart + 3.5 * 60 * 60 * 1000 });
    expect(conflictRes.status).toBe(409);

    // Reschedule into open slot -> 200
    const newTime = baseStart + 6 * 60 * 60 * 1000;
    const okRes = await request(app)
      .patch('/api/session/sess-resched-1/reschedule')
      .set('Authorization', 'Bearer tok')
      .send({ scheduledAt: newTime });
    expect(okRes.status).toBe(200);
    expect(okRes.body.success).toBe(true);
    expect(okRes.body.data.scheduledAt).toBe(newTime);
  });

  it('does not penalize unrated sessions when calculating rating average', async () => {
    // Tutor has 10 completed sessions, 9 unrated, averageRating = 0
    for (let i = 1; i <= 10; i++) {
      mockState.sessions.push({
        id: `completed-${i}`,
        teacherId: 'tutor-1',
        learnerId: 'learner-1',
        title: 'Algorithms',
        mode: 'ONLINE',
        status: 'COMPLETED',
        scheduledFor: new Date(Date.now() - i * 3600000),
        completionKey: null,
      });
    }

    verifyToken.mockResolvedValue({ sub: 'clerk-learner-1' });

    const res = await request(app)
      .post('/api/session/completed-10/rate')
      .set('Authorization', 'Bearer tok')
      .send({ rating: 5, comment: 'Clear explanation!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Must be 5.0 (1 rated session), NOT 0.5 (10 total sessions)
    expect(mockState.users['tutor-1'].averageRating).toBe(5);
    expect(res.body.data.averageRating).toBe(5);
    expect(res.body.data.ratedSessionsCount).toBe(1);
  });

  it('teacher rating learner mutates learner averageRating and leaves teacher rating untouched', async () => {
    mockState.users['tutor-1'].averageRating = 4.8;
    mockState.users['learner-1'].averageRating = 0;

    mockState.sessions.push({
      id: 'completed-mutual-1',
      teacherId: 'tutor-1',
      learnerId: 'learner-1',
      title: 'System Design',
      mode: 'ONLINE',
      status: 'COMPLETED',
      scheduledFor: new Date(Date.now() - 3600000),
      completionKey: null,
    });

    verifyToken.mockResolvedValue({ sub: 'clerk-tutor-1' });

    const res = await request(app)
      .post('/api/session/completed-mutual-1/rate')
      .set('Authorization', 'Bearer tok')
      .send({ rating: 4, comment: 'Prepared great questions!' });

    expect(res.status).toBe(200);
    expect(mockState.users['learner-1'].averageRating).toBe(4);
    expect(mockState.users['tutor-1'].averageRating).toBe(4.8);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'learner-1' },
      data: { averageRating: 4 },
    });
  });

  it('generates zero-failure Google Calendar template deep-link with Jitsi link and peer email', async () => {
    mockState.sessions.push({
      id: 'sess-cal-1',
      teacherId: 'tutor-1',
      learnerId: 'learner-1',
      title: 'Dynamic Programming',
      mode: 'ONLINE',
      status: 'UPCOMING',
      scheduledFor: new Date('2026-12-01T10:00:00.000Z'),
    });

    verifyToken.mockResolvedValue({ sub: 'clerk-learner-1' });
    const res = await request(app)
      .post('/api/session/sess-cal-1/export-calendar')
      .set('Authorization', 'Bearer tok')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.htmlLink).toContain('https://calendar.google.com/calendar/render?');
    expect(res.body.data.htmlLink).toContain('action=TEMPLATE');
    expect(res.body.data.htmlLink).toContain(encodeURIComponent('https://meet.jit.si/MindCraft-sess-cal-1'));
    expect(res.body.data.htmlLink).toContain(encodeURIComponent('tutor@mindcraft.edu'));
  });

  it('returns uncapped completed session count, study hours, and genuine reviews on profile', async () => {
    for (let i = 1; i <= 25; i++) {
      mockState.sessions.push({
        id: `hist-${i}`,
        teacherId: 'tutor-1',
        learnerId: 'learner-1',
        title: `Topic ${i}`,
        mode: 'ONLINE',
        status: 'COMPLETED',
        scheduledFor: new Date(Date.now() - i * 86400000),
        duration: 60,
        completionKey: i === 1 ? JSON.stringify({ learner_learner_1: undefined, 'learner_learner-1': { rating: 4, comment: 'Very helpful!' }, learnerRated: true }) : null,
      });
    }

    verifyToken.mockResolvedValue({ sub: 'clerk-tutor-1' });
    const res = await request(app)
      .get('/api/user/clerk-tutor-1/profile')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.data.stats.completedSessionsCount).toBe(25);
    expect(res.body.data.stats.totalStudyHours).toBe(25);
    expect(res.body.data.reviews).toHaveLength(1);
    expect(res.body.data.reviews[0]).toMatchObject({
      sessionId: 'hist-1',
      rating: 4,
      ratingComment: 'Very helpful!',
    });
  });

  it('Gate #6: aggregates custom session durations (30m + 90m = 2.0h) accurately on profile', async () => {
    mockState.sessions.push(
      {
        id: 'dur-30',
        teacherId: 'tutor-1',
        learnerId: 'learner-1',
        title: 'Quick Review',
        mode: 'ONLINE',
        status: 'COMPLETED',
        scheduledFor: new Date(Date.now() - 86400000),
        duration: 30,
      },
      {
        id: 'dur-90',
        teacherId: 'tutor-1',
        learnerId: 'learner-1',
        title: 'Deep Dive',
        mode: 'ONLINE',
        status: 'COMPLETED',
        scheduledFor: new Date(Date.now() - 43200000),
        duration: 90,
      },
    );

    verifyToken.mockResolvedValue({ sub: 'clerk-tutor-1' });
    const res = await request(app)
      .get('/api/user/clerk-tutor-1/profile')
      .set('Authorization', 'Bearer tok');

    expect(res.status).toBe(200);
    expect(res.body.data.stats.completedSessionsCount).toBe(2);
    expect(res.body.data.stats.totalStudyHours).toBe(2);
  });
});
