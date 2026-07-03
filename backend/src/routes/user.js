/**
 * user.js — User Management Routes
 *
 * CRUD operations for user profiles, syncing with both Firestore and
 * the Neo4j graph. All routes require Firebase authentication.
 *
 * Endpoints:
 *   POST   /api/user/register       — Create user profile
 *   GET    /api/user/:uid            — Get user profile
 *   PATCH  /api/user/:uid            — Update user profile
 *   GET    /api/user/:uid/profile    — Full profile (tokens + streak + reviews)
 */

const express = require('express');
const { body } = require('express-validator');
const router  = express.Router();

const { db }                    = require('../config/firebase');
const { verifyFirebaseToken }   = require('../middleware/auth');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { syncUserToGraph }       = require('../services/neo4jSync');
const { getUserSkillGraph }     = require('../services/matchingEngine');
const { getBalance, getTransactionHistory } = require('../services/tokenEconomy');
const { calculateStreak }       = require('../services/streakCalculator');
const {
  COLLECTION_USERS,
  COLLECTION_SESSIONS,
  SESSION_COMPLETED,
} = require('../utils/constants');

// ── POST /api/user/register ───────────────────────────────────────────
router.post(
  '/register',
  verifyFirebaseToken,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('college').trim().notEmpty().withMessage('College is required'),
    body('department').trim().notEmpty().withMessage('Department is required'),
    body('year').trim().notEmpty().withMessage('Year is required'),
    body('teaches').isArray({ min: 1 }).withMessage('At least one teaching skill is required'),
    body('learns').isArray({ min: 1 }).withMessage('At least one learning skill is required'),
  ],
  async (req, res, next) => {
    try {
      const errors = formatValidationErrors(req);
      if (errors) return res.status(400).json(errors);

      const uid = req.user.uid;
      const userData = {
        uid,
        name:              req.body.name,
        email:             req.user.email,
        photoUrl:          req.user.picture || req.body.photoUrl || '',
        college:           req.body.college,
        department:        req.body.department,
        year:              req.body.year,
        teaches:           req.body.teaches,
        learns:            req.body.learns,
        fcmToken:          req.body.fcmToken || '',
        latitude:          req.body.latitude  || 0,
        longitude:         req.body.longitude || 0,
        lastLocationUpdate: Date.now(),
        averageRating:     0,
        totalSessions:     0,
        tokenBalance:      0,
        leetcodeUsername:   req.body.leetcodeUsername   || '',
        codeforcesUsername: req.body.codeforcesUsername || '',
        codechefUsername:   req.body.codechefUsername   || '',
        createdAt:         Date.now(),
      };

      // Write to Firestore
      await db.collection(COLLECTION_USERS).doc(uid).set(userData);

      // Sync to Neo4j graph
      try {
        await syncUserToGraph(userData);
      } catch (err) {
        console.warn('⚠️  Neo4j sync deferred:', err.message);
      }

      res.status(201).json({ success: true, data: userData });
    } catch (err) {
      next(err);
    }
  },
);

// ── GET /api/user/search ──────────────────────────────────────────────
router.get('/search', verifyFirebaseToken, async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    const snapshot = await db.collection(COLLECTION_USERS).get();
    
    let users = snapshot.docs
      .map(doc => ({ uid: doc.id, ...doc.data() }))
      .filter((u) => u.uid !== req.user.uid);
    
    if (q) {
      users = users.filter((u) => {
        const skills = [...(u.teaches || []), ...(u.learns || [])];
        return [
          u.name,
          u.email,
          u.college,
          u.department,
          u.year,
          ...skills,
        ].some((value) => String(value || '').toLowerCase().includes(q));
      });
    }
    
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/user/:uid ────────────────────────────────────────────────
router.get('/:uid', verifyFirebaseToken, async (req, res, next) => {
  try {
    const doc = await db.collection(COLLECTION_USERS).doc(req.params.uid).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: doc.data() });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/user/:uid ──────────────────────────────────────────────
router.patch('/:uid', verifyFirebaseToken, async (req, res, next) => {
  try {
    // Only allow users to update their own profile
    if (req.user.uid !== req.params.uid) {
      return res.status(403).json({ success: false, error: 'Cannot update another user\'s profile' });
    }

    const uid = req.params.uid;

    // Whitelist updateable fields
    const allowedFields = [
      'name', 'college', 'department', 'year', 'teaches', 'learns',
      'fcmToken', 'latitude', 'longitude', 'photoUrl', 'bannerUrl',
      'leetcodeUsername', 'codeforcesUsername', 'codechefUsername',
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    // Update Firestore
    await db.collection(COLLECTION_USERS).doc(uid).update(updates);

    // Re-sync Neo4j if skills or college changed
    const graphFields = ['teaches', 'learns', 'college', 'department', 'name'];
    const needsGraphSync = graphFields.some((f) => updates[f] !== undefined);

    if (needsGraphSync) {
      try {
        const updatedDoc = await db.collection(COLLECTION_USERS).doc(uid).get();
        await syncUserToGraph({ uid, ...updatedDoc.data() });
      } catch (err) {
        console.warn('⚠️  Neo4j re-sync deferred:', err.message);
      }
    }

    res.json({ success: true, message: 'Profile updated', updatedFields: Object.keys(updates) });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/user/:uid/profile ────────────────────────────────────────
// Full profile: user data + token balance + streak + skill graph + reviews
router.get('/:uid/profile', verifyFirebaseToken, async (req, res, next) => {
  try {
    const uid = req.params.uid;
    const doc = await db.collection(COLLECTION_USERS).doc(uid).get();

    if (!doc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Fetch all profile facets in parallel
    const [tokenBalance, transactions, streak, skillGraph, reviews] = await Promise.all([
      getBalance(uid).catch(() => 0),
      getTransactionHistory(uid, 10).catch(() => []),
      calculateStreak(uid).catch(() => ({
        currentStreak: 0,
        longestStreak: 0,
        activeDates: [],
        grid: [],
      })),
      getUserSkillGraph(uid).catch(() => ({ teaches: [], learns: [] })),
      getReviews(uid),
    ]);

    res.json({
      success: true,
      data: {
        user:         doc.data(),
        tokenBalance,
        recentTransactions: transactions,
        streak,
        skillGraph,
        reviews,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Fetches completed & rated session reviews for a user (as teacher).
 */
async function getReviews(teacherUid) {
  try {
    const snapshot = await db
      .collection(COLLECTION_SESSIONS)
      .where('teacherUid', '==', teacherUid)
      .where('status', '==', SESSION_COMPLETED)
      .get();

    return snapshot.docs
      .map((d) => d.data())
      .filter((s) => s.rating > 0)
      .map((s) => ({
        sessionId:     s.sessionId,
        skill:         s.skill,
        rating:        s.rating,
        ratingComment: s.ratingComment || '',
        learnerUid:    s.learnerUid,
        scheduledAt:   s.scheduledAt,
      }));
  } catch (_err) {
    return [];
  }
}

module.exports = router;
