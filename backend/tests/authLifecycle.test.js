/**
 * authLifecycle.test.js — Full Authentication & Onboarding Lifecycle Integration Tests
 */

jest.mock('@clerk/express', () => ({
  verifyToken: jest.fn(),
  createClerkClient: jest.fn(() => ({
    users: {
      getUser: jest.fn().mockResolvedValue({
        id: 'user_test_lifecycle_999',
        firstName: 'HiTech',
        lastName: 'Student',
        username: 'hitechstudent',
        imageUrl: 'https://example.com/hitech.png',
        primaryEmailAddressId: 'email-hitech-1',
        emailAddresses: [{ id: 'email-hitech-1', emailAddress: 'student@hitech.edu' }],
      }),
    },
  })),
  clerkClient: {
    users: {
      getUser: jest.fn().mockResolvedValue({
        id: 'user_test_lifecycle_999',
        firstName: 'HiTech',
        lastName: 'Student',
        username: 'hitechstudent',
        imageUrl: 'https://example.com/hitech.png',
        primaryEmailAddressId: 'email-hitech-1',
        emailAddresses: [{ id: 'email-hitech-1', emailAddress: 'student@hitech.edu' }],
      }),
    },
  },
}));

jest.mock('../src/services/tokenEconomy', () => ({
  getBalance: jest.fn().mockResolvedValue(0),
  getTransactionHistory: jest.fn().mockResolvedValue([]),
  creditTokens: jest.fn().mockResolvedValue({ success: true }),
  debitTokens: jest.fn().mockResolvedValue({ success: true }),
}));

jest.mock('../src/services/matchingEngine', () => ({
  getUserSkillGraph: jest.fn().mockImplementation(() => Promise.resolve({
    teaches: ['DSA'],
    learns: ['WEB'],
  })),
}));

jest.mock('../src/services/streakCalculator', () => ({
  calculateStreak: jest.fn().mockResolvedValue({
    currentStreak: 0,
    longestStreak: 0,
    activeDates: [],
    grid: [],
  }),
}));

const testClerkId = 'user_test_lifecycle_999';
const testInternalId = '99999999-8888-4777-a666-555555555555';

let dbUser = null; // initially null to simulate brand-new Clerk user with no Postgres row
const dbColleges = new Map([
  ['col-seeded-1', { id: 'col-seeded-1', name: 'Existing University', location: 'Delhi' }],
]);
const dbDepartments = new Map([
  ['dept-seeded-1', { id: 'dept-seeded-1', name: 'Information Technology' }],
]);
const dbSkills = new Map();
let dbUserSkills = [];

