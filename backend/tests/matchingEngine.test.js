jest.mock('../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('../src/services/matchingCache', () => ({
  getCachedFeed: jest.fn().mockResolvedValue(null),
  setCachedFeed: jest.fn().mockResolvedValue(undefined),
}));

const { prisma } = require('../src/config/prisma');
const { findBroadMatches } = require('../src/services/matchingEngine');

describe('SQL matching engine', () => {
  beforeEach(() => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'requester-id',
      updatedAt: new Date('2026-01-01'),
    });
    prisma.$queryRaw.mockResolvedValue([{
      id: 'candidate-id',
      clerkUserId: 'candidate-clerk-id',
      name: 'Candidate',
      email: 'candidate@example.com',
      photoUrl: null,
      collegeId: 'college-id',
      departmentId: null,
      year: '2nd Year',
      averageRating: 4.5,
      totalSessions: 3,
      latitude: null,
      longitude: null,
      sharedSkills: ['Python'],
      sharedSkillCount: 1,
      activityScore: 2,
      sameCollege: true,
      compatibilityScore: 9.2,
    }]);
  });

  it('returns normalized complementary-skill matches from SQL rows', async () => {
    const result = await findBroadMatches('requester-clerk-id');
    expect(result).toHaveLength(1);
    expect(result[0].tutor.uid).toBe('candidate-clerk-id');
    expect(result[0].sharedSkills).toEqual(['Python']);
    expect(result[0].compatibilityScore).toBe(9.2);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
