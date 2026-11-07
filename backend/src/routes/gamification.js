const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { requireAuth } = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const {
  awardForumAnswer,
  awardSessionComplete,
  awardStreakBonus,
  getBalance,
  getTransactionHistory,
  awardTokens,
  getLeaderboard,
} = require('../services/tokenEconomy');
const { calculateStreak, recordCheckIn } = require('../services/streakCalculator');
const { calculateBadges, recordBadgeEarned } = require('../services/badgeCalculator');
const { getPagination } = require('../utils/pagination');
const { TOKENS_DAILY_LOGIN, TOKENS_BADGE_EARNED } = require('../utils/constants');
const { broadcastToGlobal } = require('../services/chatService');

router.get('/tokens/:uid', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req.params;
    if (uid !== req.user.clerkUserId && uid !== req.user.id) {
      return res.status(403).json({ success: false, error: "Cannot fetch another user's token wallet" });
    }
    const { limit } = getPagination(req.query);
    const after = req.query.after || null;

    const [balance, transactions] = await Promise.all([
      getBalance(req.user.clerkUserId),
      getTransactionHistory(req.user.clerkUserId, limit, after),
    ]);

    res.json({
      success: true,
      data: {
        balance,
        transactions,
        limit,
        hasMore: transactions.length === limit,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/tokens/award/forum', requireAuth, async (req, res, next) => {
  try {
    const { questionId } = req.body;
    const uid = req.body.uid || req.user.clerkUserId;
    if (uid !== req.user.clerkUserId && uid !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Cannot award forum tokens to another user' });
    }
    const result = await awardForumAnswer(req.user.clerkUserId, questionId || '');

    const streak = await calculateStreak(req.user.clerkUserId);
    let streakBonus = null;
    if ([5, 10, 30].includes(streak.currentStreak)) {
      streakBonus = await awardStreakBonus(req.user.clerkUserId, streak.currentStreak);
    }

    res.json({
      success: true,
      data: {
        ...result,
        streakBonus,
        currentStreak: streak.currentStreak,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/tokens/award/session',
  requireAuth,
  [
    body('teacherUid').trim().notEmpty().withMessage('Teacher UID is required'),
    body('learnerUid').trim().notEmpty().withMessage('Learner UID is required'),
    body('sessionId').trim().notEmpty().withMessage('Session ID is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = formatValidationErrors(req);
      if (errors) return res.status(400).json(errors);

      const { teacherUid, learnerUid, sessionId } = req.body;
      const result = await awardSessionComplete(teacherUid, learnerUid, sessionId);

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

router.post('/streak/checkin', requireAuth, async (req, res, next) => {
  try {
    const uid = req.user.clerkUserId;

    const checkInResult = await recordCheckIn(uid);
    const streak = await calculateStreak(uid);

    let streakBonus = null;
    let loginTokens = null;
    if (!checkInResult.alreadyCheckedIn) {
      loginTokens = await awardTokens(uid, TOKENS_DAILY_LOGIN, 'daily_login');
      if (streak.currentStreak > 0) {
        if ([5, 10, 30].includes(streak.currentStreak)) {
          streakBonus = await awardStreakBonus(uid, streak.currentStreak);
        }
        broadcastToGlobal(uid, {
          type: 'global_new_message',
          notification: {
            title: 'Streak Increased! 🔥',
            body: `You're now on a ${streak.currentStreak} day streak! Keep going!`,
          },
          data: {
            type: 'streak_update',
            id: `streak-${streak.currentStreak}`,
            route: '/streak',
            matchId: '',
          },
        });
      }
    }

    res.json({
      success: true,
      data: {
        ...streak,
        alreadyCheckedIn: checkInResult.alreadyCheckedIn,
        streakBonus,
        loginTokens,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/streak/:uid', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req.params;
    if (uid !== req.user.clerkUserId && uid !== req.user.id) {
      return res.status(403).json({ success: false, error: "Cannot fetch another user's streak" });
    }
    const streak = await calculateStreak(req.user.clerkUserId);

    res.json({
      success: true,
      data: {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        activeDates: streak.activeDates,
        grid: streak.grid,
        badges: streak.badges,
        streakFreezes: streak.streakFreezes,
        totalActiveDays: streak.totalActiveDays,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/badges/:uid', requireAuth, async (req, res, next) => {
  try {
    const { uid } = req.params;
    if (uid !== req.user.clerkUserId && uid !== req.user.id) {
      return res.status(403).json({ success: false, error: "Cannot fetch another user's badges" });
    }
    const result = await calculateBadges(req.user.clerkUserId);

    for (const badge of result.badges) {
      if (badge.level > 0) {
        try {
          const isNew = await recordBadgeEarned(req.user.clerkUserId, badge.id, badge.name, badge.level);
          if (isNew) {
            broadcastToGlobal(req.user.clerkUserId, {
              type: 'global_new_message',
              notification: {
                title: 'Badge Unlocked! 🏅',
                body: `You unlocked the Level ${badge.level} ${badge.name} badge!`,
              },
              data: {
                type: 'badge_unlocked',
                id: `badge-${badge.id}-${badge.level}`,
                route: '/badges',
                matchId: '',
              },
            });
            await awardTokens(req.user.clerkUserId, TOKENS_BADGE_EARNED, 'badge_earned', {
              badgeId: badge.id,
              level: badge.level,
            });
          }
        } catch (_err) {}
      }
    }

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/leaderboard', requireAuth, async (req, res, next) => {
  try {
    const result = await getLeaderboard(req.user.clerkUserId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
