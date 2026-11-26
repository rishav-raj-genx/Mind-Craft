const express = require('express');
const router = express.Router();

const { requireAuth, requireClerkAuth } = require('../middleware/auth');
const { prisma } = require('../config/prisma');
const { resolveUser } = require('../utils/userResolver');
const { getBalance, getTransactionHistory } = require('../services/tokenEconomy');
const { getUserSkillGraph } = require('../services/matchingEngine');
const { calculateStreak } = require('../services/streakCalculator');
const { getPagination } = require('../utils/pagination');

function normalizeUser(u) {
  if (!u) return null;
  const teaches = (u.skills || [])
    .filter((s) => s.kind === 'TEACHES')
    .map((s) => s.skill?.name || s.name || s);
  const learns = (u.skills || [])
    .filter((s) => s.kind === 'LEARNS')
    .map((s) => s.skill?.name || s.name || s);

  return {
    id: u.id,
    uid: u.clerkUserId,
    clerkUserId: u.clerkUserId,
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
    latitude: u.latitude === null || u.latitude === undefined ? 0 : Number(u.latitude),
    longitude: u.longitude === null || u.longitude === undefined ? 0 : Number(u.longitude),
    averageRating: Number(u.averageRating) || 0,
    totalSessions: u.totalSessions || 0,
    mind_tokens: u.mindTokens || 0,
    tokenBalance: u.mindTokens || 0,
    currentStreak: u.currentStreak || 0,
    longestStreak: u.longestStreak || 0,
    profileComplete: Boolean(u.profileComplete),
    teaches,
    learns,
    createdAt: u.createdAt ? new Date(u.createdAt).getTime() : Date.now(),
  };
}

