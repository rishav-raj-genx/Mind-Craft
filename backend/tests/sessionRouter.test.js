jest.mock('../src/config/prisma', () => ({
  prisma: {
    tutoringSession: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((promises) => Promise.all(promises)),
  },
}));

jest.mock('../src/config/socket', () => ({
  emitToUser: jest.fn(),
}));

const { prisma } = require('../src/config/prisma');
const { completeSession, cancelSession } = require('../src/services/sessionRouter');

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
});

