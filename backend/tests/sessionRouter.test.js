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
    prisma.tutoringSession.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.user.findFirst.mockResolvedValue({ id: 'learner-id' });

    const result = await completeSession('session-123');

    expect(result.success).toBe(true);
    expect(result.alreadyCompleted).toBe(false);
    expect(prisma.tutoringSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'session-123',
          status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] },
        },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      }),
    );
  });

  it('Gate #9: concurrent completeSession rejects with 409 when updateMany matches 0 rows without double-incrementing', async () => {
    prisma.tutoringSession.findUnique.mockResolvedValue({
      id: 'session-race',
      teacherId: 'teacher-id',
      learnerId: 'learner-id',
      threadId: 'thread-123',
      title: 'Python',
      status: 'UPCOMING',
      teacher: { name: 'Alice', clerkUserId: 'clerk-alice' },
      learner: { name: 'Bob', clerkUserId: 'clerk-bob' },
    });
    prisma.tutoringSession.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(completeSession('session-race')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Session already completed or cannot be completed',
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
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

  it('Gate #7: GET /api/session/:id/calendar returns Google Calendar template URL with UTC dates, attendee email, and Jitsi Meet link', async () => {
    const scheduled = new Date('2026-12-01T10:00:00.000Z');
    prisma.tutoringSession.findUnique.mockResolvedValueOnce({
      id: 'session-cal-1',
      teacherId: 'teacher-uid',
      learnerId: 'user-caller-id',
      teacher: { clerkUserId: 'clerk-teacher', name: 'Dr. Turing', email: 'turing@example.com' },
      learner: { clerkUserId: 'clerk-caller', name: 'Caller Student', email: 'caller@example.com' },
      title: 'Graph Algorithms',
      status: 'UPCOMING',
      scheduledFor: scheduled,
      durationMins: 60,
      mode: 'ONLINE',
    });

    const res = await request(app)
      .get('/api/session/session-cal-1/calendar')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.meetLink).toBe('https://meet.jit.si/MindCraft-session-cal-1');

    const url = new URL(res.body.data.htmlLink);
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('MindCraft Session: Graph Algorithms');
    expect(url.searchParams.get('dates')).toBe('20261201T100000Z/20261201T110000Z');
    expect(url.searchParams.get('add')).toBe('turing@example.com');
    expect(url.searchParams.get('location')).toBe('https://meet.jit.si/MindCraft-session-cal-1');
  });

  it('Gate #7: exportSessionToCalendar falls back cleanly when Google OAuth credentials/tokens are missing or denied', async () => {
    const prevClientId = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    try {
      const result = await exportSessionToCalendar(
        {
          id: 'session-fallback-1',
          title: 'System Design',
          scheduledFor: new Date('2026-12-02T14:30:00.000Z'),
          mode: 'ONLINE',
        },
        null,
        'Ada Lovelace',
        'ada@example.com',
      );

      expect(result.eventId).toBeNull();
      expect(result.meetLink).toBe('https://meet.jit.si/MindCraft-session-fallback-1');
      expect(result.htmlLink).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
      expect(result.htmlLink).toContain('ada%40example.com');
    } finally {
      if (prevClientId !== undefined) process.env.GOOGLE_CLIENT_ID = prevClientId;
    }
  });

  it('Gate #6 & #9: POST /api/session/book persists duration inside $transaction and rejects overlap against a 90-min session', async () => {
    const teacher = { id: 'teacher-1', clerkUserId: 'clerk-teacher', name: 'Teacher' };
    const learner = { id: 'user-caller-id', clerkUserId: 'clerk-caller', name: 'Caller User' };
    const futureStart = Date.now() + 7200000;

    prisma.user.findFirst.mockResolvedValueOnce(teacher); // resolveUser(teacherUid)
    prisma.tutoringSession.findFirst.mockResolvedValueOnce(null);
    prisma.tutoringSession.create.mockResolvedValueOnce({
      id: 'sess-90m',
      teacherId: teacher.id,
      learnerId: learner.id,
      title: 'Algorithms',
      mode: 'ONLINE',
      scheduledFor: new Date(futureStart),
      duration: 90,
      threadId: 'thread-1',
      status: 'PENDING',
      teacher,
      learner,
    });

    const createRes = await request(app)
      .post('/api/session/book')
      .set('Authorization', 'Bearer valid-token')
      .send({
        matchId: 'thread-1',
        teacherUid: 'clerk-teacher',
        skill: 'Algorithms',
        mode: 'Online',
        scheduledAt: futureStart,
        duration: 90,
      });

    expect(createRes.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.tutoringSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ duration: 90 }),
      }),
    );
    expect(createRes.body.data.duration).toBe(90);

    // Second booking 65 minutes after the 90-minute session starts must be rejected with 409
    prisma.user.findFirst.mockResolvedValueOnce(teacher);
    prisma.tutoringSession.findFirst.mockResolvedValueOnce({
      id: 'sess-90m',
      teacherId: teacher.id,
      learnerId: learner.id,
      scheduledFor: new Date(futureStart),
      duration: 90,
      status: 'PENDING',
    });

    const overlapRes = await request(app)
      .post('/api/session/book')
      .set('Authorization', 'Bearer valid-token')
      .send({
        matchId: 'thread-1',
        teacherUid: 'clerk-teacher',
        skill: 'Data Structures',
        mode: 'Online',
        scheduledAt: futureStart + 65 * 60 * 1000,
        duration: 60,
      });

    expect(overlapRes.status).toBe(409);
    expect(overlapRes.body.success).toBe(false);
    expect(prisma.tutoringSession.create).toHaveBeenCalledTimes(1);
  });

  it('Gate #6: POST /api/session/book rejects invalid duration outside 15..240 minutes with 400', async () => {
    const teacher = { id: 'teacher-1', clerkUserId: 'clerk-teacher', name: 'Teacher' };
    prisma.user.findFirst.mockResolvedValueOnce(teacher);

    const res = await request(app)
      .post('/api/session/book')
      .set('Authorization', 'Bearer valid-token')
      .send({
        matchId: 'thread-1',
        teacherUid: 'clerk-teacher',
        skill: 'Algorithms',
        mode: 'Online',
        scheduledAt: Date.now() + 7200000,
        duration: 300,
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('Gate #9: repeated POST /api/session/:id/complete rejects with 409 and never double-awards tokens', async () => {
    prisma.tutoringSession.findUnique.mockResolvedValueOnce({
      id: 'sess-completed-1',
      teacherId: 'user-caller-id',
      learnerId: 'learner-1',
      teacher: { id: 'user-caller-id', clerkUserId: 'clerk-caller', name: 'Caller' },
      learner: { id: 'learner-1', clerkUserId: 'clerk-learner', name: 'Learner' },
      status: 'COMPLETED',
    });

    const res = await request(app)
      .post('/api/session/sess-completed-1/complete')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(prisma.tokenTransaction.create).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