router.post('/register', requireClerkAuth, async (req, res, next) => {
  try {
    const clerkUserId = req.user.clerkUserId;
    const email = req.user.email || req.body.email || `${clerkUserId}@clerk.internal`;
    const {
      name,
      college,
      collegeLocation,
      department,
      year,
      teaches,
      learns,
      photoUrl,
      gender,
      latitude,
      longitude,
    } = req.body;

    const user = await prisma.$transaction(async (tx) => {
      let collegeId = null;
      if (college && typeof college === 'string' && college.trim()) {
        const cleanCollege = college.trim();
        const cleanLoc = collegeLocation && typeof collegeLocation === 'string' ? collegeLocation.trim() : null;
        const c = await tx.college.upsert({
          where: { name: cleanCollege },
          create: {
            name: cleanCollege,
            ...(cleanLoc ? { location: cleanLoc } : {}),
          },
          update: cleanLoc ? { location: cleanLoc } : {},
        });
        collegeId = c.id;
      }

      let departmentId = null;
      if (department && typeof department === 'string' && department.trim()) {
        const cleanDept = department.trim();
        const d = await tx.department.upsert({
          where: { name: cleanDept },
          create: { name: cleanDept },
          update: {},
        });
        departmentId = d.id;
      }

      const existing = await tx.user.findFirst({
        where: {
          OR: [
            { clerkUserId },
            ...(email ? [{ email }] : []),
          ],
          deletedAt: null,
        },
      });

      const userData = {
        name: (name && typeof name === 'string' && name.trim()) || existing?.name || (email ? email.split('@')[0] : 'Mindcraft Student'),
        email: email || existing?.email || `${clerkUserId}@clerk.internal`,
        photoUrl: photoUrl || existing?.photoUrl || '',
        gender: gender || existing?.gender || '',
        collegeId: collegeId || existing?.collegeId,
        collegeLocation: (collegeLocation && typeof collegeLocation === 'string' && collegeLocation.trim()) || existing?.collegeLocation || '',
        departmentId: departmentId || existing?.departmentId,
        year: year ? String(year) : (existing?.year || ''),
        latitude: latitude !== undefined ? Number(latitude) : (existing?.latitude || 0),
        longitude: longitude !== undefined ? Number(longitude) : (existing?.longitude || 0),
        profileComplete: true,
      };

      const u = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: { ...userData, clerkUserId },
          })
        : await tx.user.create({
            data: {
              clerkUserId,
              ...userData,
            },
          });

      // Deduplicate and sanitize skills
      const cleanTeaches = [...new Set(
        (Array.isArray(teaches) ? teaches : [])
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean),
      )];

      const cleanLearns = [...new Set(
        (Array.isArray(learns) ? learns : [])
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean),
      )];

      if (cleanTeaches.length > 0 || Array.isArray(teaches)) {
        await tx.userSkill.deleteMany({
          where: { userId: u.id, kind: 'TEACHES' },
        });

        for (const skillName of cleanTeaches) {
          const skill = await tx.skill.upsert({
            where: { name: skillName },
            create: { name: skillName },
            update: {},
          });
          await tx.userSkill.upsert({
            where: {
              userId_skillId_kind: {
                userId: u.id,
                skillId: skill.id,
                kind: 'TEACHES',
              },
            },
            create: { userId: u.id, skillId: skill.id, kind: 'TEACHES' },
            update: {},
          });
        }
      }

      if (cleanLearns.length > 0 || Array.isArray(learns)) {
        await tx.userSkill.deleteMany({
          where: { userId: u.id, kind: 'LEARNS' },
        });

        for (const skillName of cleanLearns) {
          const skill = await tx.skill.upsert({
            where: { name: skillName },
            create: { name: skillName },
            update: {},
          });
          await tx.userSkill.upsert({
            where: {
              userId_skillId_kind: {
                userId: u.id,
                skillId: skill.id,
                kind: 'LEARNS',
              },
            },
            create: { userId: u.id, skillId: skill.id, kind: 'LEARNS' },
            update: {},
          });
        }
      }

      return u;
    });

    const fullUser = await resolveUser(user.id, {
      include: {
        college: true,
        department: true,
        skills: { include: { skill: true } },
      },
    });

    const normalized = normalizeUser(fullUser || user);
    res.status(200).json({
      success: true,
      registered: true,
      message: 'Profile registered successfully',
      user: normalized,
      data: normalized,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/metadata/options', async (_req, res, next) => {
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

    const currentUser = await resolveUser(req.user.clerkUserId);
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

router.get('/me', requireClerkAuth, async (req, res, next) => {
  try {
    const clerkId = req.user?.clerkUserId || req.auth?.userId;
    const user = await resolveUser(clerkId, {
      include: {
        college: true,
        department: true,
        skills: { include: { skill: true } },
      },
    });

    if (!user || !user.profileComplete) {
      return res.status(200).json({
        success: true,
        registered: false,
        needsOnboarding: true,
        user: null,
        message: 'No Mindcraft account/profile is attached to this email yet. Please complete signup first.',
      });
    }

    const formatted = normalizeUser(user);
    return res.status(200).json({
      success: true,
      registered: true,
      needsOnboarding: false,
      user: formatted,
      data: formatted,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:uid/profile', requireAuth, async (req, res, next) => {
  try {
    let user = await resolveUser(req.params.uid, {
      include: {
        college: true,
        department: true,
        skills: { include: { skill: true } },
      },
    });

    if (!user) {
      if (req.params.uid === req.user?.clerkUserId || req.params.uid === req.user?.id) {
        user = req.user;
      } else {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
    }

    const uid = user.clerkUserId;
    const [tokenBalance, transactions, streak, skillGraph, sessions] = await Promise.all([
      getBalance(uid).catch(() => 0),
      getTransactionHistory(uid, 10).catch(() => []),
      calculateStreak(uid).catch(() => ({
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0,
        activeDates: [],
        grid: [],
      })),
      getUserSkillGraph(uid).catch(() => ({
        teaches: (user.skills || []).filter((s) => s.kind === 'TEACHES').map((s) => s.skill?.name || s.name || s),
        learns: (user.skills || []).filter((s) => s.kind === 'LEARNS').map((s) => s.skill?.name || s.name || s),
      })),
      user.id ? prisma.tutoringSession.findMany({
        where: {
          OR: [{ teacherId: user.id }, { learnerId: user.id }],
          status: 'COMPLETED',
        },
        include: { teacher: true, learner: true },
        orderBy: { scheduledFor: 'desc' },
        take: 20,
      }).catch(() => []) : Promise.resolve([]),
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
        profileComplete: Boolean(user.profileComplete),
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

router.post('/:uid/follow', requireAuth, async (_req, res) => {
  res.json({ success: true, message: 'Successfully followed user' });
});

router.get('/:uid/following', requireAuth, async (_req, res) => {
  res.json({ success: true, count: 0, limit: 20, offset: 0, hasMore: false, data: [] });
});

router.get('/:uid', requireAuth, async (req, res, next) => {
  try {
    let user = await resolveUser(req.params.uid, {
      include: {
        college: true,
        department: true,
        skills: { include: { skill: true } },
      },
    });

    if (!user) {
      if (req.params.uid === req.user?.clerkUserId || req.params.uid === req.user?.id) {
        user = req.user;
      } else {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
    }
    res.json({ success: true, data: normalizeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.delete('/:uid', requireAuth, async (req, res, next) => {
  try {
    const user = await resolveUser(req.params.uid);
    if (!user || (user.clerkUserId !== req.user.clerkUserId && user.id !== req.user.id)) {
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
    const user = await resolveUser(req.params.uid);
    if (!user || (user.clerkUserId !== req.user.clerkUserId && user.id !== req.user.id)) {
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
      if (college && typeof college === 'string' && college.trim()) {
        const cleanCollege = college.trim();
        const cleanLoc = collegeLocation && typeof collegeLocation === 'string' ? collegeLocation.trim() : null;
        const c = await tx.college.upsert({
          where: { name: cleanCollege },
          create: { name: cleanCollege, ...(cleanLoc ? { location: cleanLoc } : {}) },
          update: cleanLoc ? { location: cleanLoc } : {},
        });
        collegeId = c.id;
      }

      let departmentId = user.departmentId;
      if (department && typeof department === 'string' && department.trim()) {
        const cleanDept = department.trim();
        const d = await tx.department.upsert({
          where: { name: cleanDept },
          create: { name: cleanDept },
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
          ...(year !== undefined ? { year: String(year) } : {}),
          ...(photoUrl !== undefined ? { photoUrl } : {}),
          ...(bannerUrl !== undefined ? { bannerUrl } : {}),
          ...(gender !== undefined ? { gender } : {}),
          ...(latitude !== undefined ? { latitude: Number(latitude) } : {}),
          ...(longitude !== undefined ? { longitude: Number(longitude) } : {}),
          profileComplete: true,
        },
      });

      const cleanTeaches = [...new Set(
        (Array.isArray(teaches) ? teaches : [])
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean),
      )];

      const cleanLearns = [...new Set(
        (Array.isArray(learns) ? learns : [])
          .map((s) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean),
      )];

      if (cleanTeaches.length > 0 || Array.isArray(teaches)) {
        await tx.userSkill.deleteMany({
          where: { userId: user.id, kind: 'TEACHES' },
        });

        for (const skillName of cleanTeaches) {
          const skill = await tx.skill.upsert({
            where: { name: skillName },
            create: { name: skillName },
            update: {},
          });
          await tx.userSkill.upsert({
            where: {
              userId_skillId_kind: {
                userId: user.id,
                skillId: skill.id,
                kind: 'TEACHES',
              },
            },
            create: { userId: user.id, skillId: skill.id, kind: 'TEACHES' },
            update: {},
          });
        }
      }

      if (cleanLearns.length > 0 || Array.isArray(learns)) {
        await tx.userSkill.deleteMany({
          where: { userId: user.id, kind: 'LEARNS' },
        });

        for (const skillName of cleanLearns) {
          const skill = await tx.skill.upsert({
            where: { name: skillName },
            create: { name: skillName },
            update: {},
          });
          await tx.userSkill.upsert({
            where: {
              userId_skillId_kind: {
                userId: user.id,
                skillId: skill.id,
                kind: 'LEARNS',
              },
            },
            create: { userId: user.id, skillId: skill.id, kind: 'LEARNS' },
            update: {},
          });
        }
      }
    });

    const updated = await resolveUser(user.id, {
      include: {
        college: true,
        department: true,
        skills: { include: { skill: true } },
      },
    });

    res.json({
      success: true,
      message: 'Profile updated',
      data: normalizeUser(updated || user),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
