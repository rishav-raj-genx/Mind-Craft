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
    currentStreak: 1,
    longestStreak: 1,
    activeDates: [],
    grid: [],
  }),
  recordCheckIn: jest.fn().mockResolvedValue({ alreadyCheckedIn: false }),
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
      if (where.deletedAt === null && dbUser.deletedAt !== null) return null;
      if (where.clerkUserId && where.clerkUserId === dbUser.clerkUserId) return dbUser;
      if (where.id && where.id === dbUser.id) return dbUser;
      if (where.email && where.email.toLowerCase() === dbUser.email?.toLowerCase()) return dbUser;
      if (Array.isArray(where.OR)) {
        const match = where.OR.some(
          (c) =>
            (c.clerkUserId && c.clerkUserId === dbUser.clerkUserId) ||
            (c.id && c.id === dbUser.id) ||
            (c.email && c.email.toLowerCase() === dbUser.email?.toLowerCase())
        );
        if (match) return dbUser;
      }
      return null;
    }),
    findUnique: jest.fn().mockImplementation(async ({ where = {} } = {}) => {
      if (!dbUser) return null;
      if (where.deletedAt === null && dbUser.deletedAt !== null) return null;
      if (where.clerkUserId && where.clerkUserId === dbUser.clerkUserId) return dbUser;
      if (where.id && where.id === dbUser.id) return dbUser;
      if (where.email && where.email.toLowerCase() === dbUser.email?.toLowerCase()) return dbUser;
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
        currentStreak: 1,
        longestStreak: 1,
        totalSessions: 0,
        averageRating: 0,
        totalActiveDays: 1,
        deletedAt: null,
        college: col,
        department: dept,
        skills: dbUserSkills,
      };
      return dbUser;
    }),
    update: jest.fn().mockImplementation(async ({ data }) => {
      const col = data.collegeId ? dbColleges.get(data.collegeId) : dbUser?.college;
      const dept = data.departmentId ? dbDepartments.get(data.departmentId) : dbUser?.department;
      Object.assign(dbUser, data);
      if (col) dbUser.college = col;
      if (dept) dbUser.department = dept;
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

  it('Test 5: User deleted via user.deleted webhook can re-register with the same email and a new clerkId and receive 200 OK', async () => {
    const { processClerkEvent } = require('../src/services/clerkUserSync');

    // 5a. Webhook deactivates the user
    await processClerkEvent({
      type: 'user.deleted',
      data: { id: testClerkId },
    });

    expect(dbUser.deletedAt).toBeInstanceOf(Date);

    // 5b. Authenticated protected routes block the deactivated user with 403
    verifyToken.mockResolvedValueOnce({
      sub: testClerkId,
      email: 'student@hitech.edu',
    });
    const blockedRes = await request(app)
      .get(`/api/user/${testClerkId}/profile`)
      .set('Authorization', 'Bearer valid_clerk_jwt');

    expect(blockedRes.status).toBe(403);
    expect(blockedRes.body.error).toBe('This account has been deactivated');

    // 5c. User creates a brand-new Clerk account with the same email
    const newClerkId = 'user_test_lifecycle_reborn_1000';
    verifyToken.mockResolvedValue({
      sub: newClerkId,
      email: 'student@hitech.edu',
      name: 'HiTech Student Reborn',
    });

    // 5d. POST /api/user/register reactivates the account and updates profile
    const reRegisterPayload = {
      name: 'HiTech Student Reborn',
      gender: 'Male',
      college: 'Hi-Tech University',
      collegeLocation: 'Ghaziabad',
      department: 'CSE',
      year: 3,
      teaches: ['System Design'],
      learns: ['Rust'],
    };

    const registerRes = await request(app)
      .post('/api/user/register')
      .set('Authorization', 'Bearer valid_clerk_jwt_new')
      .send(reRegisterPayload);

    expect(registerRes.status).toBe(200);
    expect(registerRes.body.success).toBe(true);
    expect(registerRes.body.registered).toBe(true);
    expect(registerRes.body.user).toBeDefined();
    expect(registerRes.body.user.clerkUserId).toBe(newClerkId);
    expect(registerRes.body.user.name).toBe('HiTech Student Reborn');
    expect(registerRes.body.user.year).toBe('3');
    expect(registerRes.body.user.teaches).toEqual(['System Design']);
    expect(registerRes.body.user.learns).toEqual(['Rust']);
    expect(registerRes.body.user.profileComplete).toBe(true);
    expect(registerRes.body.user.isActive).toBe(true);

    // Database row is reactivated: deletedAt is cleared and clerkUserId updated
    expect(dbUser.deletedAt).toBeNull();
    expect(dbUser.clerkUserId).toBe(newClerkId);

    // 5e. Subsequent GET /api/auth/me returns active registered user
    const authMeRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer valid_clerk_jwt_new');

    expect(authMeRes.status).toBe(200);
    expect(authMeRes.body.success).toBe(true);
    expect(authMeRes.body.registered).toBe(true);
    expect(authMeRes.body.needsOnboarding).toBe(false);
    expect(authMeRes.body.user.clerkUserId).toBe(newClerkId);
  });

  it('Test 6: User deleted via webhook and synced via user.created webhook before POST /api/user/register also reactivates with 200 OK', async () => {
    const { processClerkEvent } = require('../src/services/clerkUserSync');

    // Soft-delete user
    const currentClerkId = dbUser.clerkUserId;
    await processClerkEvent({
      type: 'user.deleted',
      data: { id: currentClerkId },
    });
    expect(dbUser.deletedAt).toBeInstanceOf(Date);

    // Clerk fires user.created webhook with a third clerkId
    const thirdClerkId = 'user_test_lifecycle_third_2000';
    await processClerkEvent({
      type: 'user.created',
      data: {
        id: thirdClerkId,
        email_addresses: [{ id: 'email-3', email_address: 'student@hitech.edu' }],
        primary_email_address_id: 'email-3',
        first_name: 'HiTech',
        last_name: 'Third',
      },
    });

    // Row is reactivated by the user.created webhook sync
    expect(dbUser.deletedAt).toBeNull();
    expect(dbUser.clerkUserId).toBe(thirdClerkId);

    // User completes onboarding
    verifyToken.mockResolvedValue({
      sub: thirdClerkId,
      email: 'student@hitech.edu',
    });

    const res = await request(app)
      .post('/api/user/register')
      .set('Authorization', 'Bearer valid_clerk_jwt_third')
      .send({
        name: 'HiTech Third',
        college: 'Hi-Tech University',
        department: 'CSE',
        year: 4,
        teaches: ['Algorithms'],
        learns: ['Go'],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.clerkUserId).toBe(thirdClerkId);
    expect(res.body.user.isActive).toBe(true);
    expect(dbUser.deletedAt).toBeNull();
  });
});
