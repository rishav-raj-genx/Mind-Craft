const express = require('express');
const request = require('supertest');

// Shared in-memory Redis store to test real cache read/write/invalidation behavior
const mockRedisStore = new Map();
const mockRedisClient = {
  status: 'ready',
  connect: jest.fn().mockResolvedValue(),
  get: jest.fn(async (key) => (mockRedisStore.has(key) ? mockRedisStore.get(key) : null)),
  set: jest.fn(async (key, value) => {
    mockRedisStore.set(key, value);
    return 'OK';
  }),
  scan: jest.fn(async (_cursor, _matchFlag, pattern) => {
    const prefix = pattern.replace(/\*$/, '');
    const matched = Array.from(mockRedisStore.keys()).filter((k) => k.startsWith(prefix));
    return ['0', matched];
  }),
  keys: jest.fn(async (pattern) => {
    const prefix = pattern.replace(/\*$/, '');
    return Array.from(mockRedisStore.keys()).filter((k) => k.startsWith(prefix));
  }),
  del: jest.fn(async (...keys) => {
    let deleted = 0;
    for (const k of keys) {
      if (mockRedisStore.delete(k)) deleted += 1;
    }
    return deleted;
  }),
};

jest.mock('../src/config/redis', () => ({
  getRedisClients: jest.fn(() => ({
    base: mockRedisClient,
    publisher: mockRedisClient,
    subscriber: mockRedisClient,
  })),
  closeRedis: jest.fn().mockResolvedValue(),
}));

const mockBroadcastToGlobal = jest.fn();
jest.mock('../src/services/chatService', () => ({
  broadcastToGlobal: mockBroadcastToGlobal,
}));

jest.mock('../src/services/streakCalculator', () => ({
  calculateStreak: jest.fn().mockResolvedValue({ currentStreak: 1, longestStreak: 1, activeDates: [], grid: [] }),
  recordCheckIn: jest.fn().mockResolvedValue({ alreadyCheckedIn: false }),
}));

// In-memory database state
const USER_A_ID = '11111111-1111-4111-8111-111111111111';
const USER_A_CLERK = 'user_a_clerk';
const USER_B_ID = '22222222-2222-4222-8222-222222222222';
const USER_B_CLERK = 'user_b_clerk';

let mockAuthActor = { id: USER_A_ID, clerkUserId: USER_A_CLERK, uid: USER_A_CLERK, name: 'User A' };

jest.mock('../src/middleware/auth', () => ({
  requireAuth: (req, _res, next) => {
    req.user = { ...mockAuthActor };
    next();
  },
  requireClerkAuth: (req, _res, next) => {
    req.user = { ...mockAuthActor };
    next();
  },
}));

const dbUsers = new Map();
const dbColleges = new Map();
const dbDepartments = new Map();
const dbSkills = new Map();
let dbUserSkills = [];
let dbMatchRequests = [];
let dbChatThreads = [];
let dbUserFollows = [];
let skillSeq = 1;
let matchReqSeq = 1;

