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
 *   POST   /api/user/:uid/follow      — Follow a user
 *   GET    /api/user/:uid/following   — Get followed users list
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
        collegeLocation:   req.body.collegeLocation || '',
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
        linkedinUsername:   req.body.linkedinUsername   || '',
        githubUsername:     req.body.githubUsername     || '',
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

// ── GET /api/user/metadata/options ────────────────────────────────────
// Returns all unique colleges and departments registered on the platform
router.get('/metadata/options', verifyFirebaseToken, async (req, res, next) => {
  try {
    const snapshot = await db.collection(COLLECTION_USERS).get();
    const colleges = new Set();
    const departments = new Set();
    snapshot.docs.forEach(doc => {
      const d = doc.data();
      if (d.college) colleges.add(d.college);
      if (d.department) departments.add(d.department);
    });
    res.json({
      success: true,
      data: {
        colleges: [...colleges].sort(),
        departments: [...departments].sort(),
      },
    });
  } catch (err) {
    next(err);
  }
});

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
      'name', 'college', 'collegeLocation', 'department', 'year', 'teaches', 'learns',
      'fcmToken', 'latitude', 'longitude', 'photoUrl', 'bannerUrl',
      'linkedinUsername', 'githubUsername', 'leetcodeUsername', 'codeforcesUsername', 'codechefUsername',
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
    const [tokenBalance, transactions, streak, skillGraph, sessionData] = await Promise.all([
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
    
    // sessionData contains both stats and reviews array
    const { reviews, stats } = sessionData;

    res.json({
      success: true,
      data: {
        user:         doc.data(),
        tokenBalance,
        recentTransactions: transactions,
        streak,
        skillGraph,
        reviews,
        stats,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Fetches completed & rated session reviews for a user (as teacher),
 * plus aggregated stats for all completed sessions (as teacher or learner).
 */
async function getReviews(uid) {
  try {
    const teacherSnapshot = await db
      .collection(COLLECTION_SESSIONS)
      .where('teacherUid', '==', uid)
      .where('status', '==', SESSION_COMPLETED)
      .get();
      
    const learnerSnapshot = await db
      .collection(COLLECTION_SESSIONS)
      .where('learnerUid', '==', uid)
      .where('status', '==', SESSION_COMPLETED)
      .get();

    const teacherSessions = teacherSnapshot.docs.map((d) => d.data());
    const learnerSessions = learnerSnapshot.docs.map((d) => d.data());
    const allSessions = [...teacherSessions, ...learnerSessions];

    const completedSessionsCount = allSessions.length;
    let totalStudyMins = 0;
    allSessions.forEach(s => totalStudyMins += (s.duration || 60));
    const totalStudyHours = +(totalStudyMins / 60).toFixed(1);

    const ratedTeacherSessions = teacherSessions.filter((s) => s.rating > 0);
    const avgRating = ratedTeacherSessions.length
      ? +(ratedTeacherSessions.reduce((sum, s) => sum + s.rating, 0) / ratedTeacherSessions.length).toFixed(1)
      : 0;

    const reviews = ratedTeacherSessions.map((s) => ({
      sessionId:     s.sessionId,
      skill:         s.skill,
      rating:        s.rating,
      ratingComment: s.ratingComment || '',
      learnerUid:    s.learnerUid,
      scheduledAt:   s.scheduledAt,
    }));

    return { 
      reviews, 
      stats: { completedSessionsCount, totalStudyHours, averageRating: avgRating }
    };
  } catch (_err) {
    return { reviews: [], stats: { completedSessionsCount: 0, totalStudyHours: 0, averageRating: 0 } };
  }
}

// ── POST /api/user/:uid/follow ────────────────────────────────────────
router.post('/:uid/follow', verifyFirebaseToken, async (req, res, next) => {
  try {
    const followerUid = req.user.uid;
    const targetUid = req.params.uid;

    if (followerUid === targetUid) {
      return res.status(400).json({ success: false, error: 'Cannot follow yourself' });
    }

    const { admin } = require('../config/firebase');
    const followerRef = db.collection(COLLECTION_USERS).doc(followerUid);
    
    await followerRef.update({
      following: admin.firestore.FieldValue.arrayUnion(targetUid)
    });

    res.json({ success: true, message: 'Successfully followed user' });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/user/:uid/following ──────────────────────────────────────
router.get('/:uid/following', verifyFirebaseToken, async (req, res, next) => {
  try {
    const doc = await db.collection(COLLECTION_USERS).doc(req.params.uid).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'User not found' });
    
    const followingUids = doc.data().following || [];
    if (followingUids.length === 0) return res.json({ success: true, data: [] });

    // Fetch basic profiles for all followed users
    const chunkArray = (arr, size) => arr.length ? [arr.slice(0, size), ...chunkArray(arr.slice(size), size)] : [];
    const chunks = chunkArray(followingUids, 10);
    
    let followedUsers = [];
    for (const chunk of chunks) {
      const snap = await db.collection(COLLECTION_USERS).where('uid', 'in', chunk).get();
      snap.docs.forEach(d => {
        const u = d.data();
        followedUsers.push({
          uid: u.uid,
          name: u.name,
          photoUrl: u.photoUrl,
          college: u.college,
          department: u.department,
          averageRating: u.averageRating
        });
      });
    }

    res.json({ success: true, data: followedUsers });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
