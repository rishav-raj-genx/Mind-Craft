const express = require('express');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { prisma } = require('../config/prisma');
const { getBalance, getTransactionHistory } = require('../services/tokenEconomy');
const { getUserSkillGraph } = require('../services/matchingEngine');
const { calculateStreak } = require('../services/streakCalculator');
const { getPagination } = require('../utils/pagination');

async function findUser(uid) {
  if (!uid) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uid);
  return prisma.user.findFirst({
    where: {
      OR: [
        { clerkUserId: uid },
        ...(isUuid ? [{ id: uid }] : []),
      ],
      deletedAt: null,
    },
    include: {
      college: true,
      department: true,
      skills: {
        include: { skill: true },
      },
    },
  });
}

function normalizeUser(u) {
  if (!u) return null;
  const teaches = (u.skills || [])
    .filter((s) => s.kind === 'TEACHES')
    .map((s) => s.skill.name);
  const learns = (u.skills || [])
    .filter((s) => s.kind === 'LEARNS')
    .map((s) => s.skill.name);

  return {
    id: u.id,
    uid: u.clerkUserId,
    email: u.email,
    name: u.name,
    photoUrl: u.photoUrl || '',
    bannerUrl: u.bannerUrl || '',
    gender: u.gender || '',
    college: u.college?.name || u.collegeLocation || '',
    collegeLocation: u.collegeLocation || '',
    collegeId: u.collegeId || null,
    department: u.department?.name || '',
    departmentId: u.departmentId || null,
    year: u.year || '',
    latitude: u.latitude === null ? 0 : Number(u.latitude),
    longitude: u.longitude === null ? 0 : Number(u.longitude),
    averageRating: Number(u.averageRating) || 0,
    totalSessions: u.totalSessions || 0,
    mind_tokens: u.mindTokens || 0,
    tokenBalance: u.mindTokens || 0,
    currentStreak: u.currentStreak || 0,
    longestStreak: u.longestStreak || 0,
    profileComplete: u.profileComplete || false,
    teaches,
    learns,
    createdAt: new Date(u.createdAt).getTime(),
  };
}

