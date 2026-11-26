const express = require('express');
const router = express.Router();

const { requireAuth, requireClerkAuth } = require('../middleware/auth');
const { prisma } = require('../config/prisma');
const { resolveUser, isUuid } = require('../utils/userResolver');
const { getBalance, getTransactionHistory } = require('../services/tokenEconomy');
const { getUserSkillGraph } = require('../services/matchingEngine');
const { invalidateMatchingFeeds } = require('../services/matchingCache');
const { calculateStreak, recordCheckIn } = require('../services/streakCalculator');
const { getPagination } = require('../utils/pagination');

async function safeInvalidateMatchingFeeds(userId) {
  if (typeof invalidateMatchingFeeds === 'function') {
    await invalidateMatchingFeeds(userId);
  }
}
function normalizeSkillNames(skills) {
  return [...new Set(
    (Array.isArray(skills) ? skills : [])
      .map((s) => (typeof s === 'string' ? s.trim().toLowerCase() : ''))
      .filter(Boolean),
  )];
}

async function replaceUserSkills(tx, userId, kind, skills) {
  if (!Array.isArray(skills)) return;
  const normalizedSkills = normalizeSkillNames(skills);
  await tx.userSkill.deleteMany({
    where: { userId, kind },
  });

  for (const skillName of normalizedSkills) {
    const skill = await tx.skill.upsert({
      where: { name: skillName },
      create: { name: skillName, normalizedName: skillName },
      update: { normalizedName: skillName },
    });
    await tx.userSkill.upsert({
      where: {
        userId_skillId_kind: {
          userId,
          skillId: skill.id,
          kind,
        },
      },
      create: { userId, skillId: skill.id, kind },
      update: {},
    });
  }
}

async function upsertCollegeAndDepartment(tx, college, collegeLocation, department, defaults = {}) {
  let collegeId = defaults.collegeId ?? null;
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

  let departmentId = defaults.departmentId ?? null;
  if (department && typeof department === 'string' && department.trim()) {
    const cleanDept = department.trim();
    const d = await tx.department.upsert({
      where: { name: cleanDept },
      create: { name: cleanDept },
      update: {},
    });
    departmentId = d.id;
  }

  return { collegeId, departmentId };
}

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
    isActive: !u.deletedAt,
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
      const { collegeId, departmentId } = await upsertCollegeAndDepartment(tx, college, collegeLocation, department);

      const existing = await tx.user.findFirst({
        where: {
          OR: [
            { clerkUserId },
            ...(email ? [{ email }] : []),
          ],
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
            data: {
              ...userData,
              clerkUserId,
              deletedAt: null,
            },
          })
        : await tx.user.create({
            data: {
              clerkUserId,
              ...userData,
              deletedAt: null,
            },
          });

      await replaceUserSkills(tx, u.id, 'TEACHES', teaches);
      await replaceUserSkills(tx, u.id, 'LEARNS', learns);

      return u;
    });

    await safeInvalidateMatchingFeeds(user.id);

    try {
      const regUid = user.clerkUserId || clerkUserId;
      await recordCheckIn(regUid);
      await calculateStreak(regUid);
    } catch (_streakErr) {
      // non-blocking initial streak checkin
    }

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

router.post('/sync', requireClerkAuth, async (req, res, next) => {
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
      bannerUrl,
      gender,
      latitude,
      longitude,
    } = req.body;

    const syncedUser = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({
        where: {
          OR: [
            { clerkUserId },
            ...(email ? [{ email }] : []),
          ],
        },
      });

      const { collegeId, departmentId } = await upsertCollegeAndDepartment(
        tx,
        college,
        collegeLocation,
        department,
        { collegeId: existing?.collegeId, departmentId: existing?.departmentId },
      );

      const hasProfileFields = Boolean(existing?.profileComplete || (college && department));
      const userData = {
        name: (name && typeof name === 'string' && name.trim()) || existing?.name || (email ? email.split('@')[0] : 'Mindcraft Student'),
        email: email || existing?.email || `${clerkUserId}@clerk.internal`,
        ...(photoUrl !== undefined ? { photoUrl } : {}),
        ...(bannerUrl !== undefined ? { bannerUrl } : {}),
        ...(gender !== undefined ? { gender } : {}),
        ...(collegeId !== undefined ? { collegeId } : {}),
        ...(collegeLocation !== undefined ? { collegeLocation: String(collegeLocation).trim() } : {}),
        ...(departmentId !== undefined ? { departmentId } : {}),
        ...(year !== undefined ? { year: String(year) } : {}),
        ...(latitude !== undefined ? { latitude: Number(latitude) } : {}),
        ...(longitude !== undefined ? { longitude: Number(longitude) } : {}),
        profileComplete: hasProfileFields,
      };

      const u = existing
        ? await tx.user.update({
            where: { id: existing.id },
            data: { ...userData, clerkUserId, deletedAt: null },
          })
        : await tx.user.create({
            data: { clerkUserId, ...userData, deletedAt: null },
          });

      await replaceUserSkills(tx, u.id, 'TEACHES', teaches);
      await replaceUserSkills(tx, u.id, 'LEARNS', learns);

      return u;
    });

    await safeInvalidateMatchingFeeds(syncedUser.id);

    const fullUser = await resolveUser(syncedUser.id, {
      include: {
        college: true,
        department: true,
        skills: { include: { skill: true } },
      },
    });

    const normalized = normalizeUser(fullUser || syncedUser);
    res.status(200).json({
      success: true,
      message: 'User synced successfully',
      user: normalized,
      data: normalized,
    });
  } catch (err) {
    next(err);
  }
});

