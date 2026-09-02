/**
 * passport.js — Passport Authentication Strategies
 *
 * Configures:
 *   1. LocalStrategy  — email + bcrypt password
 *   2. GoogleStrategy  — OAuth 2.0 (optional, requires GOOGLE_CLIENT_ID)
 *
 * Users are persisted in Neo4j. Serialization is by uid.
 */

const passport       = require('passport');
const LocalStrategy  = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt         = require('bcryptjs');
const { getDriver }  = require('./neo4j');

const BCRYPT_ROUNDS = 12;

// ── Helpers ──────────────────────────────────────────────────────────

async function findUserByEmail(email) {
  const driver  = getDriver();
  const session = driver.session();
  try {
    const result = await session.executeRead((tx) =>
      tx.run('MATCH (u:User { email: $email }) RETURN u', { email })
    );
    return result.records.length > 0
      ? result.records[0].get('u').properties
      : null;
  } finally {
    await session.close();
  }
}

async function findUserByUid(uid) {
  const driver  = getDriver();
  const session = driver.session();
  try {
    const result = await session.executeRead((tx) =>
      tx.run('MATCH (u:User { uid: $uid }) RETURN u', { uid })
    );
    return result.records.length > 0
      ? result.records[0].get('u').properties
      : null;
  } finally {
    await session.close();
  }
}

async function findOrCreateGoogleUser(profile) {
  const driver  = getDriver();
  const session = driver.session();
  try {
    const email   = profile.emails?.[0]?.value || '';
    const uid     = `google_${profile.id}`;
    const name    = profile.displayName || '';
    const picture = profile.photos?.[0]?.value || '';

    // Check if a user with this email already exists (could have been created via email/password)
    const existing = await session.executeRead((tx) =>
      tx.run('MATCH (u:User { email: $email }) RETURN u', { email })
    );

    if (existing.records.length > 0) {
      const user = existing.records[0].get('u').properties;
      // Link Google ID if not already set
      if (!user.googleId) {
        await session.executeWrite((tx) =>
          tx.run('MATCH (u:User { email: $email }) SET u.googleId = $googleId', {
            email,
            googleId: profile.id,
          })
        );
      }
      return { ...user, googleId: profile.id };
    }

    // Create new user stub — full profile will be completed during signup flow
    const props = {
      uid,
      email,
      name,
      photoUrl: picture,
      googleId: profile.id,
      createdAt: Date.now(),
      // Mark as incomplete so the frontend can detect and redirect to signup
      profileComplete: false,
      gender: '',
      college: '',
      collegeLocation: '',
      department: '',
      year: '',
      averageRating: 0,
      totalSessions: 0,
      tokenBalance: 0,
      mind_tokens: 0,
      linkedinUsername: '',
      githubUsername: '',
      leetcodeUsername: '',
      codeforcesUsername: '',
      codechefUsername: '',
    };

    await session.executeWrite((tx) =>
      tx.run(
        `MERGE (u:User { uid: $uid })
         ON CREATE SET u += $props
         RETURN u`,
        { uid, props }
      )
    );

    return props;
  } finally {
    await session.close();
  }
}

// ── Serialization ────────────────────────────────────────────────────

passport.serializeUser((user, done) => {
  done(null, user.uid);
});

passport.deserializeUser(async (uid, done) => {
  try {
    const user = await findUserByUid(uid);
    done(null, user || false);
  } catch (err) {
    done(err);
  }
});

// ── Local Strategy ───────────────────────────────────────────────────

passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const user = await findUserByEmail(email.toLowerCase().trim());
        if (!user) {
          return done(null, false, { message: 'Invalid email or password.' });
        }
        if (!user.passwordHash) {
          return done(null, false, {
            message: 'This account uses Google sign-in. Please use "Continue with Google".',
          });
        }
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password.' });
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

// ── Google Strategy (optional — only if credentials are set) ─────────

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        scope:        ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await findOrCreateGoogleUser(profile);
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
  console.log('✅ Google OAuth strategy configured');
} else {
  console.warn('⚠️  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google login disabled');
}

module.exports = {
  passport,
  findUserByEmail,
  findUserByUid,
  BCRYPT_ROUNDS,
};
