const { Prisma } = require('@prisma/client');
const { prisma } = require('../config/prisma');
const { getCachedFeed, setCachedFeed } = require('./matchingCache');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function clampLimit(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), MAX_LIMIT) : DEFAULT_LIMIT;
}

function normalizeMatch(row) {
  return {
    tutor: {
      id: row.id,
      uid: row.clerkUserId,
      name: row.name,
      email: row.email,
      photoUrl: row.photoUrl,
      collegeId: row.collegeId,
      departmentId: row.departmentId,
      year: row.year,
      averageRating: Number(row.averageRating || 0),
      totalSessions: Number(row.totalSessions || 0),
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
    },
    sharedSkills: row.sharedSkills || [],
    sharedSkillCount: Number(row.sharedSkillCount || 0),
    activityScore: Number(row.activityScore || 0),
    sameCollege: Boolean(row.sameCollege),
    compatibilityScore: Number(row.compatibilityScore || 0),
  };
}

function encodeCursor(row) {
  return Buffer.from(JSON.stringify({
    score: row.compatibilityScore,
    sharedSkillCount: row.sharedSkillCount,
    totalSessions: row.tutor.totalSessions,
    averageRating: row.tutor.averageRating,
    id: row.tutor.id,
  })).toString('base64url');
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!value.id || !Number.isFinite(Number(value.score))) return null;
    return value;
  } catch (_error) {
    return null;
  }
}

async function findMatches(uid, options = {}) {
  return queryMatches(uid, { ...options, sameCollegeOnly: true });
}

async function findBroadMatches(uid, limit = DEFAULT_LIMIT, offset = 0, skillFilter = null) {
  return queryMatches(uid, {
    limit,
    offset,
    skillFilter,
    sameCollegeOnly: false,
  });
}

async function findAnyMatches(uid, limit = DEFAULT_LIMIT, offset = 0) {
  const user = await prisma.user.findUnique({
    where: { clerkUserId: uid },
    select: { id: true },
  });
  if (!user) return [];

  const rows = await prisma.user.findMany({
    where: {
      id: { not: user.id },
      deletedAt: null,
    },
    orderBy: [
      { averageRating: 'desc' },
      { totalSessions: 'desc' },
      { id: 'asc' },
    ],
    skip: Math.max(Number(offset) || 0, 0),
    take: clampLimit(limit),
    select: {
      id: true,
      clerkUserId: true,
      name: true,
      email: true,
      photoUrl: true,
      collegeId: true,
      departmentId: true,
      year: true,
      averageRating: true,
      totalSessions: true,
      latitude: true,
      longitude: true,
    },
  });

  return rows.map((row) => normalizeMatch({
    ...row,
    sharedSkills: [],
    sharedSkillCount: 0,
    activityScore: 0,
    sameCollege: false,
    compatibilityScore: 0,
  }));
}

async function getUserSkillGraph(uid) {
  const user = await prisma.user.findUnique({
    where: { clerkUserId: uid },
    select: {
      skills: {
        select: { kind: true, skill: { select: { name: true } } },
      },
    },
  });

  return {
    teaches: (user?.skills || []).filter((item) => item.kind === 'TEACHES').map((item) => item.skill.name),
    learns: (user?.skills || []).filter((item) => item.kind === 'LEARNS').map((item) => item.skill.name),
  };
}

