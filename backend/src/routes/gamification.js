/**
 * gamification.js — Token Economy & Streak Routes
 *
 * Endpoints for the Mind Token system and daily consistency streaks.
 *
 * Endpoints:
 *   GET  /api/tokens/:uid              — Get token balance + recent transactions
 *   POST /api/tokens/award/forum       — Award tokens for forum answer
 *   POST /api/tokens/award/session     — Award tokens for session completion
 *   GET  /api/streak/:uid              — Get streak data + 7×5 grid
 */

const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();

const { verifyFirebaseToken }    = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const {
  awardForumAnswer,
  awardSessionComplete,
  awardStreakBonus,
  getBalance,
  getTransactionHistory,
} = require('../services/tokenEconomy');
const { calculateStreak } = require('../services/streakCalculator');

// ── GET /api/tokens/:uid ──────────────────────────────────────────────
router.get('/tokens/:uid', verifyFirebaseToken, async (req, res, next) => {
  try {
    const uid   = req.params.uid;
    const limit = parseInt(req.query.limit, 10) || 20;
    const after = req.query.after || null;

    const [balance, transactions] = await Promise.all([
      getBalance(uid),
      getTransactionHistory(uid, limit, after),
    ]);

    res.json({
      success: true,
      data: {
        balance,
        transactions,
        hasMore: transactions.length === limit,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/tokens/award/forum ──────────────────────────────────────
router.post(
  '/tokens/award/forum',
  verifyFirebaseToken,
  [body('uid').trim().notEmpty().withMessage('User UID is required')],
  async (req, res, next) => {
    try {
      const errors = formatValidationErrors(req);
      if (errors) return res.status(400).json(errors);

      const { uid, questionId } = req.body;
      const result = await awardForumAnswer(uid, questionId || '');

      // Check and award streak bonus
      const streak = await calculateStreak(uid);
      let streakBonus = null;
      if ([5, 10, 30].includes(streak.currentStreak)) {
        streakBonus = await awardStreakBonus(uid, streak.currentStreak);
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
  },
);

// ── POST /api/tokens/award/session ────────────────────────────────────
router.post(
  '/tokens/award/session',
  verifyFirebaseToken,
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

// ── GET /api/streak/:uid ──────────────────────────────────────────────
router.get('/streak/:uid', verifyFirebaseToken, async (req, res, next) => {
  try {
    const uid    = req.params.uid;
    const streak = await calculateStreak(uid);

    res.json({
      success: true,
      data: {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        activeDates:   streak.activeDates,
        grid:          streak.grid,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
