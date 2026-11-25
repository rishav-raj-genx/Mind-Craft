const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  clerkUserId: 'clerk-user-1',
  mindTokens: 100,
};

const mockTx = {
  tokenTransaction: {
    create: jest.fn(),
  },
  user: {
    update: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
  },
  activityDay: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  tokenTransaction: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  activityDay: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest.fn((cb) => {
    if (typeof cb === 'function') return cb(mockTx);
    return Promise.all(cb);
  }),
};

jest.mock('../src/config/prisma', () => ({
  prisma: mockPrisma,
}));

const { awardTokens, deductTokens } = require('../src/services/tokenEconomy');

describe('tokenEconomy service - Transactional Integrity & Idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Atomic token balance updates', () => {
    it('awards tokens inside an atomic transaction and records CREDIT transaction', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, mindTokens: 100 });
      mockPrisma.tokenTransaction.findFirst.mockResolvedValue(null);
      mockTx.tokenTransaction.create.mockResolvedValue({ id: 'tx-credit-1', amount: 50 });
      mockTx.user.update.mockResolvedValue({ mindTokens: 150 });
      mockTx.activityDay.findUnique.mockResolvedValue(null);
      mockTx.activityDay.upsert.mockResolvedValue({});

      const result = await awardTokens(mockUser.id, 50, 'session_complete', {
        idempotencyKey: 'idemp-session-123',
      });

      expect(result.alreadyAwarded).toBe(false);
      expect(result.newBalance).toBe(150);
      expect(result.transactionId).toBe('tx-credit-1');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.tokenTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            amount: 50,
            type: 'CREDIT',
            reason: 'session_complete',
            idempotencyKey: 'idemp-session-123',
          }),
        }),
      );
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { mindTokens: { increment: 50 } },
        select: { mindTokens: true },
      });
    });

    it('deducts tokens inside an atomic transaction with conditional update and records DEBIT transaction', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, mindTokens: 100 });
      mockPrisma.tokenTransaction.findFirst.mockResolvedValue(null);
      mockTx.user.updateMany.mockResolvedValue({ count: 1 });
      mockTx.user.findUnique.mockResolvedValue({ mindTokens: 70 });
      mockTx.tokenTransaction.create.mockResolvedValue({ id: 'tx-debit-1', amount: 30 });

      const result = await deductTokens(mockUser.id, 30, 'session_booking', {
        idempotencyKey: 'idemp-booking-456',
      });

      expect(result.alreadyProcessed).toBe(false);
      expect(result.newBalance).toBe(70);
      expect(result.transactionId).toBe('tx-debit-1');

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: mockUser.id,
          mindTokens: { gte: 30 },
        },
        data: {
          mindTokens: { decrement: 30 },
        },
      });
      expect(mockTx.tokenTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            amount: 30,
            type: 'DEBIT',
            reason: 'session_booking',
            idempotencyKey: 'idemp-booking-456',
          }),
        }),
      );
    });
  });

  describe('Double-minting prevention via duplicate idempotency keys', () => {
    it('returns existing balance and does not invoke transaction when idempotencyKey was already recorded', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, mindTokens: 100 });
      mockPrisma.tokenTransaction.findFirst.mockResolvedValue({ id: 'existing-tx-999' });

      const result = await awardTokens(mockUser.id, 50, 'forum_answer', {
        idempotencyKey: 'dup-key-1',
      });

      expect(result.alreadyAwarded).toBe(true);
      expect(result.newBalance).toBe(100);
      expect(result.transactionId).toBe('existing-tx-999');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockTx.tokenTransaction.create).not.toHaveBeenCalled();
    });

    it('gracefully handles concurrent duplicate key collision (P2002) without double crediting', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, mindTokens: 100 });
      mockPrisma.tokenTransaction.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'winner-tx-id' });

      const p2002Error = new Error('Unique constraint failed on the fields: (`idempotencyKey`)');
      p2002Error.code = 'P2002';
      mockPrisma.$transaction.mockRejectedValueOnce(p2002Error);
      mockPrisma.user.findUnique.mockResolvedValue({ mindTokens: 150 });

      const result = await awardTokens(mockUser.id, 50, 'session_complete', {
        idempotencyKey: 'race-key-2',
      });

      expect(result.alreadyAwarded).toBe(true);
      expect(result.transactionId).toBe('winner-tx-id');
      expect(result.newBalance).toBe(150);
    });

    it('returns alreadyProcessed when deductTokens encounters an existing idempotencyKey', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, mindTokens: 80 });
      mockPrisma.tokenTransaction.findFirst.mockResolvedValue({ id: 'existing-deduct-tx' });

      const result = await deductTokens(mockUser.id, 20, 'session_booking', {
        idempotencyKey: 'dup-deduct-key',
      });

      expect(result.alreadyProcessed).toBe(true);
      expect(result.newBalance).toBe(80);
      expect(result.transactionId).toBe('existing-deduct-tx');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('Insufficient balance rejection', () => {
    it('throws HTTP 400 when user has fewer tokens than the requested deduction amount', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, mindTokens: 10 });
      mockPrisma.tokenTransaction.findFirst.mockResolvedValue(null);
      // updateMany returns count: 0 when mindTokens: { gte: 50 } condition fails
      mockTx.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        deductTokens(mockUser.id, 50, 'session_booking', { idempotencyKey: 'overdraft-attempt' }),
      ).rejects.toMatchObject({
        message: 'Insufficient token balance',
        statusCode: 400,
      });

      expect(mockTx.tokenTransaction.create).not.toHaveBeenCalled();
    });

    it('rejects deduction with invalid or non-positive amount with HTTP 400', async () => {
      await expect(deductTokens(mockUser.id, -10, 'session_booking')).rejects.toMatchObject({
        statusCode: 400,
      });
      await expect(deductTokens(mockUser.id, 0, 'session_booking')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('rejects deduction when user does not exist with HTTP 404', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(deductTokens('nonexistent-uid', 10, 'session_booking')).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });
});
