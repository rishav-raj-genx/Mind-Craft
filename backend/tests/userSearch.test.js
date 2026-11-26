const express = require('express');
const request = require('supertest');

jest.mock('../src/config/prisma', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../src/middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: 'db-current-user', clerkUserId: 'clerk-current-user', uid: 'clerk-current-user' };
    next();
  },
  requireClerkAuth: (req, _res, next) => {
    req.user = { id: 'db-current-user', clerkUserId: 'clerk-current-user', uid: 'clerk-current-user' };
    next();
  },
}));

const { prisma } = require('../src/config/prisma');
const userRoutes = require('../src/routes/user');
const { globalErrorHandler } = require('../src/middleware/errorHandler');

describe('GET /api/user/search', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/user', userRoutes);
    app.use(globalErrorHandler);
  });

  it('returns an empty array immediately with 0 DB queries when q is shorter than 2 characters', async () => {
    const res = await request(app).get('/api/user/search?q=a');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('returns an empty array immediately when q is missing or whitespace', async () => {
    const res = await request(app).get('/api/user/search?q=%20');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('caps query results at take: 20 and searches clerkUserId, name, email, and skills', async () => {
    const mockUsers = Array.from({ length: 20 }, (_, i) => ({
      id: `user-${i}`,
      clerkUserId: `clerk-valid-${i}`,
      email: `valid${i}@example.com`,
      name: `Valid User ${i}`,
      skills: [],
      college: { name: 'MIT' },
      department: { name: 'CS' },
    }));
    prisma.user.findMany.mockResolvedValue(mockUsers);

    const res = await request(app).get('/api/user/search?q=valid&limit=100');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(20);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);

    const findManyArgs = prisma.user.findMany.mock.calls[0][0];
    expect(findManyArgs.take).toBe(20);
    expect(findManyArgs.where.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ clerkUserId: { contains: 'valid', mode: 'insensitive' } }),
        expect.objectContaining({ name: { contains: 'valid', mode: 'insensitive' } }),
        expect.objectContaining({ email: { contains: 'valid', mode: 'insensitive' } }),
        expect.objectContaining({ skills: { some: { skill: { name: { contains: 'valid', mode: 'insensitive' } } } } }),
      ]),
    );
  });
});
