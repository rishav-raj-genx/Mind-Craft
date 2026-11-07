/**
 * auth.js — Authentication Routes (Clerk & Session Profile)
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { prisma } = require('../config/prisma');

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { clerkUserId: req.user.clerkUserId },
      include: {
        college: true,
        department: true,
        skills: { include: { skill: true } },
      },
    });

    if (!user) {
      return res.json({
        success: true,
        data: {
          uid: req.user.clerkUserId,
          email: req.user.email,
          profileComplete: false,
        },
      });
    }

    res.json({
      success: true,
      data: {
        uid: user.clerkUserId,
        email: user.email,
        name: user.name,
        photoUrl: user.photoUrl,
        college: user.college?.name || '',
        department: user.department?.name || '',
        year: user.year,
        mind_tokens: user.mindTokens,
        currentStreak: user.currentStreak,
        longestStreak: user.longestStreak,
        profileComplete: user.profileComplete,
      },
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