async function queryMatches(uid, options = {}) {
  const limit = clampLimit(options.limit);
  const offset = Math.max(Number(options.offset) || 0, 0);
  const skillFilter = options.skillFilter || null;
  const sameCollegeOnly = Boolean(options.sameCollegeOnly);
  const cursor = decodeCursor(options.cursor);

  const requester = await prisma.user.findUnique({
    where: { clerkUserId: uid },
    select: { id: true, updatedAt: true },
  });
  if (!requester) return [];

  const cacheKey = [
    'match-feed:v1',
    uid,
    requester.updatedAt.getTime(),
    sameCollegeOnly ? 'strict' : 'broad',
    skillFilter || 'all',
    options.cursor || offset,
  ].join(':');
  const cached = await getCachedFeed(cacheKey);
  if (cached) return cached;

  const cursorParams = cursor
    ? Prisma.sql`
      AND (
        score.compatibility_score < ${Number(cursor.score)}
        OR (
          score.compatibility_score = ${Number(cursor.score)}
          AND score.shared_skill_count < ${Number(cursor.sharedSkillCount)}
        )
        OR (
          score.compatibility_score = ${Number(cursor.score)}
          AND score.shared_skill_count = ${Number(cursor.sharedSkillCount)}
          AND score.total_sessions < ${Number(cursor.totalSessions)}
        )
        OR (
          score.compatibility_score = ${Number(cursor.score)}
          AND score.shared_skill_count = ${Number(cursor.sharedSkillCount)}
          AND score.total_sessions = ${Number(cursor.totalSessions)}
          AND score.average_rating < ${Number(cursor.averageRating)}
        )
        OR (
          score.compatibility_score = ${Number(cursor.score)}
          AND score.shared_skill_count = ${Number(cursor.sharedSkillCount)}
          AND score.total_sessions = ${Number(cursor.totalSessions)}
          AND score.average_rating = ${Number(cursor.averageRating)}
          AND score.id > ${cursor.id}
        )
      )
    `
    : Prisma.empty;

  const rows = await prisma.$queryRaw(Prisma.sql`
    WITH requester AS (
      SELECT
        u.id,
        u."collegeId" AS college_id,
        COUNT(us."skillId") FILTER (WHERE us.kind = 'LEARNS')::numeric AS learning_count,
        COUNT(us."skillId") FILTER (WHERE us.kind = 'TEACHES')::numeric AS teaching_count
      FROM "User" u
      LEFT JOIN "UserSkill" us ON us."userId" = u.id
      WHERE u.id = ${requester.id}::uuid
      GROUP BY u.id
    ),
    overlap AS (
      SELECT
        candidate."userId" AS candidate_id,
        candidate."skillId" AS skill_id,
        skill.name,
        candidate.kind
      FROM "UserSkill" requested
      JOIN "UserSkill" candidate
        ON candidate."skillId" = requested."skillId"
       AND candidate.kind <> requested.kind
      JOIN "Skill" skill ON skill.id = candidate."skillId"
      WHERE requested."userId" = ${requester.id}::uuid
        AND candidate."userId" <> ${requester.id}::uuid
        AND (${skillFilter}::text IS NULL OR skill.name = ${skillFilter})
    ),
    grouped AS (
      SELECT
        candidate_id,
        COUNT(DISTINCT skill_id)::numeric AS shared_skill_count,
        ARRAY_AGG(DISTINCT name ORDER BY name) AS shared_skills
      FROM overlap
      GROUP BY candidate_id
    ),
    score AS (
      SELECT
        u.id,
        u."clerkUserId",
        u.email,
        u.name,
        u."photoUrl",
        u."collegeId" AS college_id,
        u."departmentId" AS department_id,
        u.year,
        u."averageRating"::numeric AS average_rating,
        u."totalSessions" AS total_sessions,
        u.latitude,
        u.longitude,
        grouped.shared_skills,
        grouped.shared_skill_count,
        (u."collegeId" = requester.college_id) AS same_college,
        LEAST(COUNT(teaching."skillId")::numeric / 10, 1) AS activity_score,
        (
          0.45 * LEAST(
            grouped.shared_skill_count /
            GREATEST(requester.learning_count + requester.teaching_count, 1),
            1
          )
          + 0.25 * LEAST(
            grouped.shared_skill_count /
            GREATEST((requester.learning_count + requester.teaching_count) * 2, 1),
            1
          )
          + 0.15 * CASE WHEN u."collegeId" = requester.college_id THEN 1 ELSE 0 END
          + 0.10 * LEAST(COUNT(teaching."skillId")::numeric / 10, 1)
          + 0.05 * LEAST(u."averageRating"::numeric / 5, 1)
        ) AS compatibility_score
      FROM grouped
      JOIN "User" u ON u.id = grouped.candidate_id
      CROSS JOIN requester
      LEFT JOIN "UserSkill" teaching
        ON teaching."userId" = u.id
       AND teaching.kind = 'TEACHES'
      WHERE u."deletedAt" IS NULL
        AND (${sameCollegeOnly}::boolean = false OR u."collegeId" = requester.college_id)
      GROUP BY
        u.id, requester.college_id, requester.learning_count,
        requester.teaching_count, grouped.shared_skills,
        grouped.shared_skill_count
    )
    SELECT
      id,
      "clerkUserId" AS "clerkUserId",
      email,
      name,
      "photoUrl" AS "photoUrl",
      college_id AS "collegeId",
      department_id AS "departmentId",
      year,
      average_rating AS "averageRating",
      total_sessions AS "totalSessions",
      latitude,
      longitude,
      shared_skills AS "sharedSkills",
      shared_skill_count AS "sharedSkillCount",
      same_college AS "sameCollege",
      activity_score AS "activityScore",
      compatibility_score AS "compatibilityScore"
    FROM score
    ${cursorParams}
    ORDER BY compatibility_score DESC, shared_skill_count DESC,
      total_sessions DESC, average_rating DESC, id ASC
    OFFSET ${cursor ? 0 : offset}
    LIMIT ${limit}
  `);

  const result = rows.map(normalizeMatch);
  await setCachedFeed(cacheKey, result);
  return result;
}

module.exports = {
  findMatches,
  findBroadMatches,
  findAnyMatches,
  getUserSkillGraph,
  encodeCursor,
};
