/**
 * session.js — Session Management Routes
 *
 * Handles the tutoring session lifecycle: booking, completion, rating,
 * cancellation, and Google Calendar export.
 *
 * Endpoints:
 *   POST  /api/session/book                       — Book a new session
 *   GET   /api/session/:uid                       — Get sessions by status
 *   PATCH /api/session/:sessionId/complete         — Mark session complete
 *   POST  /api/session/:sessionId/rate             — Submit rating
 *   POST  /api/session/:sessionId/cancel           — Cancel session
 *   POST  /api/session/:sessionId/export-calendar  — Export to Google Calendar
 *   GET   /api/session/auth/google                 — Google OAuth URL
 *   GET   /api/session/auth/google/callback        — Google OAuth callback
 */

const express  = require('express');
const { body } = require('express-validator');
const router   = express.Router();

const { db, admin }             = require('../config/firebase');
const { verifyFirebaseToken }   = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { completeSession, cancelSession } = require('../services/sessionRouter');
const { awardSessionComplete }  = require('../services/tokenEconomy');
const {
  exportSessionToCalendar,
  getAuthUrl,
  exchangeCodeForTokens,
} = require('../services/calendarExport');
const {
  COLLECTION_SESSIONS,
  COLLECTION_USERS,
  SESSION_UPCOMING,
  SESSION_COMPLETED,
} = require('../utils/constants');

// ── POST /api/session/book ────────────────────────────────────────────
router.post(
  '/book',
  verifyFirebaseToken,
  [
    body('matchId').trim().notEmpty().withMessage('Match ID is required'),
    body('teacherUid').trim().notEmpty().withMessage('Teacher UID is required'),
    body('learnerUid').trim().notEmpty().withMessage('Learner UID is required'),
    body('skill').trim().notEmpty().withMessage('Skill is required'),
    body('scheduledAt').isNumeric().withMessage('Scheduled time (epoch ms) is required'),
    body('mode').isIn(['Online', 'In-Person']).withMessage('Mode must be Online or In-Person'),
  ],
  async (req, res, next) => {
    try {
      const errors = formatValidationErrors(req);
      if (errors) return res.status(400).json(errors);

      const sessionRef = db.collection(COLLECTION_SESSIONS).doc();
      const session = {
        sessionId:   sessionRef.id,
        matchId:     req.body.matchId,
        teacherUid:  req.body.teacherUid,
        learnerUid:  req.body.learnerUid,
        skill:       req.body.skill,
        scheduledAt: req.body.scheduledAt,
        mode:        req.body.mode,
        meetLink:    req.body.meetLink || '',
        location:    req.body.location || '',
        notes:       req.body.notes    || '',
        status:      SESSION_UPCOMING,
        rating:      0,
        ratingComment: '',
        createdAt:   Date.now(),
      };

      await sessionRef.set(session);

      res.status(201).json({ success: true, data: session });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/session/:uid ─────────────────────────────────────────────
router.get('/:uid', verifyFirebaseToken, async (req, res, next) => {
  try {
    const uid    = req.params.uid;
    const status = req.query.status || null;

    // Get sessions where user is teacher or learner
    const queries = [];

    const buildQuery = (field) => {
      let q = db.collection(COLLECTION_SESSIONS).where(field, '==', uid);
      if (status) q = q.where('status', '==', status);
      return q.get();
    };

    const [asTeacher, asLearner] = await Promise.all([
      buildQuery('teacherUid'),
      buildQuery('learnerUid'),
    ]);

    const sessions = [
      ...asTeacher.docs.map((d) => d.data()),
      ...asLearner.docs.map((d) => d.data()),
    ].sort((a, b) => a.scheduledAt - b.scheduledAt);

    res.json({
      success: true,
      count:   sessions.length,
      data:    sessions,
    });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/session/:sessionId/complete ────────────────────────────
router.patch('/:sessionId/complete', verifyFirebaseToken, async (req, res, next) => {
  try {
    const result = await completeSession(req.params.sessionId);

    // Award tokens to both participants
    const sessionDoc = await db.collection(COLLECTION_SESSIONS).doc(req.params.sessionId).get();
    if (sessionDoc.exists) {
      const session = sessionDoc.data();
      try {
        await awardSessionComplete(session.teacherUid, session.learnerUid, session.sessionId);
      } catch (err) {
        console.warn('⚠️  Token award deferred:', err.message);
      }
    }

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/session/:sessionId/rate ─────────────────────────────────
router.post(
  '/:sessionId/rate',
  verifyFirebaseToken,
  [
    body('rating').isFloat({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  ],
  async (req, res, next) => {
    try {
      const errors = formatValidationErrors(req);
      if (errors) return res.status(400).json(errors);

      const { sessionId } = req.params;
      const { rating, comment } = req.body;

      const sessionRef = db.collection(COLLECTION_SESSIONS).doc(sessionId);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }

      const session = sessionDoc.data();

      // Update session rating
      await sessionRef.update({
        rating:        parseFloat(rating),
        ratingComment: comment || '',
        status:        SESSION_COMPLETED,
      });

      // Recalculate teacher's average rating
      const allSessions = await db
        .collection(COLLECTION_SESSIONS)
        .where('teacherUid', '==', session.teacherUid)
        .where('status', '==', SESSION_COMPLETED)
        .get();

      const ratedSessions = allSessions.docs
        .map((d) => d.data())
        .filter((s) => s.rating > 0);

      if (ratedSessions.length > 0) {
        const avgRating = ratedSessions.reduce((sum, s) => sum + s.rating, 0) / ratedSessions.length;
        await db.collection(COLLECTION_USERS).doc(session.teacherUid).update({
          averageRating: parseFloat(avgRating.toFixed(2)),
          totalSessions: ratedSessions.length,
        });
      }

      res.json({ success: true, message: 'Rating submitted' });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/session/:sessionId/cancel ───────────────────────────────
router.post('/:sessionId/cancel', verifyFirebaseToken, async (req, res, next) => {
  try {
    const result = await cancelSession(req.params.sessionId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/session/:sessionId/export-calendar ──────────────────────
router.post('/:sessionId/export-calendar', verifyFirebaseToken, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { googleTokens } = req.body;

    if (!googleTokens || !googleTokens.access_token) {
      return res.status(400).json({
        success: false,
        error: 'Google OAuth tokens required. Use GET /api/session/auth/google first.',
      });
    }

    // Fetch session data
    const sessionDoc = await db.collection(COLLECTION_SESSIONS).doc(sessionId).get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const session = sessionDoc.data();

    // Get peer name
    const peerUid = req.user.uid === session.teacherUid
      ? session.learnerUid
      : session.teacherUid;

    const peerDoc = await db.collection(COLLECTION_USERS).doc(peerUid).get();
    const peerName = peerDoc.exists ? peerDoc.data().name : 'Peer';

    const result = await exportSessionToCalendar(session, googleTokens, peerName);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/session/auth/google ──────────────────────────────────────
router.get('/auth/google', (_req, res) => {
  try {
    const url = getAuthUrl();
    res.json({ success: true, data: { authUrl: url } });
  } catch (err) {
    res.status(503).json({
      success: false,
      error: 'Google Calendar API not configured.',
    });
  }
});

// ── GET /api/session/auth/google/callback ─────────────────────────────
router.get('/auth/google/callback', async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Authorization code is required' });
    }

    const tokens = await exchangeCodeForTokens(code);

    res.json({
      success: true,
      data: {
        message: 'Google Calendar authorized. Use these tokens for calendar export.',
        tokens,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
