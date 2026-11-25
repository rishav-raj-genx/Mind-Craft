const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { prisma } = require('../config/prisma');
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
const { calculateStreak, recordCheckIn } = require('../services/streakService');
const { calculateBadges } = require('../services/badgeCalculator');
const { getPagination } = require('../utils/pagination');
const { TOKENS_DAILY_LOGIN } = require('../utils/constants');
const { broadcastToGlobal } = require('../services/chatService');

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
  });
}

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
    const doubtId = req.body.doubtId || req.body.questionId;
    if (!doubtId) {
      return res.status(400).json({ success: false, error: 'doubtId or questionId is required' });
    }

    const callerClerkId = req.user.clerkUserId;
    const callerId = req.user.id;
    const uid = req.body.uid || callerClerkId;

    if (uid !== callerClerkId && uid !== callerId) {
      return res.status(403).json({ success: false, error: 'Cannot award forum tokens to another user' });
    }

    const user = await findUser(callerClerkId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Verify caller is author of the accepted answer in the referenced doubt
    const acceptedAnswer = await prisma.doubtAnswer.findFirst({
      where: {
        doubtId,
        authorId: user.id,
        isAccepted: true,
        deletedAt: null,
      },
    });

    if (!acceptedAnswer) {
      return res.status(403).json({
        success: false,
        error: 'Caller is not the author of an accepted answer for this question',
      });
    }

    const idempotencyKey = `forum_${doubtId}_${acceptedAnswer.id}`;
    const result = await awardForumAnswer(callerClerkId, doubtId, idempotencyKey);

    const streak = await calculateStreak(callerClerkId);
    let streakBonus = null;
    if ([5, 10, 30].includes(streak.currentStreak) && !result.alreadyAwarded) {
      const todayUTC = new Date().toISOString().slice(0, 10);
      streakBonus = await awardStreakBonus(callerClerkId, streak.currentStreak, `streak_${streak.currentStreak}_${todayUTC}`);
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

      const session = await prisma.tutoringSession.findUnique({
        where: { id: sessionId },
        include: { teacher: true, learner: true },
      });

      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }

      if (session.status !== 'COMPLETED') {
        return res.status(403).json({ success: false, error: 'Session is not completed' });
      }

      const callerClerkId = req.user.clerkUserId;
      const callerId = req.user.id;

      const isParticipant =
        session.teacher.clerkUserId === callerClerkId ||
        session.teacherId === callerId ||
        session.learner.clerkUserId === callerClerkId ||
        session.learnerId === callerId;

      if (!isParticipant) {
        return res.status(403).json({ success: false, error: 'Caller is not a participant in this completed session' });
      }

      const matchesTeacher =
        session.teacher.clerkUserId === teacherUid || session.teacherId === teacherUid;
      const matchesLearner =
        session.learner.clerkUserId === learnerUid || session.learnerId === learnerUid;

      if (!matchesTeacher || !matchesLearner) {
        return res.status(403).json({ success: false, error: 'Invalid teacherUid or learnerUid for session' });
      }

      const result = await awardSessionComplete(session.teacher.clerkUserId, session.learner.clerkUserId, sessionId);

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

const handleCheckIn = async (req, res, next) => {
  try {
    const uid = req.user.clerkUserId;
    const user = await findUser(uid);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const todayUTC = new Date().toISOString().slice(0, 10);
    const checkinKey = `checkin_${user.id}_${todayUTC}`;

    const checkInResult = await recordCheckIn(uid);
    const streak = await calculateStreak(uid);

    let streakBonus = null;
    let loginTokens = null;

    if (!checkInResult.alreadyCheckedIn) {
      loginTokens = await awardTokens(uid, TOKENS_DAILY_LOGIN, 'daily_login', {
        idempotencyKey: checkinKey,
      });

      if (streak.currentStreak > 0) {
        if ([5, 10, 30].includes(streak.currentStreak)) {
          const streakBonusKey = `streak_${streak.currentStreak}_${todayUTC}`;
          streakBonus = await awardStreakBonus(uid, streak.currentStreak, streakBonusKey);
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
};

router.post('/streak/checkin', requireAuth, handleCheckIn);
router.post('/streak/check-in', requireAuth, handleCheckIn);

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

    const user = await findUser(uid);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Pure read-only query returning earned badges from UserBadge join Badge
    const earnedBadges = await prisma.userBadge.findMany({
      where: { userId: user.id },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' },
    });

    const result = await calculateBadges(user.clerkUserId);
    result.badgeHistory = earnedBadges.map((ub) => ({
      id: `${ub.badgeId}_${ub.auditWeek}`,
      badgeId: ub.badgeId,
      badgeName: ub.badge?.name || ub.badgeId,
      level: ub.badge?.level || 1,
      earnedAt: ub.awardedAt.toISOString(),
      metadata: ub.metadata,
    }));

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
