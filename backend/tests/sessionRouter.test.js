jest.mock('@clerk/express', () => ({
  verifyToken: jest.fn(),
}));

const mockUser = {
  id: 'user-caller-id',
  clerkUserId: 'clerk-caller',
  name: 'Caller User',
  email: 'caller@example.com',
  deletedAt: null,
  totalSessions: 1,
  averageRating: 0,
};

const mockPrisma = {
  tutoringSession: {
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
  },
  user: {
    findUnique: jest.fn().mockResolvedValue(mockUser),
    findFirst: jest.fn().mockResolvedValue(mockUser),
    update: jest.fn(),
  },
  tokenTransaction: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn((promises) => {
    if (typeof promises === 'function') return promises(mockPrisma);
    return Promise.all(promises);
  }),
};

jest.mock('../src/config/prisma', () => ({
  prisma: mockPrisma,
  disconnectPrisma: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/config/socket', () => ({
  emitToUser: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const { verifyToken } = require('@clerk/express');
const { prisma } = require('../src/config/prisma');
const { completeSession, cancelSession } = require('../src/services/sessionRouter');
const { generateIcsCalendar, exportSessionToCalendar } = require('../src/services/calendarExport');
const sessionRoutes = require('../src/routes/session');
const { globalErrorHandler } = require('../src/middleware/errorHandler');

describe('sessionRouter service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('completes session and updates participants', async () => {
    prisma.tutoringSession.findUnique.mockResolvedValue({
      id: 'session-123',
      teacherId: 'teacher-id',
      learnerId: 'learner-id',
      threadId: 'thread-123',
      title: 'Python',
      status: 'UPCOMING',
      teacher: { name: 'Alice', clerkUserId: 'clerk-alice' },
      learner: { name: 'Bob', clerkUserId: 'clerk-bob' },
    });
    prisma.user.findFirst.mockResolvedValue({ id: 'learner-id' });

    const result = await completeSession('session-123');

    expect(result.success).toBe(true);
    expect(result.alreadyCompleted).toBe(false);
    expect(prisma.tutoringSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'session-123' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it('rejects completing a session that is CANCELLED with 409', async () => {
    prisma.tutoringSession.findUnique.mockResolvedValue({
      id: 'session-123',
      status: 'CANCELLED',
      teacher: { name: 'Alice', clerkUserId: 'clerk-alice' },
      learner: { name: 'Bob', clerkUserId: 'clerk-bob' },
    });

    await expect(completeSession('session-123')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('cancels session', async () => {
    prisma.tutoringSession.findUnique.mockResolvedValue({ id: 'session-123' });
    prisma.tutoringSession.update.mockResolvedValue({ id: 'session-123', status: 'CANCELLED' });

    const result = await cancelSession('session-123');
    expect(result.success).toBe(true);
    expect(prisma.tutoringSession.update).toHaveBeenCalledWith({
      where: { id: 'session-123' },
      data: { status: 'CANCELLED' },
    });
  });

  it('rejects cancelling an already COMPLETED session with 409', async () => {
    prisma.tutoringSession.findUnique.mockResolvedValue({
      id: 'session-123',
      status: 'COMPLETED',
    });

    await expect(cancelSession('session-123')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('atomically refunds learner tokens on cancellation within $transaction', async () => {
    prisma.tutoringSession.findUnique.mockResolvedValue({
      id: 'session-refund-123',
      learnerId: 'learner-id-456',
      status: 'UPCOMING',
    });
    prisma.tutoringSession.update.mockResolvedValue({ id: 'session-refund-123', status: 'CANCELLED' });
    prisma.tokenTransaction.findFirst.mockResolvedValue({
      id: 'debit-tx-1',
      amount: 50,
      type: 'DEBIT',
      reason: 'session_booking',
    });
    prisma.user.update.mockResolvedValue({ id: 'learner-id-456', mindTokens: 150 });
    prisma.tokenTransaction.create.mockResolvedValue({ id: 'credit-tx-1' });

    const result = await cancelSession('session-refund-123');
    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'learner-id-456' },
        data: { mindTokens: { increment: 50 } },
      }),
    );
    expect(prisma.tokenTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'learner-id-456',
          amount: 50,
          type: 'CREDIT',
          reason: 'session_refund',
        }),
      }),
    );
  });
});

describe('calendarExport service', () => {
  it('generates RFC 5545 compliant .ics with mandatory CRLF (\\r\\n) formatting', () => {
    const session = {
      id: 'test-session-123',
      skill: 'Algorithms',
      mode: 'ONLINE',
      scheduledAt: Date.now() + 3600000,
    };

    const ics = generateIcsCalendar(session, 'Alice');

    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('VERSION:2.0\r\n');
    expect(ics).toContain('SUMMARY:MindCraft Tutoring: Algorithms with Alice\r\n');
    expect(ics).toContain('STATUS:CONFIRMED\r\n');
    expect(ics).toContain('END:VCALENDAR\r\n');

    const withoutCrlf = ics.replace(/\r\n/g, '');
    expect(withoutCrlf).not.toContain('\n');
    expect(withoutCrlf).not.toContain('\r');
  });

  it('gracefully falls back to Jitsi meet link when Google OAuth tokens are unset or expired', async () => {
    const session = {
      id: 'session-cal-999',
      skill: 'React',
      mode: 'ONLINE',
      scheduledAt: Date.now() + 3600000,
    };

    const result = await exportSessionToCalendar(session, null, 'Bob');
    expect(result.meetLink).toBe('https://meet.jit.si/MindCraft-session-cal-999');
    expect(result.eventId).toBeNull();
  });
});

describe('Session API Routes Endpoints', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/session', sessionRoutes);
    app.use(globalErrorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    verifyToken.mockResolvedValue({ sub: 'clerk-caller' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-caller-id',
      clerkUserId: 'clerk-caller',
      name: 'Caller User',
      email: 'caller@example.com',
      deletedAt: null,
      totalSessions: 1,
      averageRating: 0,
    });
  });

  it('CRITICAL-04: rejects self-booking with HTTP 400', async () => {
    const res = await request(app)
      .post('/api/session/book')
      .set('Authorization', 'Bearer valid-token')
      .send({
        matchId: '11111111-1111-4111-8111-111111111111',
        teacherUid: 'clerk-caller',
        skill: 'Physics',
        scheduledAt: Date.now() + 1000000,
        mode: 'Online',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Cannot book a tutoring session with yourself');
  });

  it('rejects self-booking when teacherUid is the caller internal user ID with HTTP 400', async () => {
    const res = await request(app)
      .post('/api/session/book')
      .set('Authorization', 'Bearer valid-token')
      .send({
        matchId: '11111111-1111-4111-8111-111111111111',
        teacherUid: 'user-caller-id',
        skill: 'Chemistry',
        scheduledAt: Date.now() + 1000000,
        mode: 'Online',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Cannot book a tutoring session with yourself');
  });

  it('rejects self-booking when teacher record resolves to caller ID with HTTP 400', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 'user-caller-id',
      clerkUserId: 'clerk-caller',
    });

    const res = await request(app)
      .post('/api/session/book')
      .set('Authorization', 'Bearer valid-token')
      .send({
        matchId: '11111111-1111-4111-8111-111111111111',
        teacherUid: 'different-param',
        skill: 'Biology',
        scheduledAt: Date.now() + 1000000,
        mode: 'Online',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Cannot book a tutoring session with yourself');
  });

  it('HIGH-17: rejects past scheduled sessions with HTTP 400', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 'other-teacher-id',
      clerkUserId: 'clerk-teacher',
      name: 'Teacher User',
      deletedAt: null,
    });

    const res = await request(app)
      .post('/api/session/book')
      .set('Authorization', 'Bearer valid-token')
      .send({
        matchId: '11111111-1111-4111-8111-111111111111',
        teacherUid: 'clerk-teacher',
        skill: 'Chemistry',
        scheduledAt: Date.now() - 500000,
        mode: 'Online',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Session must be scheduled in the future');
  });

  it('HIGH-17: rejects booking when tutor has an overlapping session with HTTP 409', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 'other-teacher-id',
      clerkUserId: 'clerk-teacher',
      name: 'Teacher User',
      deletedAt: null,
    });
    prisma.tutoringSession.findFirst.mockResolvedValueOnce({
      id: 'existing-session-overlap',
      teacherId: 'other-teacher-id',
      status: 'UPCOMING',
    });

    const futureTime = Date.now() + 1000000;
    const res = await request(app)
      .post('/api/session/book')
      .set('Authorization', 'Bearer valid-token')
      .send({
        matchId: '11111111-1111-4111-8111-111111111111',
        teacherUid: 'clerk-teacher',
        skill: 'Calculus',
        scheduledAt: futureTime,
        mode: 'Online',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Tutor is not available at the selected time');
  });

  it('HIGH-16: returns HTTP 409 Conflict when accepting a session not in PENDING state', async () => {
    prisma.tutoringSession.findUnique.mockResolvedValueOnce({
      id: 'session-already-accepted',
      teacherId: 'user-caller-id',
      teacher: { clerkUserId: 'clerk-caller' },
      status: 'UPCOMING',
    });

    const res = await request(app)
      .patch('/api/session/session-already-accepted/accept')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('atomically transitions session status from PENDING to UPCOMING on teacher accept', async () => {
    prisma.tutoringSession.findUnique.mockResolvedValueOnce({
      id: 'session-pending-1',
      teacherId: 'user-caller-id',
      teacher: { clerkUserId: 'clerk-caller', id: 'user-caller-id' },
      learner: { clerkUserId: 'clerk-learner', name: 'Learner' },
      status: 'PENDING',
      mode: 'ONLINE',
      title: 'Calculus',
    });
    prisma.tutoringSession.updateMany.mockResolvedValueOnce({ count: 1 });

    const res = await request(app)
      .patch('/api/session/session-pending-1/accept')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.tutoringSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-pending-1', status: 'PENDING' },
      data: { status: 'UPCOMING' },
    });
  });

  it('rejects accept with HTTP 409 when concurrent update race condition occurs (count: 0)', async () => {
    prisma.tutoringSession.findUnique.mockResolvedValueOnce({
      id: 'session-pending-race',
      teacherId: 'user-caller-id',
      teacher: { clerkUserId: 'clerk-caller', id: 'user-caller-id' },
      learner: { clerkUserId: 'clerk-learner', name: 'Learner' },
      status: 'PENDING',
    });
    prisma.tutoringSession.updateMany.mockResolvedValueOnce({ count: 0 });

    const res = await request(app)
      .patch('/api/session/session-pending-race/accept')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Session was already accepted or modified');
  });

  it('HIGH-19: rejects rating an incomplete session with HTTP 400', async () => {
    prisma.tutoringSession.findUnique.mockResolvedValueOnce({
      id: 'session-rate-pending',
      teacherId: 'teacher-uid',
      learnerId: 'user-caller-id',
      teacher: { clerkUserId: 'clerk-teacher', totalSessions: 1, averageRating: 0 },
      learner: { clerkUserId: 'clerk-caller' },
      status: 'UPCOMING',
    });

    const res = await request(app)
      .post('/api/session/session-rate-pending/rate')
      .set('Authorization', 'Bearer valid-token')
      .send({ rating: 5 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Cannot rate a session that is not completed');
  });

  it('HIGH-19: prevents duplicate rating submissions with HTTP 400', async () => {
    prisma.tutoringSession.findUnique.mockResolvedValueOnce({
      id: 'session-rate-double',
      teacherId: 'teacher-uid',
      learnerId: 'user-caller-id',
      teacher: { clerkUserId: 'clerk-teacher', totalSessions: 1, averageRating: 5 },
      learner: { clerkUserId: 'clerk-caller' },
      status: 'COMPLETED',
      completionKey: JSON.stringify({ learner_user_caller_id: { rating: 5, ratedAt: Date.now() }, learnerRated: true }),
    });

    const res = await request(app)
      .post('/api/session/session-rate-double/rate')
      .set('Authorization', 'Bearer valid-token')
      .send({ rating: 5 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('You have already rated this session');
  });

  it('MEDIUM-21: exports session to RFC 5545 .ics calendar over HTTP', async () => {
    prisma.tutoringSession.findUnique.mockResolvedValueOnce({
      id: 'session-ics-dl',
      teacherId: 'teacher-uid',
      learnerId: 'user-caller-id',
      teacher: { clerkUserId: 'clerk-teacher', name: 'Dr. Turing' },
      learner: { clerkUserId: 'clerk-caller', name: 'Caller Student' },
      title: 'Turing Machines',
      status: 'UPCOMING',
      scheduledFor: new Date(Date.now() + 7200000),
      mode: 'ONLINE',
    });

    const res = await request(app)
      .get('/api/session/session-ics-dl/ics')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.text).toContain('BEGIN:VCALENDAR\r\n');
    expect(res.text).toContain('SUMMARY:MindCraft Tutoring: Turing Machines with Dr. Turing\r\n');
    expect(res.text.replace(/\r\n/g, '')).not.toContain('\n');
  });
});
