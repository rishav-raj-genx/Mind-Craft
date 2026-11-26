/**
 * auth.js — Authentication Routes (Clerk & Session Profile)
 */

const express = require('express');
const router = express.Router();
const { requireClerkAuth } = require('../middleware/auth');
const { resolveUser } = require('../utils/userResolver');

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

    const teaches = (user.skills || [])
      .filter((s) => s.kind === 'TEACHES')
      .map((s) => s.skill?.name || s.name || s);
    const learns = (user.skills || [])
      .filter((s) => s.kind === 'LEARNS')
      .map((s) => s.skill?.name || s.name || s);

    const formattedUser = {
      id: user.id,
      uid: user.clerkUserId,
      clerkUserId: user.clerkUserId,
      name: user.name,
      email: user.email,
      photoUrl: user.photoUrl,
      gender: user.gender || '',
      college: user.college?.name || '',
      collegeId: user.collegeId,
      collegeLocation: user.collegeLocation || '',
      department: user.department?.name || '',
      departmentId: user.departmentId,
      year: user.year,
      mindTokens: user.mindTokens || 0,
      tokenBalance: user.mindTokens || 0,
      currentStreak: user.currentStreak || 0,
      longestStreak: user.longestStreak || 0,
      totalSessions: user.totalSessions || 0,
      averageRating: Number(user.averageRating) || 0,
      profileComplete: true,
      isActive: !user.deletedAt,
      teaches,
      learns,
    };

    return res.status(200).json({
      success: true,
      registered: true,
      needsOnboarding: false,
      user: formattedUser,
      data: formattedUser,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (_req, res) => {
  res.json({ success: true, message: 'Signed out successfully' });
});

router.post('/register', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'User registration is managed by Clerk. Webhook syncs profile automatically.',
  });
});

router.post('/login', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authentication is managed by Clerk. Attach Bearer token to requests.',
  });
});

module.exports = router;