function seedInitialUsers() {
  dbUsers.clear();
  dbColleges.clear();
  dbDepartments.clear();
  dbSkills.clear();
  dbUserSkills = [];
  dbMatchRequests = [];
  dbChatThreads = [];
  dbUserFollows = [];
  skillSeq = 1;
  matchReqSeq = 1;

  const colMit = { id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'MIT', location: 'Cambridge' };
  const colStanford = { id: 'aaaaaaaa-0000-4000-8000-000000000002', name: 'Stanford', location: 'Palo Alto' };
  dbColleges.set(colMit.id, colMit);
  dbColleges.set(colStanford.id, colStanford);

  const deptCs = { id: 'bbbbbbbb-0000-4000-8000-000000000001', name: 'Computer Science' };
  dbDepartments.set(deptCs.id, deptCs);

  dbUsers.set(USER_A_ID, {
    id: USER_A_ID,
    clerkUserId: USER_A_CLERK,
    email: 'usera@example.com',
    name: 'User A',
    photoUrl: null,
    collegeId: colMit.id,
    college: colMit,
    collegeLocation: 'Cambridge',
    departmentId: deptCs.id,
    department: deptCs,
    year: '2',
    averageRating: 4.5,
    totalSessions: 4,
    latitude: null,
    longitude: null,
    deletedAt: null,
    profileComplete: true,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });

  dbUsers.set(USER_B_ID, {
    id: USER_B_ID,
    clerkUserId: USER_B_CLERK,
    email: 'userb@example.com',
    name: 'User B',
    photoUrl: null,
    collegeId: colStanford.id,
    college: colStanford,
    collegeLocation: 'Palo Alto',
    departmentId: deptCs.id,
    department: deptCs,
    year: '3',
    averageRating: 4.9,
    totalSessions: 8,
    latitude: null,
    longitude: null,
    deletedAt: null,
    profileComplete: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });

  // Intentionally store different-case Skill rows ("dsa" vs "DSA") with distinct UUIDs
  const skillLower = { id: 'cccccccc-0000-4000-8000-000000000001', name: 'dsa', normalizedName: 'dsa' };
  const skillUpper = { id: 'cccccccc-0000-4000-8000-000000000002', name: 'DSA', normalizedName: 'dsa' };
  dbSkills.set(skillLower.id, skillLower);
  dbSkills.set(skillUpper.id, skillUpper);

  dbUserSkills.push({ userId: USER_A_ID, skillId: skillLower.id, kind: 'LEARNS', skill: skillLower });
  dbUserSkills.push({ userId: USER_B_ID, skillId: skillUpper.id, kind: 'TEACHES', skill: skillUpper });
}

function hydrateUser(u) {
  if (!u) return null;
  return {
    ...u,
    skills: dbUserSkills.filter((us) => us.userId === u.id),
  };
}

function findUserByWhere(where = {}) {
  const candidates = Array.from(dbUsers.values());
  return candidates.find((u) => {
    if (where.deletedAt === null && u.deletedAt !== null) return false;
    if (where.id && u.id !== where.id) return false;
    if (where.clerkUserId && u.clerkUserId !== where.clerkUserId) return false;
    if (where.email && u.email !== where.email) return false;
    if (Array.isArray(where.OR)) {
      const orMatched = where.OR.some((cond) => (
        (cond.id && u.id === cond.id)
        || (cond.clerkUserId && u.clerkUserId === cond.clerkUserId)
        || (cond.email && u.email === cond.email)
      ));
      if (!orMatched) return false;
    }
    return true;
  }) || null;
}

