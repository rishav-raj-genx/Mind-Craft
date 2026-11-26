const { verifyToken } = require('@clerk/express');
const { prisma } = require('../config/prisma');
const { resolveUser } = require('../utils/userResolver');

function getBearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token.trim() : null;
}

async function authenticate(req, options = {}) {
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

  const isRegister = Boolean(
    options.allowUnregistered ||
    req.path === '/register' ||
    req.path?.endsWith('/register') ||
    req.originalUrl?.includes('/register') ||
    req.url?.includes('/register')
  );

  if (user && user.deletedAt) {
    if (isRegister) {
      req.auth = { ...claims, userId: clerkUserId, clerkUserId };
      req.user = {
        ...user,
        clerkUserId,
        uid: clerkUserId,
        email: claims.email || user.email || '',
        name: claims.name || user.name || '',
        profileComplete: false,
        isUnregistered: true,
      };
      return req.user;
    }
    const error = new Error('This account has been deactivated');
    error.statusCode = 403;
    throw error;
  }

  if (!user) {
    if (isRegister) {
      req.auth = { ...claims, userId: clerkUserId, clerkUserId };
      req.user = {
        clerkUserId,
        uid: clerkUserId,
        email: claims.email || '',
        name: claims.name || '',
        profileComplete: false,
        isUnregistered: true,
      };
      return req.user;
    }
    const error = new Error('Unauthorized: User record not found');
    error.statusCode = 401;
    throw error;
  }

  req.auth = { ...claims, userId: clerkUserId, clerkUserId };
  req.user = { ...user, uid: clerkUserId, clerkUserId };
  return req.user;
}

async function requireAuth(req, res, next) {
  try {
    const isRegister = Boolean(
      req.path === '/register' ||
      req.path?.endsWith('/register') ||
      req.originalUrl?.includes('/register') ||
      req.url?.includes('/register')
    );
    await authenticate(req, { allowUnregistered: isRegister });
    return next();
  } catch (err) {
    const status = err.statusCode || 401;
    return res.status(status).json({
      success: false,
      error: err.message || 'Unauthorized: Invalid or missing token',
    });
  }
}

async function requireClerkAuth(req, res, next) {
  try {
    await authenticate(req, { allowUnregistered: true });
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
    await authenticate(req, { allowUnregistered: true });
  } catch (_err) {
    req.auth = null;
    req.user = null;
  }
  return next();
}

module.exports = {
  requireAuth,
  requireClerkAuth,
  optionalAuth,
  getBearerToken,
  authenticate,
};
