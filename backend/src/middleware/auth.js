const { verifyToken } = require('@clerk/clerk-sdk-node');
const { prisma } = require('../config/prisma');

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

async function authenticate(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Authentication token is required');
    error.statusCode = 401;
    throw error;
  }

  const claims = await verifyToken(token, {
    secretKey: process.env.CLERK_SECRET_KEY,
  });
  const clerkUserId = claims.sub;
  if (!clerkUserId) {
    const error = new Error('Authentication token has no user subject');
    error.statusCode = 401;
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (user?.deletedAt) {
    const error = new Error('This account has been deactivated');
    error.statusCode = 403;
    throw error;
  }

  req.auth = { ...claims, clerkUserId };
  req.user = user
    ? { ...user, uid: clerkUserId, clerkUserId }
    : { uid: clerkUserId, clerkUserId, email: claims.email || '' };
  return req.user;
}

async function requireAuth(req, res, next) {
  try {
    await authenticate(req);
    return next();
  } catch (err) {
    const status = err.statusCode || 401;
    return res.status(status).json({
      success: false,
      error: status === 401 ? 'Authentication required. Please sign in.' : err.message,
    });
  }
}

async function optionalAuth(req, _res, next) {
  const token = getBearerToken(req);
  if (!token) {
    req.auth = null;
    req.user = null;
    return next();
  }

  try {
    await authenticate(req);
  } catch (_err) {
    req.auth = null;
    req.user = null;
  }
  return next();
}

// Compatibility export for routes that have not yet been renamed from Firebase.
const verifyFirebaseToken = requireAuth;

module.exports = {
  requireAuth,
  optionalAuth,
  verifyFirebaseToken,
  getBearerToken,
};