const mockQueryRaw = jest.fn(async (sqlObj) => {
  // Inspect SQL template and evaluate case-insensitive matching + filters against in-memory state
  const sqlText = Array.isArray(sqlObj?.strings) ? sqlObj.strings.join('?') : '';
  const values = Array.isArray(sqlObj?.values) ? sqlObj.values : [];

  const requesterId = values[0];
  const requester = dbUsers.get(requesterId);
  if (!requester) return [];

  // Extract filter parameters encoded in queryMatches
  // values order in queryMatches:
  // [0]=requester.id, [1]=requester.id, [2]=requester.id, [3]=skillFilter, [4]=skillFilter,
  // [5]=sameCollegeOnly, [6]=collegeFilter, [7]=collegeFilter, [8]=collegeFilter,
  // [9]=departmentFilter, [10]=departmentFilter, [11]=departmentFilter,
  // [12]=yearFilter, [13]=yearFilter, [14]=minRating, [15]=minRating, ...
  const skillFilter = values[3] || null;
  const sameCollegeOnly = Boolean(values[5]);
  const collegeFilter = values[6] || null;
  const departmentFilter = values[9] || null;
  const yearFilter = values[12] || null;
  const minRating = Number(values[14] || 0);

  const usesCaseInsensitiveJoin = sqlText.includes('LOWER(TRIM(s.name)) = LOWER(TRIM(req.name))');

  const reqSkills = dbUserSkills.filter((us) => us.userId === requesterId);
  const results = [];

  for (const candidate of dbUsers.values()) {
    if (candidate.id === requesterId || candidate.deletedAt) continue;
    if (sameCollegeOnly && (!requester.collegeId || candidate.collegeId !== requester.collegeId)) continue;
    if (collegeFilter) {
      const colName = candidate.college?.name || '';
      if (
        candidate.collegeId !== collegeFilter
        && colName.trim().toLowerCase() !== String(collegeFilter).trim().toLowerCase()
      ) {
        continue;
      }
    }
    if (departmentFilter) {
      const deptName = candidate.department?.name || '';
      if (
        candidate.departmentId !== departmentFilter
        && deptName.trim().toLowerCase() !== String(departmentFilter).trim().toLowerCase()
      ) {
        continue;
      }
    }
    if (yearFilter && String(candidate.year || '').trim().toLowerCase() !== String(yearFilter).trim().toLowerCase()) {
      continue;
    }
    if (minRating > 0 && Number(candidate.averageRating || 0) < minRating) {
      continue;
    }

    const candSkills = dbUserSkills.filter((us) => us.userId === candidate.id);
    const matchedNames = new Set();

    for (const reqUs of reqSkills) {
      for (const candUs of candSkills) {
        if (candUs.kind === reqUs.kind) continue;
        const reqName = reqUs.skill?.name || '';
        const candName = candUs.skill?.name || '';
        const skillsMatch = usesCaseInsensitiveJoin
          ? reqName.trim().toLowerCase() === candName.trim().toLowerCase()
          : reqUs.skillId === candUs.skillId;
        if (!skillsMatch) continue;
        if (skillFilter && candName.trim().toLowerCase() !== String(skillFilter).trim().toLowerCase()) {
          continue;
        }
        matchedNames.add(candName);
      }
    }

    if (matchedNames.size === 0) continue;

    results.push({
      id: candidate.id,
      clerkUserId: candidate.clerkUserId,
      email: candidate.email,
      name: candidate.name,
      photoUrl: candidate.photoUrl,
      collegeId: candidate.collegeId,
      collegeName: candidate.college?.name || '',
      departmentId: candidate.departmentId,
      departmentName: candidate.department?.name || '',
      year: candidate.year,
      averageRating: Number(candidate.averageRating || 0),
      totalSessions: Number(candidate.totalSessions || 0),
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      createdAt: candidate.createdAt,
      sharedSkills: Array.from(matchedNames).sort(),
      sharedSkillCount: matchedNames.size,
      activityScore: 0.2,
      sameCollege: Boolean(requester.collegeId && candidate.collegeId === requester.collegeId),
      compatibilityScore: 0.75,
    });
  }

  return results;
});