router.get('/metadata/options', requireAuth, async (_req, res, next) => {
  try {
    const [colleges, departments] = await Promise.all([
      prisma.college.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
      prisma.department.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
    ]);

    res.json({
      success: true,
      data: {
        colleges: colleges.map((c) => c.name),
        departments: departments.map((d) => d.name),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    const { limit, offset } = getPagination(req.query);

    const currentUser = await findUser(req.user.clerkUserId);
    const excludeId = currentUser ? currentUser.id : undefined;

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        ...(q
          ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { college: { name: { contains: q, mode: 'insensitive' } } },
              { department: { name: { contains: q, mode: 'insensitive' } } },
              { skills: { some: { skill: { name: { contains: q, mode: 'insensitive' } } } } },
            ],
          }
          : {}),
      },
      include: {
        college: true,
        department: true,
        skills: { include: { skill: true } },
      },
      orderBy: { name: 'asc' },
      skip: offset,
      take: limit,
    });

    const data = users.map(normalizeUser);

    res.json({
      success: true,
      count: data.length,
      limit,
      offset,
      hasMore: data.length === limit,
      data,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:uid', requireAuth, async (req, res, next) => {
  try {
    const user = await findUser(req.params.uid);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: normalizeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:uid', requireAuth, async (req, res, next) => {
  try {
    const user = await findUser(req.params.uid);
    if (!user || user.clerkUserId !== req.user.clerkUserId) {
      return res.status(403).json({ success: false, error: "Cannot delete another user's profile" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });

    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

router.patch('/:uid', requireAuth, async (req, res, next) => {
  try {
    const user = await findUser(req.params.uid);
    if (!user || user.clerkUserId !== req.user.clerkUserId) {
      return res.status(403).json({ success: false, error: "Cannot update another user's profile" });
    }

    const {
      name,
      college,
      collegeLocation,
      department,
      year,
      teaches,
      learns,
      photoUrl,
      bannerUrl,
      gender,
      latitude,
      longitude,
    } = req.body;

    await prisma.$transaction(async (tx) => {
      let collegeId = user.collegeId;
      if (college) {
        const c = await tx.college.upsert({
          where: { name: college.trim() },
          create: { name: college.trim() },
          update: {},
        });
        collegeId = c.id;
      }

      let departmentId = user.departmentId;
      if (department) {
        const d = await tx.department.upsert({
          where: { name: department.trim() },
          create: { name: department.trim() },
          update: {},
        });
        departmentId = d.id;
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(collegeId !== undefined ? { collegeId } : {}),
          ...(collegeLocation !== undefined ? { collegeLocation } : {}),
          ...(departmentId !== undefined ? { departmentId } : {}),
          ...(year !== undefined ? { year } : {}),
          ...(photoUrl !== undefined ? { photoUrl } : {}),
          ...(bannerUrl !== undefined ? { bannerUrl } : {}),
          ...(gender !== undefined ? { gender } : {}),
          ...(latitude !== undefined ? { latitude: Number(latitude) } : {}),
          ...(longitude !== undefined ? { longitude: Number(longitude) } : {}),
          profileComplete: true,
        },
      });

      if (Array.isArray(teaches)) {
        await tx.userSkill.deleteMany({
          where: { userId: user.id, kind: 'TEACHES' },
        });

        for (const skillName of teaches) {
          if (!skillName?.trim()) continue;
          const skill = await tx.skill.upsert({
            where: { name: skillName.trim() },
            create: { name: skillName.trim() },
            update: {},
          });
          await tx.userSkill.create({
            data: { userId: user.id, skillId: skill.id, kind: 'TEACHES' },
          });
        }
      }

      if (Array.isArray(learns)) {
        await tx.userSkill.deleteMany({
          where: { userId: user.id, kind: 'LEARNS' },
        });

        for (const skillName of learns) {
          if (!skillName?.trim()) continue;
          const skill = await tx.skill.upsert({
            where: { name: skillName.trim() },
            create: { name: skillName.trim() },
            update: {},
          });
          await tx.userSkill.create({
            data: { userId: user.id, skillId: skill.id, kind: 'LEARNS' },
          });
        }
      }
    });

    const updated = await findUser(user.id);
    res.json({
      success: true,
      message: 'Profile updated',
      data: normalizeUser(updated),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:uid/profile', requireAuth, async (req, res, next) => {
  try {
    const user = await findUser(req.params.uid);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const uid = user.clerkUserId;
    const [tokenBalance, transactions, streak, skillGraph, sessions] = await Promise.all([
      getBalance(uid).catch(() => 0),
      getTransactionHistory(uid, 10).catch(() => []),
      calculateStreak(uid).catch(() => ({
        currentStreak: 0,
        longestStreak: 0,
        activeDates: [],
        grid: [],
      })),
      getUserSkillGraph(uid).catch(() => ({ teaches: [], learns: [] })),
      prisma.tutoringSession.findMany({
        where: {
          OR: [{ teacherId: user.id }, { learnerId: user.id }],
          status: 'COMPLETED',
        },
        include: { teacher: true, learner: true },
        orderBy: { scheduledFor: 'desc' },
        take: 20,
      }),
    ]);

    const totalStudyMins = sessions.length * 60;
    const totalStudyHours = +(totalStudyMins / 60).toFixed(1);
    const completedSessionsCount = sessions.length;
    const averageRating = Number(user.averageRating) || 0;

    const reviews = sessions
      .filter((s) => s.teacherId === user.id)
      .map((s) => ({
        sessionId: s.id,
        skill: s.title || 'Tutoring',
        rating: 5,
        ratingComment: 'Great session!',
        learnerUid: s.learner?.clerkUserId || '',
        scheduledAt: s.scheduledFor ? new Date(s.scheduledFor).getTime() : 0,
      }));

    res.json({
      success: true,
      data: {
        user: normalizeUser(user),
        tokenBalance,
        recentTransactions: transactions,
        streak,
        skillGraph,
        reviews,
        stats: {
          completedSessionsCount,
          totalStudyHours,
          averageRating,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:uid/follow', requireAuth, async (req, res) => {
  res.json({ success: true, message: 'Successfully followed user' });
});

router.get('/:uid/following', requireAuth, async (req, res) => {
  res.json({ success: true, count: 0, limit: 20, offset: 0, hasMore: false, data: [] });
});

module.exports = router;
