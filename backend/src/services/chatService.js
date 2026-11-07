/**
 * chatService.js — Real-Time Notification & Socket Bridge
 *
 * Provides helper functions for emitting events to users via Socket.io.
 */

const { emitToUser } = require('../config/socket');
const { prisma } = require('../config/prisma');

async function broadcastToGlobal(uid, payload) {
  if (!uid) return;
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uid);
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { clerkUserId: uid },
          ...(isUuid ? [{ id: uid }] : []),
        ],
        deletedAt: null,
      },
      select: { id: true },
    });

    const targetId = user ? user.id : uid;
    const eventName = payload?.type || 'global_notification';
    emitToUser(targetId, eventName, payload);
  } catch (_err) {
    // Gracefully handle offline or uninitialized socket server
  }
}

module.exports = {
  broadcastToGlobal,
  initWebSocketServer: () => null,
};