const mockPrisma = {
  user: {
    findUnique: jest.fn(async ({ where }) => hydrateUser(findUserByWhere(where))),
    findFirst: jest.fn(async ({ where }) => hydrateUser(findUserByWhere(where))),
    findMany: jest.fn(async () => Array.from(dbUsers.values()).map(hydrateUser)),
    create: jest.fn(async ({ data }) => {
      const id = data.id || `33333333-3333-4333-8333-33333333333${dbUsers.size + 1}`;
      const col = data.collegeId ? dbColleges.get(data.collegeId) : null;
      const dept = data.departmentId ? dbDepartments.get(data.departmentId) : null;
      const created = {
        id,
        ...data,
        college: col,
        department: dept,
        averageRating: 0,
        totalSessions: 0,
        mindTokens: 0,
        currentStreak: 0,
        longestStreak: 0,
        deletedAt: null,
        updatedAt: new Date(),
        createdAt: new Date(),
      };
      dbUsers.set(id, created);
      return created;
    }),
    update: jest.fn(async ({ where, data }) => {
      const existing = dbUsers.get(where.id);
      if (!existing) throw new Error('User not found');
      const col = data.collegeId ? dbColleges.get(data.collegeId) : existing.college;
      const dept = data.departmentId ? dbDepartments.get(data.departmentId) : existing.department;
      const updated = {
        ...existing,
        ...data,
        college: col,
        department: dept,
        updatedAt: new Date(),
      };
      dbUsers.set(where.id, updated);
      return updated;
    }),
  },
  college: {
    findMany: jest.fn(async () => Array.from(dbColleges.values())),
    upsert: jest.fn(async ({ where, create }) => {
      let existing = Array.from(dbColleges.values()).find((c) => c.name === where.name);
      if (!existing) {
        existing = { id: `aaaaaaaa-0000-4000-8000-00000000009${dbColleges.size + 1}`, name: create.name, location: create.location || '' };
        dbColleges.set(existing.id, existing);
      }
      return existing;
    }),
  },
  department: {
    findMany: jest.fn(async () => Array.from(dbDepartments.values())),
    upsert: jest.fn(async ({ where, create }) => {
      let existing = Array.from(dbDepartments.values()).find((d) => d.name === where.name);
      if (!existing) {
        existing = { id: `bbbbbbbb-0000-4000-8000-00000000009${dbDepartments.size + 1}`, name: create.name };
        dbDepartments.set(existing.id, existing);
      }
      return existing;
    }),
  },
  skill: {
    upsert: jest.fn(async ({ where, create }) => {
      let existing = Array.from(dbSkills.values()).find((s) => s.name === where.name);
      if (!existing) {
        existing = {
          id: `cccccccc-0000-4000-8000-00000000010${skillSeq++}`,
          name: create.name,
          normalizedName: create.normalizedName || create.name,
        };
        dbSkills.set(existing.id, existing);
      }
      return existing;
    }),
  },
  userSkill: {
    deleteMany: jest.fn(async ({ where }) => {
      dbUserSkills = dbUserSkills.filter((us) => !(us.userId === where.userId && us.kind === where.kind));
      return { count: 1 };
    }),
    upsert: jest.fn(async ({ create }) => {
      const skill = dbSkills.get(create.skillId);
      const exists = dbUserSkills.find(
        (us) => us.userId === create.userId && us.skillId === create.skillId && us.kind === create.kind,
      );
      if (!exists) {
        const row = { userId: create.userId, skillId: create.skillId, kind: create.kind, skill };
        dbUserSkills.push(row);
        return row;
      }
      return exists;
    }),
  },
  matchRequest: {
    findMany: jest.fn(async ({ where }) => dbMatchRequests.filter(
      (r) => r.recipientId === where.recipientId && r.status === where.status,
    )),
    findFirst: jest.fn(async ({ where = {} }) => {
      // Yield a microtask so concurrent requests can race into create() to verify P2002 / unique protection
      await Promise.resolve();
      return dbMatchRequests.find((r) => {
        if (Array.isArray(where.OR)) {
          return where.OR.some((cond) => (
            r.requesterId === cond.requesterId
            && r.recipientId === cond.recipientId
            && r.status === cond.status
          ));
        }
        return r.requesterId === where.requesterId
          && r.recipientId === where.recipientId
          && r.status === where.status;
      }) || null;
    }),
    create: jest.fn(async ({ data }) => {
      // Enforce @@unique([requesterId, recipientId, status]) at the DB layer
      const dup = dbMatchRequests.find(
        (r) => r.requesterId === data.requesterId && r.recipientId === data.recipientId && r.status === data.status,
      );
      if (dup) {
        const err = new Error('Unique constraint failed on the fields: (`requesterId`,`recipientId`,`status`)');
        err.code = 'P2002';
        throw err;
      }
      const record = {
        id: `dddddddd-0000-4000-8000-00000000000${matchReqSeq++}`,
        requesterId: data.requesterId,
        recipientId: data.recipientId,
        sharedSkill: data.sharedSkill,
        status: data.status || 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      dbMatchRequests.push(record);
      return record;
    }),
  },
  chatThread: {
    findFirst: jest.fn(async ({ where = {} }) => {
      if (!Array.isArray(where.AND)) return null;
      return dbChatThreads.find((t) => where.AND.every(
        (cond) => t.participants.includes(cond.participants.some.userId),
      )) || null;
    }),
  },
  userFollow: {
    upsert: jest.fn(async ({ create }) => {
      const exists = dbUserFollows.find(
        (f) => f.followerId === create.followerId && f.followingId === create.followingId,
      );
      if (!exists) {
        const row = { followerId: create.followerId, followingId: create.followingId, createdAt: new Date() };
        dbUserFollows.push(row);
        return row;
      }
      return exists;
    }),
    deleteMany: jest.fn(async ({ where }) => {
      const before = dbUserFollows.length;
      dbUserFollows = dbUserFollows.filter(
        (f) => !(f.followerId === where.followerId && f.followingId === where.followingId),
      );
      return { count: before - dbUserFollows.length };
    }),
    findMany: jest.fn(async ({ where }) => dbUserFollows
      .filter((f) => f.followerId === where.followerId)
      .map((f) => ({
        ...f,
        following: hydrateUser(dbUsers.get(f.followingId)),
      }))),
  },
  $queryRaw: mockQueryRaw,
  $transaction: jest.fn(async (cb) => cb(mockPrisma)),
};

jest.mock('../src/config/prisma', () => ({
  prisma: mockPrisma,
  disconnectPrisma: jest.fn().mockResolvedValue(),
}));

const matchingEngine = require('../src/services/matchingEngine');
const matchRoutes = require('../src/routes/match');
const userRoutes = require('../src/routes/user');
const { globalErrorHandler } = require('../src/middleware/errorHandler');

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/match', matchRoutes);
  app.use('/api/user', userRoutes);
  app.use(globalErrorHandler);
  return app;
}

