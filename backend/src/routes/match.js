/**
 * match.js — Neo4j Graph-Based Tutor Matching Routes
 *
 * Exposes endpoints that traverse the Neo4j graph to find tutor matches,
 * and manages match request lifecycle via Firestore.
 *
 * Endpoints:
 *   GET  /api/match/:uid             — Graph-based tutor matches
 *   GET  /api/match/:uid/broad       — Broad matches (cross-college)
 *   POST /api/match/request          — Send a match request
 *   POST /api/match/accept           — Accept a match request
 *   POST /api/match/decline          — Decline a match request
 *   GET  /api/match/requests/:uid    — Pending incoming requests
 */

const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();

const { db }                    = require('../config/firebase');
const { verifyFirebaseToken }   = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { findMatches, findBroadMatches } = require('../services/matchingEngine');
const {
  COLLECTION_USERS,
  COLLECTION_MATCH_REQUESTS,
  COLLECTION_MATCHES,
  STATUS_PENDING,
  STATUS_ACCEPTED,
  STATUS_DECLINED,
} = require('../utils/constants');

// ── GET /api/match/:uid ───────────────────────────────────────────────
// Returns ranked tutor matches from Neo4j (same college, shared skills)
router.get('/:uid', verifyFirebaseToken, async (req, res, next) => {
  try {
    const uid   = req.params.uid;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skill = req.query.skill || null;

    const matches = await findMatches(uid, { limit, skillFilter: skill });

    res.json({
      success: true,
      count:   matches.length,
      data:    matches,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/match/:uid/broad ─────────────────────────────────────────
// Cross-college matching fallback
router.get('/:uid/broad', verifyFirebaseToken, async (req, res, next) => {
  try {
    const uid   = req.params.uid;
    const limit = parseInt(req.query.limit, 10) || 20;

    const matches = await findBroadMatches(uid, limit);

    res.json({
      success: true,
      count:   matches.length,
      data:    matches,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /api/match/request ───────────────────────────────────────────
router.post(
  '/request',
  verifyFirebaseToken,
  [
    body('toUid').trim().notEmpty().withMessage('Recipient UID is required'),
    body('sharedSkill').trim().notEmpty().withMessage('Shared skill is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = formatValidationErrors(req);
      if (errors) return res.status(400).json(errors);

      const fromUid     = req.user.uid;
      const { toUid, sharedSkill } = req.body;

      if (fromUid === toUid) {
        return res.status(400).json({ success: false, error: 'Cannot match with yourself' });
      }

      // Check for existing pending request
      const existing = await db
        .collection(COLLECTION_MATCH_REQUESTS)
        .where('fromUid', '==', fromUid)
        .where('toUid', '==', toUid)
        .where('status', '==', STATUS_PENDING)
        .get();

      if (!existing.empty) {
        return res.status(409).json({ success: false, error: 'Match request already pending' });
      }

      // Check if already matched
      const matchCheck1 = await db.collection(COLLECTION_MATCHES)
        .where('user1Uid', '==', fromUid).where('user2Uid', '==', toUid).get();
      const matchCheck2 = await db.collection(COLLECTION_MATCHES)
        .where('user1Uid', '==', toUid).where('user2Uid', '==', fromUid).get();

      if (!matchCheck1.empty || !matchCheck2.empty) {
        return res.status(409).json({ success: false, error: 'Already matched with this user' });
      }

      // Create the request
      const requestRef = db.collection(COLLECTION_MATCH_REQUESTS).doc();
      const request = {
        requestId:   requestRef.id,
        fromUid,
        toUid,
        sharedSkill,
        status:      STATUS_PENDING,
        createdAt:   Date.now(),
      };

      await requestRef.set(request);

      res.status(201).json({ success: true, data: request });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/match/accept ────────────────────────────────────────────
router.post(
  '/accept',
  verifyFirebaseToken,
  [body('requestId').trim().notEmpty().withMessage('Request ID is required')],
  async (req, res, next) => {
    try {
      const errors = formatValidationErrors(req);
      if (errors) return res.status(400).json(errors);

      const { requestId } = req.body;
      const requestRef = db.collection(COLLECTION_MATCH_REQUESTS).doc(requestId);
      const requestDoc = await requestRef.get();

      if (!requestDoc.exists) {
        return res.status(404).json({ success: false, error: 'Match request not found' });
      }

      const requestData = requestDoc.data();

      if (requestData.toUid !== req.user.uid) {
        return res.status(403).json({ success: false, error: 'Only the recipient can accept' });
      }

      if (requestData.status !== STATUS_PENDING) {
        return res.status(400).json({ success: false, error: `Request is already ${requestData.status}` });
      }

      // ── Update request + create match in a batch ────────────────
      const matchRef = db.collection(COLLECTION_MATCHES).doc();

      // Find shared skills between users
      const [user1Doc, user2Doc] = await Promise.all([
        db.collection(COLLECTION_USERS).doc(requestData.fromUid).get(),
        db.collection(COLLECTION_USERS).doc(requestData.toUid).get(),
      ]);

      const user1 = user1Doc.data() || {};
      const user2 = user2Doc.data() || {};

      const sharedSkills = [
        ...(user1.teaches || []).filter((s) => (user2.learns || []).includes(s)),
        ...(user2.teaches || []).filter((s) => (user1.learns || []).includes(s)),
      ].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

      const match = {
        matchId:         matchRef.id,
        user1Uid:        requestData.fromUid,
        user2Uid:        requestData.toUid,
        sharedSkills,
        createdAt:       Date.now(),
        lastMessage:     '',
        lastMessageTime: 0,
      };

      const batch = db.batch();
      batch.update(requestRef, { status: STATUS_ACCEPTED });
      batch.set(matchRef, match);
      await batch.commit();

      res.json({ success: true, data: match });
    } catch (err) {
      next(err);
    }
  },
);

// ── POST /api/match/decline ───────────────────────────────────────────
router.post(
  '/decline',
  verifyFirebaseToken,
  [body('requestId').trim().notEmpty().withMessage('Request ID is required')],
  async (req, res, next) => {
    try {
      const errors = formatValidationErrors(req);
      if (errors) return res.status(400).json(errors);

      const { requestId } = req.body;
      const requestRef = db.collection(COLLECTION_MATCH_REQUESTS).doc(requestId);
      const requestDoc = await requestRef.get();

      if (!requestDoc.exists) {
        return res.status(404).json({ success: false, error: 'Match request not found' });
      }

      if (requestDoc.data().toUid !== req.user.uid) {
        return res.status(403).json({ success: false, error: 'Only the recipient can decline' });
      }

      await requestRef.update({ status: STATUS_DECLINED });

      res.json({ success: true, message: 'Match request declined' });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/match/requests/:uid ──────────────────────────────────────
router.get('/requests/:uid', verifyFirebaseToken, async (req, res, next) => {
  try {
    const uid = req.params.uid;

    const snapshot = await db
      .collection(COLLECTION_MATCH_REQUESTS)
      .where('toUid', '==', uid)
      .where('status', '==', STATUS_PENDING)
      .get();

    const requests = snapshot.docs.map((d) => d.data());

    res.json({ success: true, count: requests.length, data: requests });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
