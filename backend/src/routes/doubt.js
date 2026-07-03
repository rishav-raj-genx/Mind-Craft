/**
 * doubt.js — Doubt Forum Routes
 *
 * CRUD for the Doubt Forum feature. Stores doubts and their answers
 * in Firestore's `doubts` collection.
 *
 * Endpoints:
 *   GET    /api/doubt              — Fetch all doubts (optionally filtered by tag)
 *   POST   /api/doubt              — Create a new doubt
 *   POST   /api/doubt/:id/answer   — Add an answer to a doubt
 *   PATCH  /api/doubt/:id/upvote   — Upvote a doubt
 */

const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();

const { db }                     = require('../config/firebase');
const { verifyFirebaseToken }    = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { COLLECTION_USERS }       = require('../utils/constants');

const COLLECTION_DOUBTS = 'doubts';

// ── GET /api/doubt — Fetch all doubts ─────────────────────────────────
router.get('/', verifyFirebaseToken, async (req, res, next) => {
  try {
    const { tag } = req.query;

    let query = db.collection(COLLECTION_DOUBTS).orderBy('createdAt', 'desc').limit(50);
    if (tag && tag !== 'All Doubts') {
      query = db.collection(COLLECTION_DOUBTS)
        .where('tag', '==', tag)
        .orderBy('createdAt', 'desc')
        .limit(50);
    }

    const snapshot = await query.get();
    const doubts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({ success: true, data: doubts });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/doubt — Create a new doubt ──────────────────────────────
router.post(
  '/',
  verifyFirebaseToken,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('content').trim().notEmpty().withMessage('Content is required'),
    body('tag').trim().notEmpty().withMessage('Tag is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = formatValidationErrors(req);
      if (errors) return res.status(400).json(errors);

      const uid = req.user.uid;

      // Fetch user info for display
      let authorName = req.user.name || req.user.email || 'Anonymous';
      let authorAvatar = req.user.picture || '';

      try {
        const userDoc = await db.collection(COLLECTION_USERS).doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          authorName = userData.name || authorName;
          authorAvatar = userData.photoUrl || authorAvatar;
        }
      } catch (_err) {
        // Proceed with defaults
      }

      const doubt = {
        authorUid:    uid,
        authorName,
        authorAvatar: authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=7C3AED&color=fff`,
        title:        req.body.title,
        content:      req.body.content,
        tag:          req.body.tag,
        upvotes:      0,
        upvotedBy:    [],
        answers:      [],
        answerCount:  0,
        createdAt:    Date.now(),
      };

      const docRef = await db.collection(COLLECTION_DOUBTS).add(doubt);
      res.status(201).json({ success: true, data: { id: docRef.id, ...doubt } });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/doubt/:id/answer — Add an answer ────────────────────────
router.post(
  '/:id/answer',
  verifyFirebaseToken,
  [
    body('content').trim().notEmpty().withMessage('Answer content is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = formatValidationErrors(req);
      if (errors) return res.status(400).json(errors);

      const uid = req.user.uid;
      const doubtRef = db.collection(COLLECTION_DOUBTS).doc(req.params.id);
      const doubtDoc = await doubtRef.get();

      if (!doubtDoc.exists) {
        return res.status(404).json({ success: false, error: 'Doubt not found' });
      }

      let authorName = req.user.name || 'Anonymous';
      let authorAvatar = req.user.picture || '';

      try {
        const userDoc = await db.collection(COLLECTION_USERS).doc(uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          authorName = userData.name || authorName;
          authorAvatar = userData.photoUrl || authorAvatar;
        }
      } catch (_err) {}

      const answer = {
        uid,
        authorName,
        authorAvatar: authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=DCFD8B&color=151f00`,
        content: req.body.content,
        createdAt: Date.now(),
      };

      const currentAnswers = doubtDoc.data().answers || [];
      await doubtRef.update({
        answers: [...currentAnswers, answer],
        answerCount: (doubtDoc.data().answerCount || 0) + 1,
      });

      res.json({ success: true, data: answer });
    } catch (err) {
      next(err);
    }
  },
);

// ── PATCH /api/doubt/:id/upvote — Upvote / un-upvote ─────────────────
router.patch('/:id/upvote', verifyFirebaseToken, async (req, res, next) => {
  try {
    const uid = req.user.uid;
    const doubtRef = db.collection(COLLECTION_DOUBTS).doc(req.params.id);
    const doubtDoc = await doubtRef.get();

    if (!doubtDoc.exists) {
      return res.status(404).json({ success: false, error: 'Doubt not found' });
    }

    const data = doubtDoc.data();
    const upvotedBy = data.upvotedBy || [];
    const alreadyUpvoted = upvotedBy.includes(uid);

    if (alreadyUpvoted) {
      await doubtRef.update({
        upvotes: Math.max(0, (data.upvotes || 0) - 1),
        upvotedBy: upvotedBy.filter(id => id !== uid),
      });
      res.json({ success: true, upvoted: false, upvotes: Math.max(0, (data.upvotes || 0) - 1) });
    } else {
      await doubtRef.update({
        upvotes: (data.upvotes || 0) + 1,
        upvotedBy: [...upvotedBy, uid],
      });
      res.json({ success: true, upvoted: true, upvotes: (data.upvotes || 0) + 1 });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
