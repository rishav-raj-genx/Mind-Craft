const mockUserBadges = [];
const mockBadgesTable = {};

const mockUser = {
  id: '00000000-0000-0000-0000-000000000099',
  clerkUserId: 'clerk-badge-user',
  name: 'Badge Tester',
  currentStreak: 7,
  longestStreak: 7,
  mindTokens: 150,
  averageRating: 4.9,
};

const mockPrisma = {
  user: {
    findFirst: jest.fn(async ({ where = {} }) => {
      if (where.clerkUserId === mockUser.clerkUserId || where.id === mockUser.id) return mockUser;
      if (Array.isArray(where.OR)) {
        const hit = where.OR.some((c) => c.clerkUserId === mockUser.clerkUserId || c.id === mockUser.id);
        if (hit) return mockUser;
      }
      return null;
    }),
    findUnique: jest.fn(async () => mockUser),
    findMany: jest.fn(async () => [{ id: mockUser.id }]),
    update: jest.fn(async ({ data }) => ({ ...mockUser, ...data })),
  },
  tutoringSession: {
    findMany: jest.fn(async () => []),
  },
  doubtAnswer: {
    count: jest.fn(async () => 0),
  },
  badge: {
    upsert: jest.fn(async ({ where, create, update }) => {
      const existing = mockBadgesTable[where.id];
      const next = existing ? { ...existing, ...update } : { ...create };
      mockBadgesTable[where.id] = next;
      return next;
    }),
  },
  userBadge: {
    findMany: jest.fn(async ({ where }) => {
      return mockUserBadges
        .filter((ub) => ub.userId === where.userId)
        .map((ub) => ({
          ...ub,
          badge: mockBadgesTable[ub.badgeId] || { name: ub.badgeId, level: ub.metadata?.level || 1 },
        }));
    }),
    upsert: jest.fn(async ({ where, create, update }) => {
      const key = where.userId_badgeId_auditWeek;
      const idx = mockUserBadges.findIndex(
        (ub) => ub.userId === key.userId && ub.badgeId === key.badgeId && ub.auditWeek === key.auditWeek,
      );
      if (idx >= 0) {
        mockUserBadges[idx] = { ...mockUserBadges[idx], ...update };
        return mockUserBadges[idx];
      }
      const created = {
        ...create,
        awardedAt: new Date(),
      };
      mockUserBadges.push(created);
      return created;
    }),
  },
  activityDay: {
    findMany: jest.fn(async () => []),
  },
  weeklyAuditRun: {
    upsert: jest.fn(async ({ create }) => ({
      id: 'run-1',
      status: 'RUNNING',
      lastUserId: null,
      ...create,
    })),
    update: jest.fn(async ({ data }) => ({ id: 'run-1', ...data })),
  },
  tokenTransaction: {
    findUnique: jest.fn(async () => null),
    create: jest.fn(async ({ data }) => ({ id: 'tx-weekly-1', ...data })),
  },
  $transaction: jest.fn(async (cb) => {
    if (typeof cb === 'function') return cb(mockPrisma);
    return Promise.all(cb);
  }),
};

jest.mock('../src/config/prisma', () => ({
  prisma: mockPrisma,
  disconnectPrisma: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/services/streakCalculator', () => ({
  calculateStreak: jest.fn(async () => ({
    currentStreak: 7,
    longestStreak: 7,
  })),
}));

const {
  calculateBadges,
  recordBadgeEarned,
  getBadgeHistory,
  BADGE_DEFINITIONS,
} = require('../src/services/badgeCalculator');
const { runWeeklyAudit, BONUS_TOKENS } = require('../src/services/weeklyWarriorService');

const SEEDED_BADGE_IDS = [
  'weekly_warrior',
  '7_day_streak',
  'spark_starter',
  'fortnight_focus',
  'monthly_master',
  'discipline_king',
  'century_legend',
  'master_tutor',
  'streak_champion',
  'session_pro',
  'dsa_master',
  'late_night_learner',
  'problem_solver',
  'mentor',
  'top_rated',
  'social_butterfly',
  'wealthy_mind',
];

describe('17-Badge Inventory Alignment & UserBadge Persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserBadges.length = 0;
    Object.keys(mockBadgesTable).forEach((k) => delete mockBadgesTable[k]);
  });

  it('has valid definitions for all 17 seeded badges', () => {
    expect(BADGE_DEFINITIONS).toHaveLength(17);

    const definedIds = BADGE_DEFINITIONS.map((b) => b.id);
    for (const expectedId of SEEDED_BADGE_IDS) {
      expect(definedIds).toContain(expectedId);
    }

    for (const def of BADGE_DEFINITIONS) {
      expect(typeof def.id).toBe('string');
      expect(typeof def.name).toBe('string');
      expect(typeof def.emoji).toBe('string');
      expect(typeof def.description).toBe('string');
      expect(typeof def.metric).toBe('string');
      expect(Array.isArray(def.thresholds)).toBe(true);
      expect(def.thresholds.length).toBeGreaterThan(0);
    }
  });

  it('persists newly unlocked badges into UserBadge and surfaces them in getBadgeHistory', async () => {
    const result = await calculateBadges('clerk-badge-user');

    expect(result.badges).toHaveLength(17);
    expect(result.totalEarned).toBeGreaterThanOrEqual(4); // streak_champion, spark_starter, 7_day_streak, wealthy_mind

    expect(mockPrisma.userBadge.upsert).toHaveBeenCalled();

    const history = await getBadgeHistory(mockUser.id);
    const earnedIds = history.map((h) => h.badgeId);
    expect(earnedIds).toContain('spark_starter');
    expect(earnedIds).toContain('7_day_streak');
    expect(earnedIds).toContain('streak_champion');
    expect(earnedIds).toContain('wealthy_mind');
    expect(result.badgeHistory).toEqual(history);
  });

  it('recordBadgeEarned creates a UserBadge record accessible via getBadgeHistory', async () => {
    const ok = await recordBadgeEarned('clerk-badge-user', 'master_tutor', 'Master Tutor', 2);
    expect(ok).toBe(true);

    const history = await getBadgeHistory(mockUser.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      badgeId: 'master_tutor',
      badgeName: 'Master Tutor',
      level: 2,
    });
  });

  it('weeklyWarriorService.runWeeklyAudit awards weekly_warrior badge and bonus tokens for perfect 7-day week', async () => {
    const weekDates = [
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ];
    mockPrisma.activityDay.findMany.mockResolvedValueOnce(
      weekDates.map((d) => ({ activityDate: new Date(`${d}T00:00:00.000Z`) })),
    );
    mockPrisma.user.findMany
      .mockResolvedValueOnce([{ id: mockUser.id }])
      .mockResolvedValueOnce([]);

    const runResult = await runWeeklyAudit({ weekDates, weekKey: `${weekDates[0]}_${weekDates[6]}` });

    expect(runResult.status).toBe('COMPLETED');
    expect(mockPrisma.userBadge.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: mockUser.id,
          badgeId: 'weekly_warrior',
        }),
      }),
    );
    expect(mockPrisma.tokenTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: mockUser.id,
          amount: BONUS_TOKENS,
          reason: 'weekly_warrior_bonus',
        }),
      }),
    );
  });
});