describe('Peer Matching Engine, Cache Invalidation, Filter Sync & Match Request Concurrency', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisStore.clear();
    seedInitialUsers();
    mockAuthActor = { id: USER_A_ID, clerkUserId: USER_A_CLERK, uid: USER_A_CLERK, name: 'User A' };
    app = createTestApp();
  });

  it('returns normalized complementary-skill matches from SQL rows and writes cache with 300s TTL', async () => {
    const result = await matchingEngine.findBroadMatches(USER_A_CLERK);

    expect(result).toHaveLength(1);
    expect(result[0].tutor.uid).toBe(USER_B_CLERK);
    expect(result[0].tutor.createdAt).toEqual(dbUsers.get(USER_B_ID).createdAt);
    expect(result[0].sharedSkills).toEqual(['DSA']);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      expect.stringContaining(`match-feed:v1:${USER_A_CLERK}`),
      expect.any(String),
      'EX',
      300,
    );
  });

  it('matches case-insensitively across "dsa" and "DSA" and normalizes skills on user creation/update', async () => {
    // User A learns "dsa" and User B teaches "DSA" in distinct Skill rows and different colleges
    const matches = await matchingEngine.findMatches(USER_A_CLERK);

    expect(matches).toHaveLength(1);
    expect(matches[0].tutor.uid).toBe(USER_B_CLERK);
    expect(matches[0].tutor.college).toBe('Stanford');
    expect(matches[0].tutor.department).toBe('Computer Science');
    expect(matches[0].sharedSkills).toEqual(['DSA']);

    // Verify SQL query uses LOWER(TRIM(s.name)) = LOWER(TRIM(req.name))
    const rawSqlStrings = mockQueryRaw.mock.calls[0][0].strings.join('?');
    expect(rawSqlStrings).toContain('LOWER(TRIM(s.name)) = LOWER(TRIM(req.name))');

    // Register/update profile with mixed-case duplicate skills -> normalized to .trim().toLowerCase()
    mockAuthActor = { id: USER_B_ID, clerkUserId: USER_B_CLERK, uid: USER_B_CLERK, name: 'User B' };
    const updateRes = await request(app)
      .put('/api/user/profile')
      .send({ teaches: ['  DSA  ', 'dsa', 'System Design'], learns: ['  React '] });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.teaches).toEqual(['dsa', 'system design']);
    expect(updateRes.body.data.learns).toEqual(['react']);
  });

  it('invalidates cached match feeds immediately when a peer registers or updates their skills (no 300s stale wait)', async () => {
    // Initially User A matches only User B
    const initialMatches = await matchingEngine.findMatches(USER_A_CLERK);
    expect(initialMatches.map((m) => m.tutor.uid)).toEqual([USER_B_CLERK]);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);

    // Second call hits Redis cache without querying Postgres
    const cachedMatches = await matchingEngine.findMatches(USER_A_CLERK);
    expect(cachedMatches.map((m) => m.tutor.uid)).toEqual([USER_B_CLERK]);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(mockRedisStore.size).toBeGreaterThan(0);

    // User C signs up / syncs teaching "DSA" -> triggers invalidateMatchingFeeds
    const USER_C_ID = '33333333-3333-4333-8333-333333333333';
    const USER_C_CLERK = 'user_c_clerk';
    mockAuthActor = { id: USER_C_ID, clerkUserId: USER_C_CLERK, uid: USER_C_CLERK, email: 'userc@example.com', name: 'User C' };

    const syncRes = await request(app)
      .post('/api/user/sync')
      .send({
        name: 'User C',
        college: 'MIT',
        department: 'Computer Science',
        year: '2',
        teaches: ['DSA'],
        learns: ['Python'],
      });

    expect(syncRes.status).toBe(200);
    expect(mockRedisStore.size).toBe(0);

    // Immediately re-query User A's matches -> sees User C right away without waiting 300s
    const refreshedMatches = await matchingEngine.findMatches(USER_A_CLERK);
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    expect(refreshedMatches.map((m) => m.tutor.uid)).toContain(USER_C_CLERK);
    expect(refreshedMatches.map((m) => m.tutor.uid)).toContain(USER_B_CLERK);
  });

  it('synchronizes college, department, year, minRating, and sortBy filters via GET /api/match/recommendations and supports exact ID search', async () => {
    const matchingRes = await request(app)
      .get('/api/match/recommendations?college=Stanford&department=Computer%20Science&year=3&minRating=4&sortBy=rating');

    expect(matchingRes.status).toBe(200);
    expect(matchingRes.body.success).toBe(true);
    expect(matchingRes.body.data).toHaveLength(1);
    expect(matchingRes.body.data[0].tutor.uid).toBe(USER_B_CLERK);

    const nonMatchingRes = await request(app)
      .get('/api/match/recommendations?college=Harvard&minRating=4.5');

    expect(nonMatchingRes.status).toBe(200);
    expect(nonMatchingRes.body.data).toEqual([]);

    // Exact User ID search (UUID and clerkUserId)
    const searchRes = await request(app).get(`/api/user/search?q=${USER_B_ID}`);
    expect(searchRes.status).toBe(200);
    const findManyArgs = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyArgs.where.OR).toEqual(
      expect.arrayContaining([
        { id: USER_B_ID },
        { clerkUserId: USER_B_ID },
      ]),
    );
  });

  it('is idempotent under 5 concurrent POST /api/match/request calls, creating exactly 1 DB record', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => request(app)
        .post('/api/match/request')
        .send({ toUid: USER_B_CLERK, sharedSkill: 'DSA' })),
    );

    expect(dbMatchRequests).toHaveLength(1);
    expect(responses.every((r) => r.body.success === true)).toBe(true);

    const createdResponses = responses.filter((r) => r.status === 201);
    const idempotentResponses = responses.filter((r) => r.status === 200);

    expect(createdResponses).toHaveLength(1);
    expect(createdResponses[0].body.alreadyRequested).toBe(false);
    expect(idempotentResponses).toHaveLength(4);
    for (const res of idempotentResponses) {
      expect(res.body.alreadyRequested).toBe(true);
      expect(res.body.data.requestId).toBe(dbMatchRequests[0].id);
    }

    expect(mockBroadcastToGlobal).toHaveBeenCalledTimes(1);
  });

  it('persists follow relationships via POST /api/user/:uid/follow, GET /:uid/following, and DELETE /:uid/follow', async () => {
    const followRes = await request(app).post(`/api/user/${USER_B_CLERK}/follow`);
    expect(followRes.status).toBe(200);
    expect(followRes.body.success).toBe(true);

    const followingRes = await request(app).get(`/api/user/${USER_A_CLERK}/following`);
    expect(followingRes.status).toBe(200);
    expect(followingRes.body.data.map((u) => u.uid)).toEqual([USER_B_CLERK]);

    const selfFollowRes = await request(app).post(`/api/user/${USER_A_CLERK}/follow`);
    expect(selfFollowRes.status).toBe(400);

    const unfollowRes = await request(app).delete(`/api/user/${USER_B_CLERK}/follow`);
    expect(unfollowRes.status).toBe(200);

    const afterUnfollowRes = await request(app).get(`/api/user/${USER_A_CLERK}/following`);
    expect(afterUnfollowRes.status).toBe(200);
    expect(afterUnfollowRes.body.data).toEqual([]);
  });

  it('Gate #3: preserves sortBy ordering on GET /api/match/:uid/broad without falling back to unordered findAnyMatches', async () => {
    const colStanford = dbColleges.get('aaaaaaaa-0000-4000-8000-000000000002');
    const deptCs = dbDepartments.get('bbbbbbbb-0000-4000-8000-000000000001');
    const skillUpper = dbSkills.get('cccccccc-0000-4000-8000-000000000002');
    const USER_Z_ID = '99999999-9999-4999-8999-999999999999';

    dbUsers.set(USER_Z_ID, {
      id: USER_Z_ID,
      clerkUserId: 'user_z_clerk',
      email: 'userz@example.com',
      name: 'Zed Tutor',
      photoUrl: null,
      collegeId: colStanford.id,
      college: colStanford,
      collegeLocation: 'Palo Alto',
      departmentId: deptCs.id,
      department: deptCs,
      year: '4',
      averageRating: 5.0,
      totalSessions: 20,
      latitude: null,
      longitude: null,
      deletedAt: null,
      profileComplete: true,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    dbUserSkills.push({ userId: USER_Z_ID, skillId: skillUpper.id, kind: 'TEACHES', skill: skillUpper });

    const nameSortedRes = await request(app)
      .get(`/api/match/${USER_A_CLERK}/broad?sortBy=name`);

    expect(nameSortedRes.status).toBe(200);
    expect(nameSortedRes.body.success).toBe(true);
    expect(nameSortedRes.body.data.map((m) => m.tutor.name)).toEqual(['User B', 'Zed Tutor']);

    // Even when broad query returns 0 rows, sort-only request must NOT fall into findAnyMatches
    mockRedisStore.clear();
    mockQueryRaw.mockResolvedValueOnce([]);
    mockPrisma.user.findMany.mockClear();

    const emptySortRes = await request(app)
      .get(`/api/match/${USER_A_CLERK}/broad?sortBy=name`);

    expect(emptySortRes.status).toBe(200);
    expect(emptySortRes.body.data).toEqual([]);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });
});