const mockPrisma = {
  user: {
    findFirst: jest.fn().mockImplementation(async ({ where = {} } = {}) => {
      if (!dbUser) return null;
      if (where.clerkUserId && where.clerkUserId === dbUser.clerkUserId) return dbUser;
      if (where.id && where.id === dbUser.id) return dbUser;
      if (Array.isArray(where.OR)) {
        const match = where.OR.some(
          (c) => (c.clerkUserId && c.clerkUserId === dbUser.clerkUserId) || (c.id && c.id === dbUser.id)
        );
        if (match) return dbUser;
      }
      return null;
    }),
    findUnique: jest.fn().mockImplementation(async ({ where = {} } = {}) => {
      if (!dbUser) return null;
      if (where.clerkUserId && where.clerkUserId === dbUser.clerkUserId) return dbUser;
      if (where.id && where.id === dbUser.id) return dbUser;
      return null;
    }),
    create: jest.fn().mockImplementation(async ({ data }) => {
      const col = data.collegeId ? dbColleges.get(data.collegeId) : null;
      const dept = data.departmentId ? dbDepartments.get(data.departmentId) : null;
      dbUser = {
        id: testInternalId,
        clerkUserId: data.clerkUserId,
        email: data.email || 'student@hitech.edu',
        name: data.name || 'HiTech Student',
        photoUrl: data.photoUrl || '',
        gender: data.gender || '',
        collegeId: data.collegeId || null,
        collegeLocation: data.collegeLocation || '',
        departmentId: data.departmentId || null,
        year: data.year ? String(data.year) : '',
        profileComplete: true,
        mindTokens: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalSessions: 0,
        averageRating: 0,
        deletedAt: null,
        college: col,
        department: dept,
        skills: dbUserSkills,
      };
      return dbUser;
    }),
    update: jest.fn().mockImplementation(async ({ data }) => {
      Object.assign(dbUser, data);
      return dbUser;
    }),
  },
  college: {
    findMany: jest.fn().mockImplementation(async () => Array.from(dbColleges.values())),
    findUnique: jest.fn().mockImplementation(async ({ where = {} }) =>
      dbColleges.get(where.id) || Array.from(dbColleges.values()).find((c) => c.name === where.name) || null
    ),
    upsert: jest.fn().mockImplementation(async ({ where, create }) => {
      let col = Array.from(dbColleges.values()).find((c) => c.name === where.name);
      if (!col) {
        col = { id: `col-${where.name}`, name: create.name, location: create.location || '' };
        dbColleges.set(col.id, col);
      }
      return col;
    }),
  },
  department: {
    findMany: jest.fn().mockImplementation(async () => Array.from(dbDepartments.values())),
    findUnique: jest.fn().mockImplementation(async ({ where = {} }) =>
      dbDepartments.get(where.id) || Array.from(dbDepartments.values()).find((d) => d.name === where.name) || null
    ),
    upsert: jest.fn().mockImplementation(async ({ where, create }) => {
      let dept = Array.from(dbDepartments.values()).find((d) => d.name === where.name);
      if (!dept) {
        dept = { id: `dept-${where.name}`, name: create.name };
        dbDepartments.set(dept.id, dept);
      }
      return dept;
    }),
  },
  skill: {
    findMany: jest.fn().mockImplementation(async () => Array.from(dbSkills.values())),
    upsert: jest.fn().mockImplementation(async ({ where, create }) => {
      let sk = Array.from(dbSkills.values()).find((s) => s.name === where.name);
      if (!sk) {
        sk = { id: `skill-${where.name}`, name: create.name };
        dbSkills.set(sk.id, sk);
      }
      return sk;
    }),
  },
  userSkill: {
    deleteMany: jest.fn().mockImplementation(async ({ where = {} } = {}) => {
      const prevCount = dbUserSkills.length;
      if (where.kind) {
        dbUserSkills = dbUserSkills.filter((s) => s.kind !== where.kind);
      } else {
        dbUserSkills = [];
      }
      if (dbUser) dbUser.skills = dbUserSkills;
      return { count: prevCount - dbUserSkills.length };
    }),
    upsert: jest.fn().mockImplementation(async ({ create }) => {
      const skill = dbSkills.get(create.skillId) || { id: create.skillId, name: create.skillId.replace('skill-', '') };
      const entry = {
        userId: create.userId,
        skillId: create.skillId,
        kind: create.kind,
        skill,
      };
      dbUserSkills.push(entry);
      if (dbUser) dbUser.skills = dbUserSkills;
      return entry;
    }),
  },
  tutoringSession: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  tokenTransaction: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  $transaction: jest.fn().mockImplementation(async (callback) => {
    if (typeof callback === 'function') {
      return callback(mockPrisma);
    }
    return Promise.all(callback);
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
const authRoutes = require('../src/routes/auth');
const userRoutes = require('../src/routes/user');
const { globalErrorHandler } = require('../src/middleware/errorHandler');

describe('Full Authentication & Onboarding Lifecycle Integration', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/user', userRoutes);
    app.use('/api/users', userRoutes);
    app.use(globalErrorHandler);
  });

  beforeEach(() => {
    verifyToken.mockResolvedValue({
      sub: testClerkId,
      email: 'student@hitech.edu',
      name: 'HiTech Student',
    });
  });

  it('Test 1: Brand-new Clerk user calls GET /api/auth/me -> returns 200 with registered: false, needsOnboarding: true', async () => {
    dbUser = null; // Unregistered user state in Postgres

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid_clerk_jwt');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.registered).toBe(false);
    expect(res.body.needsOnboarding).toBe(true);
    expect(res.body.user).toBeNull();
    expect(res.body.message).toContain('complete signup first');
  });

  it('Test 2: Same user calls POST /api/user/register with custom college, location, department, year, teaches, learns -> returns 200', async () => {
    const payload = {
      name: 'HiTech Student',
      gender: 'Male',
      college: 'Hi-Tech',
      collegeLocation: 'Ghaziabad',
      department: 'CSE',
      year: 2,
      teaches: ['DSA'],
      learns: ['WEB'],
    };

    const res = await request(app)
      .post('/api/user/register')
      .set('Authorization', 'Bearer valid_clerk_jwt')
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.registered).toBe(true);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.name).toBe('HiTech Student');
    expect(res.body.user.college).toBe('Hi-Tech');
    expect(res.body.user.collegeLocation).toBe('Ghaziabad');
    expect(res.body.user.department).toBe('CSE');
    expect(res.body.user.year).toBe('2');
    expect(res.body.user.teaches).toEqual(['DSA']);
    expect(res.body.user.learns).toEqual(['WEB']);
    expect(res.body.user.profileComplete).toBe(true);
  });

  it('Test 3: Same user calls GET /api/auth/me -> now returns 200 with registered: true, needsOnboarding: false, and profile data', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid_clerk_jwt');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.registered).toBe(true);
    expect(res.body.needsOnboarding).toBe(false);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.clerkUserId).toBe(testClerkId);
    expect(res.body.user.college).toBe('Hi-Tech');
    expect(res.body.user.department).toBe('CSE');
    expect(res.body.user.teaches).toContain('DSA');
    expect(res.body.user.learns).toContain('WEB');
    expect(res.body.user.profileComplete).toBe(true);
  });

  it('Test 4: GET /api/user/metadata/options returns 200 without auth; GET /api/user/:clerkId/profile returns 200 with auth', async () => {
    // 4a. Public metadata options without Authorization header
    const optionsRes = await request(app).get('/api/user/metadata/options');

    expect(optionsRes.status).toBe(200);
    expect(optionsRes.body.success).toBe(true);
    expect(Array.isArray(optionsRes.body.data.colleges)).toBe(true);
    expect(Array.isArray(optionsRes.body.data.departments)).toBe(true);
    expect(optionsRes.body.data.colleges).toContain('Hi-Tech');
    expect(optionsRes.body.data.departments).toContain('CSE');

    // 4b. Authenticated user profile lookup by clerkId
    const profileRes = await request(app)
      .get(`/api/user/${testClerkId}/profile`)
      .set('Authorization', 'Bearer valid_clerk_jwt');

    expect(profileRes.status).toBe(200);
    expect(profileRes.body.success).toBe(true);
    expect(profileRes.body.data.user).toBeDefined();
    expect(profileRes.body.data.user.clerkUserId).toBe(testClerkId);
    expect(profileRes.body.data.user.college).toBe('Hi-Tech');
    expect(profileRes.body.data.user.department).toBe('CSE');
    expect(profileRes.body.data.skillGraph.teaches).toContain('DSA');
    expect(profileRes.body.data.skillGraph.learns).toContain('WEB');
  });
});
