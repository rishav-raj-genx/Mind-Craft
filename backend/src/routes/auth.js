/**
 * auth.js — Authentication Routes (Passport.js)
 *
 * Endpoints:
 *   POST /api/auth/register           — Email/password registration + profile creation
 *   POST /api/auth/login              — Email/password login
 *   POST /api/auth/logout             — Destroy session
 *   GET  /api/auth/me                 — Return current session user
 *   GET  /api/auth/google             — Initiate Google OAuth
 *   GET  /api/auth/google/callback    — Google OAuth callback
 */

const express = require('express');
const { body } = require('express-validator');
const bcrypt  = require('bcryptjs');
const router  = express.Router();

const { passport, findUserByEmail, BCRYPT_ROUNDS } = require('../config/passport');
const { formatValidationErrors } = require('../middleware/errorHandler');
const { requireAuth }            = require('../middleware/auth');
const { getDriver }              = require('../config/neo4j');
const { awardTokens }            = require('../services/tokenEconomy');
const { v4: uuidv4 }             = require('uuid');

// ── POST /api/auth/register ──────────────────────────────────────────
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
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

      const email = req.body.email.toLowerCase().trim();

      // Check if user already exists
      const existing = await findUserByEmail(email);
      if (existing) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email already exists. Please log in instead.',
        });
      }

      const uid = `local_${uuidv4()}`;
      const passwordHash = await bcrypt.hash(req.body.password, BCRYPT_ROUNDS);

      const userData = {
        uid,
        email,
        passwordHash,
        name:              req.body.name,
        photoUrl:          req.body.photoUrl || '',
        gender:            req.body.gender || '',
        college:           req.body.college,
        collegeLocation:   req.body.collegeLocation || '',
        department:        req.body.department,
        year:              req.body.year,
        fcmToken:          req.body.fcmToken || '',
        latitude:          req.body.latitude || 0,
        longitude:         req.body.longitude || 0,
        lastLocationUpdate: Date.now(),
        averageRating:     0,
        totalSessions:     0,
        tokenBalance:      0,
        mind_tokens:       0,
        linkedinUsername:   req.body.linkedinUsername || '',
        githubUsername:     req.body.githubUsername || '',
        leetcodeUsername:   req.body.leetcodeUsername || '',
        codeforcesUsername: req.body.codeforcesUsername || '',
        codechefUsername:   req.body.codechefUsername || '',
        profileComplete:   true,
        createdAt:         Date.now(),
      };

      const driver  = getDriver();
      const session = driver.session();

      try {
        await session.executeWrite(async (tx) => {
          await tx.run(
            `MERGE (u:User { uid: $uid })
             ON CREATE SET u.createdAt = $props.createdAt
             SET u += $props`,
            { uid, props: userData }
          );

          if (userData.college) {
            await tx.run(
              `MATCH (u:User {uid: $uid})
               OPTIONAL MATCH (u)-[old:BELONGS_TO]->(:College)
               DELETE old
               MERGE (c:College { name: $college })
               WITH c MATCH (u:User {uid: $uid})
               MERGE (u)-[:BELONGS_TO]->(c)`,
              { college: userData.college, uid }
            );
          }

          const teaches = req.body.teaches || [];
          await tx.run(`MATCH (u:User {uid: $uid})-[r:TEACHES]->() DELETE r`, { uid });
          if (teaches.length > 0) {
            await tx.run(
              `MATCH (u:User {uid: $uid})
               UNWIND $skills AS skillName
               MERGE (s:Skill {name: skillName})
               MERGE (u)-[:TEACHES]->(s)`,
              { uid, skills: teaches }
            );
          }

          const learns = req.body.learns || [];
          await tx.run(`MATCH (u:User {uid: $uid})-[r:LEARNS]->() DELETE r`, { uid });
          if (learns.length > 0) {
            await tx.run(
              `MATCH (u:User {uid: $uid})
               UNWIND $skills AS skillName
               MERGE (s:Skill {name: skillName})
               MERGE (u)-[:LEARNS]->(s)`,
              { uid, skills: learns }
            );
          }
        });

        await awardTokens(uid, 5, 'daily_login');
        userData.mind_tokens = 5;
        userData.tokenBalance = 5;

        // Log the user in automatically after registration
        const { passwordHash: _ph, ...safeUser } = userData;
        req.login(safeUser, (err) => {
          if (err) return next(err);
          return res.status(201).json({
            success: true,
            data: {
              ...safeUser,
              teaches: req.body.teaches,
              learns: req.body.learns,
            },
          });
        });
      } finally {
        await session.close();
      }
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/auth/complete-profile ──────────────────────────────────
// For Google-authenticated users who need to complete their profile
router.post(
  '/complete-profile',
  requireAuth,
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
      const updates = {
        name:              req.body.name,
        photoUrl:          req.body.photoUrl || req.user.photoUrl || '',
        gender:            req.body.gender || '',
        college:           req.body.college,
        collegeLocation:   req.body.collegeLocation || '',
        department:        req.body.department,
        year:              req.body.year,
        linkedinUsername:   req.body.linkedinUsername || '',
        githubUsername:     req.body.githubUsername || '',
        leetcodeUsername:   req.body.leetcodeUsername || '',
        codeforcesUsername: req.body.codeforcesUsername || '',
        codechefUsername:   req.body.codechefUsername || '',
        profileComplete:   true,
      };

      const driver  = getDriver();
      const session = driver.session();

      try {
        await session.executeWrite(async (tx) => {
          await tx.run(
            `MATCH (u:User { uid: $uid }) SET u += $props`,
            { uid, props: updates }
          );

          if (updates.college) {
            await tx.run(
              `MATCH (u:User {uid: $uid})
               OPTIONAL MATCH (u)-[old:BELONGS_TO]->(:College)
               DELETE old
               MERGE (c:College { name: $college })
               WITH c MATCH (u:User {uid: $uid})
               MERGE (u)-[:BELONGS_TO]->(c)`,
              { college: updates.college, uid }
            );
          }

          const teaches = req.body.teaches || [];
          await tx.run(`MATCH (u:User {uid: $uid})-[r:TEACHES]->() DELETE r`, { uid });
          if (teaches.length > 0) {
            await tx.run(
              `MATCH (u:User {uid: $uid})
               UNWIND $skills AS skillName
               MERGE (s:Skill {name: skillName})
               MERGE (u)-[:TEACHES]->(s)`,
              { uid, skills: teaches }
            );
          }

          const learns = req.body.learns || [];
          await tx.run(`MATCH (u:User {uid: $uid})-[r:LEARNS]->() DELETE r`, { uid });
          if (learns.length > 0) {
            await tx.run(
              `MATCH (u:User {uid: $uid})
               UNWIND $skills AS skillName
               MERGE (s:Skill {name: skillName})
               MERGE (u)-[:LEARNS]->(s)`,
              { uid, skills: learns }
            );
          }
        });

        await awardTokens(uid, 5, 'daily_login');

        res.json({
          success: true,
          data: { ...req.user, ...updates, teaches: req.body.teaches, learns: req.body.learns },
        });
      } finally {
        await session.close();
      }
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/auth/login ─────────────────────────────────────────────
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: info?.message || 'Invalid email or password.',
      });
    }
    req.login(user, (loginErr) => {
      if (loginErr) return next(loginErr);
      const { passwordHash, ...safeUser } = user;
      return res.json({ success: true, data: safeUser });
    });
  })(req, res, next);
});

// ── POST /api/auth/logout ────────────────────────────────────────────
router.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy((destroyErr) => {
      if (destroyErr) return next(destroyErr);
      res.clearCookie('connect.sid');
      return res.json({ success: true, message: 'Logged out successfully.' });
    });
  });
});

// ── GET /api/auth/me ─────────────────────────────────────────────────
router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    const { passwordHash, ...safeUser } = req.user;
    return res.json({ success: true, data: safeUser });
  }
  return res.json({ success: false, data: null });
});

// ── Google OAuth ─────────────────────────────────────────────────────
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(501).json({
      success: false,
      error: 'Google OAuth is not configured on this server.',
    });
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get(
  '/google/callback',
  (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
    }
    passport.authenticate('google', { failureRedirect: '/login' })(req, res, next);
  },
  (req, res) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    // If profile is incomplete, redirect to signup to complete it
    if (!req.user.profileComplete) {
      return res.redirect(`${frontendUrl}/signup`);
    }
    return res.redirect(frontendUrl);
  }
);

module.exports = router;
