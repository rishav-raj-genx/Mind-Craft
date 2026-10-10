const { verifyToken } = require('@clerk/clerk-sdk-node');
const { prisma } = require('../config/prisma');

async function socketAuth(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      const error = new Error('Authentication token is required');
      error.data = { code: 'AUTH_REQUIRED' };
      return next(error);
    }

    const claims = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    if (!claims.sub) {
      const error = new Error('Invalid authentication token');
      error.data = { code: 'AUTH_INVALID' };
      return next(error);
    }

    const user = await prisma.user.findUnique({
      where: { clerkUserId: claims.sub },
      select: { id: true, clerkUserId: true, name: true, email: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      const error = new Error('User is not available');
      error.data = { code: 'USER_UNAVAILABLE' };
      return next(error);
    }

    socket.user = user;
    socket.auth = claims;
    return next();
  } catch (_error) {
    const error = new Error('Invalid authentication token');
    error.data = { code: 'AUTH_INVALID' };
    return next(error);
  }
}

module.exports = { socketAuth };
