const { verifyToken } = require('@clerk/express');
const { prisma } = require('../config/prisma');
const { resolveUser, autoProvisionUser } = require('../utils/userResolver');

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

async function authenticate(req) {
  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Unauthorized: Invalid or missing token');
    error.statusCode = 401;
    throw error;
  }

  let claims;
  try {
    claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
  } catch (_err) {
    const error = new Error('Unauthorized: Invalid or missing token');
    error.statusCode = 401;
    throw error;
  }

  const clerkUserId = claims?.sub;
  if (!clerkUserId) {
    const error = new Error('Unauthorized: Invalid or missing token');
    error.statusCode = 401;
    throw error;
  }

  let user = null;
  if (prisma.user?.findUnique) {
    const found = await prisma.user.findUnique({
      where: { clerkUserId },
      include: { college: true, department: true },
    });
    if (found) {
      user = found;
    }
  }

  if (!user) {
    user = await resolveUser(clerkUserId, { includeDeleted: true, include: { college: true, department: true } });
  }

  if (!user) {
    try {
      user = await autoProvisionUser(clerkUserId, claims);
    } catch (_provErr) {
      console.error('[Auth] autoProvisionUser fallback error:', _provErr.message);
    }
  }

  if (!user) {
    const error = new Error('Unauthorized: User record not found');
    error.statusCode = 401;
    throw error;
  }

  if (user.deletedAt) {
    const error = new Error('This account has been deactivated');
    error.statusCode = 403;
    throw error;
  }

  req.auth = { ...claims, userId: clerkUserId, clerkUserId };
  req.user = { ...user, uid: clerkUserId, clerkUserId };
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
      error: err.message || 'Unauthorized: Invalid or missing token',
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

module.exports = {
  requireAuth,
  optionalAuth,
  getBearerToken,
  authenticate,
};