async function handleProfileUpdate(targetUser, payload) {
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
  } = payload;

  await prisma.$transaction(async (tx) => {
    const { collegeId, departmentId } = await upsertCollegeAndDepartment(
      tx,
      college,
      collegeLocation,
      department,
      { collegeId: targetUser.collegeId, departmentId: targetUser.departmentId },
    );

    await tx.user.update({
      where: { id: targetUser.id },
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

    await replaceUserSkills(tx, targetUser.id, 'TEACHES', teaches);
    await replaceUserSkills(tx, targetUser.id, 'LEARNS', learns);
  });

  await safeInvalidateMatchingFeeds(targetUser.id);

  const updated = await resolveUser(targetUser.id, {
    include: {
      college: true,
      department: true,
      skills: { include: { skill: true } },
    },
  });

  return normalizeUser(updated || targetUser);
}

router.put('/profile', requireAuth, async (req, res, next) => {
  try {
    const user = await resolveUser(req.user.clerkUserId || req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const normalized = await handleProfileUpdate(user, req.body);
    res.json({
      success: true,
      message: 'Profile updated',
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
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 2) {
      return res.json({
        success: true,
        count: 0,
        data: [],
      });
    }

    const { limit, offset } = getPagination(req.query);
    const takeLimit = Math.min(limit || 20, 20);

    const currentUser = req.user?.id ? req.user : await resolveUser(req.user.clerkUserId);
    const excludeId = currentUser ? currentUser.id : undefined;

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          ...(isUuid(q) ? [{ id: q }] : []),
          { clerkUserId: q },
          { clerkUserId: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { college: { name: { contains: q, mode: 'insensitive' } } },
          { department: { name: { contains: q, mode: 'insensitive' } } },
          { skills: { some: { skill: { name: { contains: q, mode: 'insensitive' } } } } },
        ],
      },
      include: {
        college: true,
        department: true,
        skills: { include: { skill: true } },
      },
      orderBy: { name: 'asc' },
      skip: offset,
      take: takeLimit,
    });

    const data = users.map(normalizeUser);

    res.json({
      success: true,
      count: data.length,
      limit: takeLimit,
      offset,
      hasMore: data.length === takeLimit,
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
    let user = (req.params.uid === req.user?.clerkUserId || req.params.uid === req.user?.id) && req.user?.skills
      ? req.user
      : await resolveUser(req.params.uid, {
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
    const directTeaches = (user.skills || []).filter((s) => s.kind === 'TEACHES').map((s) => s.skill?.name || s.name || s);
    const directLearns = (user.skills || []).filter((s) => s.kind === 'LEARNS').map((s) => s.skill?.name || s.name || s);

    const completedWhere = {
      OR: [{ teacherId: user.id }, { learnerId: user.id }],
      status: 'COMPLETED',
    };

    const [tokenBalance, transactions, streak, skillGraph, completedSessionsCount, aggregateHours, ratedSessions] = await Promise.all([
      getBalance(uid).catch(() => 0),
      getTransactionHistory(uid, 10).catch(() => []),
      calculateStreak(uid).catch(() => ({
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0,
        activeDates: [],
        activityDays: [],
        grid: [],
      })),
      (directTeaches.length > 0 || directLearns.length > 0)
        ? Promise.resolve({ teaches: directTeaches, learns: directLearns })
        : getUserSkillGraph(uid).catch(() => ({ teaches: directTeaches, learns: directLearns })),
      (user.id && typeof prisma.tutoringSession.count === 'function')
        ? prisma.tutoringSession.count({ where: completedWhere }).catch(() => 0)
        : Promise.resolve(0),
      (user.id && typeof prisma.tutoringSession.aggregate === 'function')
        ? prisma.tutoringSession.aggregate({
            where: completedWhere,
            _sum: { duration: true },
          })
        : Promise.resolve(null),
      user.id ? prisma.tutoringSession.findMany({
        where: {
          OR: [{ teacherId: user.id }, { learnerId: user.id }],
          status: 'COMPLETED',
          completionKey: { not: null },
        },
        select: {
          id: true,
          title: true,
          teacherId: true,
          learnerId: true,
          scheduledFor: true,
          completionKey: true,
          teacher: { select: { clerkUserId: true } },
          learner: { select: { clerkUserId: true } },
        },
        orderBy: { scheduledFor: 'desc' },
        take: 50,
      }).catch(() => []) : Promise.resolve([]),
    ]);

    const summedMinutes = aggregateHours?._sum?.duration;
    const totalStudyHours = summedMinutes !== undefined && summedMinutes !== null
      ? +((summedMinutes || 0) / 60).toFixed(1)
      : +((completedSessionsCount * 60) / 60).toFixed(1);
    const averageRating = Number(user.averageRating) || 0;

    const reviews = (ratedSessions || [])
      .map((s) => {
        if (!s.completionKey) return null;
        let parsed = null;
        try {
          parsed = JSON.parse(s.completionKey);
        } catch (_e) {
          return null;
        }
        const isTeacher = s.teacherId === user.id;
        const reviewEntry = isTeacher
          ? (parsed[`learner_${s.learnerId}`] || (parsed.rating ? { rating: parsed.rating, comment: parsed.comment } : null))
          : parsed[`teacher_${s.teacherId}`];
        if (!reviewEntry || !reviewEntry.rating) return null;
        return {
          sessionId: s.id,
          skill: s.title || 'Tutoring',
          rating: Number(reviewEntry.rating),
          ratingComment: reviewEntry.comment || '',
          learnerUid: s.learner?.clerkUserId || '',
          reviewerUid: isTeacher ? (s.learner?.clerkUserId || '') : (s.teacher?.clerkUserId || ''),
          scheduledAt: s.scheduledFor ? new Date(s.scheduledFor).getTime() : 0,
        };
      })
      .filter(Boolean);

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

router.post('/:uid/follow', requireAuth, async (req, res, next) => {
  try {
    const [follower, target] = await Promise.all([
      resolveUser(req.user.clerkUserId || req.user.id),
      resolveUser(req.params.uid),
    ]);

    if (!follower || !target) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (follower.id === target.id) {
      return res.status(400).json({ success: false, error: 'Cannot follow yourself' });
    }

    if (prisma.userFollow?.upsert) {
      await prisma.userFollow.upsert({
        where: {
          followerId_followingId: {
            followerId: follower.id,
            followingId: target.id,
          },
        },
        create: {
          followerId: follower.id,
          followingId: target.id,
        },
        update: {},
      });
    }

    res.json({
      success: true,
      message: 'Successfully followed user',
      data: {
        followerId: follower.id,
        followingId: target.id,
        uid: target.clerkUserId,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:uid/follow', requireAuth, async (req, res, next) => {
  try {
    const [follower, target] = await Promise.all([
      resolveUser(req.user.clerkUserId || req.user.id),
      resolveUser(req.params.uid),
    ]);

    if (!follower || !target) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (prisma.userFollow?.deleteMany) {
      await prisma.userFollow.deleteMany({
        where: {
          followerId: follower.id,
          followingId: target.id,
        },
      });
    }

    res.json({ success: true, message: 'Successfully unfollowed user' });
  } catch (err) {
    next(err);
  }
});

router.get('/:uid/following', requireAuth, async (req, res, next) => {
  try {
    let user = await resolveUser(req.params.uid);
    if (!user) {
      if (req.params.uid === req.user?.clerkUserId || req.params.uid === req.user?.id) {
        user = req.user;
      } else {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
    }

    const { limit, offset } = getPagination(req.query);
    const follows = prisma.userFollow?.findMany && user.id
      ? await prisma.userFollow.findMany({
          where: {
            followerId: user.id,
            following: { deletedAt: null },
          },
          include: {
            following: {
              include: {
                college: true,
                department: true,
                skills: { include: { skill: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        })
      : [];

    const data = follows.map((f) => normalizeUser(f.following)).filter(Boolean);
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

async function handleSkillsUpdate(req, res, next) {
  try {
    const user = await resolveUser(req.params.uid);
    if (!user || (user.clerkUserId !== req.user.clerkUserId && user.id !== req.user.id)) {
      return res.status(403).json({ success: false, error: "Cannot update another user's skills" });
    }

    const { teaches, learns } = req.body;
    const normalized = await handleProfileUpdate(user, { teaches, learns });

    res.json({
      success: true,
      message: 'Skills updated',
      data: normalized,
    });
  } catch (err) {
    next(err);
  }
}

router.put('/:uid/skills', requireAuth, handleSkillsUpdate);
router.patch('/:uid/skills', requireAuth, handleSkillsUpdate);

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

    await safeInvalidateMatchingFeeds(user.id);

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

    const normalized = await handleProfileUpdate(user, req.body);

    res.json({
      success: true,
      message: 'Profile updated',
      data: normalized,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
