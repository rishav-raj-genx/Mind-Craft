const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { getRedisClients } = require('./redis');
const { prisma } = require('./prisma');
const { socketAuth } = require('../middleware/socketAuth');
const { markThreadRead, persistMessage } = require('../services/chatPersistenceService');
const { enqueueChatMessage } = require('../queues/chatPersistenceQueue');
const { isChatPersistenceWorkerRunning } = require('../workers/chatPersistenceWorker');
const { randomUUID } = require('node:crypto');

let io;
const activeUserSockets = new Map();
const MESSAGE_RATE_LIMIT_MAX = 5;
const MESSAGE_RATE_LIMIT_WINDOW_MS = 2000;
const QUEUE_ENQUEUE_TIMEOUT_MS = 2500;

function userRoom(userId) {
  return `user:${userId}`;
}

function threadRoom(threadId) {
  return `thread:${threadId}`;
}

function getSocketAllowedOrigins() {
  const sources = [
    process.env.SOCKET_IO_CORS_ORIGIN,
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
  ];

  const origins = [];
  for (const source of sources) {
    if (!source) continue;
    const parts = source.split(',');
    for (const part of parts) {
      const trimmed = part.trim().replace(/\/+$/, '');
      if (trimmed && trimmed !== '*' && !origins.includes(trimmed)) {
        origins.push(trimmed);
      }
    }
  }

  if (origins.length === 0) {
    return ['http://localhost:5173', 'http://localhost:3000'];
  }

  return origins;
}

function initSocketServer(httpServer) {
  const redis = getRedisClients();
  const options = {
    path: process.env.SOCKET_IO_PATH || '/socket.io',
    maxHttpBufferSize: 64 * 1024,
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const normalized = origin.trim().replace(/\/+$/, '');
        const allowed = getSocketAllowedOrigins();
        if (allowed.includes(normalized)) {
          return callback(null, true);
        }
        return callback(new Error('CORS origin not allowed'));
      },
      credentials: true,
    },
  };

  io = new Server(httpServer, options);

  if (redis.publisher && redis.subscriber) {
    if (typeof redis.publisher.on === 'function') {
      redis.publisher.on('error', (err) => {
        console.error('[Socket.io Redis Publisher Error]:', err?.message || err);
      });
    }
    if (typeof redis.subscriber.on === 'function') {
      redis.subscriber.on('error', (err) => {
        console.error('[Socket.io Redis Subscriber Error]:', err?.message || err);
      });
    }
    try {
      io.adapter(createAdapter(redis.publisher, redis.subscriber));
    } catch (err) {
      console.warn('Socket.io Redis adapter failed to initialize, using memory adapter:', err.message);
    }
  } else {
    console.warn('Socket.io Redis adapter disabled; using single-process rooms');
  }

  io.use(socketAuth);

  io.on('connection', (socket) => {
    const user = socket.user;
    const userId = socket.userId || user?.id;
    socket.userId = userId;

    if (userId) {
      socket.join(userRoom(userId));
      if (!activeUserSockets.has(userId)) {
        activeUserSockets.set(userId, new Set());
      }
      activeUserSockets.get(userId).add(socket.id);
    }
    if (user?.clerkUserId) {
      socket.join(userRoom(user.clerkUserId));
    }

    const messageBucket = {
      tokens: MESSAGE_RATE_LIMIT_MAX,
      lastRefill: Date.now(),
    };

    const consumeMessageToken = () => {
      const now = Date.now();
      const elapsed = now - messageBucket.lastRefill;
      if (elapsed > 0) {
        const refill = (elapsed / MESSAGE_RATE_LIMIT_WINDOW_MS) * MESSAGE_RATE_LIMIT_MAX;
        messageBucket.tokens = Math.min(MESSAGE_RATE_LIMIT_MAX, messageBucket.tokens + refill);
        messageBucket.lastRefill = now;
      }
      if (messageBucket.tokens < 1) {
        return false;
      }
      messageBucket.tokens -= 1;
      return true;
    };

    socket.on('thread:join', async (payload = {}, acknowledge = () => {}) => {
      const threadId = payload?.threadId;
      const effectiveUserId = socket.userId || socket.user?.id;

      if (!threadId) {
        socket.emit('error', { message: 'threadId is required' });
        if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'threadId is required' });
        return;
      }

      if (!effectiveUserId) {
        socket.emit('error', { message: 'Unauthorized thread access' });
        if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'Unauthorized thread access' });
        return;
      }

      try {
        const participant = await prisma.chatParticipant.findUnique({
          where: {
            threadId_userId: { threadId, userId: effectiveUserId },
          },
          select: { threadId: true, userId: true, leftAt: true },
        });

        if (!participant || participant.leftAt) {
          socket.emit('error', { message: 'Unauthorized thread access' });
          if (typeof acknowledge === 'function') {
            acknowledge({ ok: false, error: 'Unauthorized thread access' });
          }
          return;
        }

        await socket.join(threadRoom(threadId));
        socket.to(threadRoom(threadId)).emit('presence:changed', {
          userId: effectiveUserId,
          status: 'online',
        });
        if (typeof acknowledge === 'function') {
          acknowledge({ ok: true, threadId });
        }
      } catch (error) {
        socket.emit('error', { message: error.message || 'Unauthorized thread access' });
        if (typeof acknowledge === 'function') {
          acknowledge({ ok: false, error: error.message || 'Unauthorized thread access' });
        }
      }
    });

    socket.on('thread:leave', ({ threadId } = {}, acknowledge = () => {}) => {
      if (threadId) {
        socket.leave(threadRoom(threadId));
      }
      if (typeof acknowledge === 'function') {
        acknowledge({ ok: true, threadId });
      }
    });

    socket.on('chat:message', async (payload = {}, acknowledge = () => {}) => {
      const threadId = payload?.threadId;
      const text = payload?.text;
      const clientMessageId = payload?.clientMessageId || randomUUID();
      const verifiedUserId = socket.userId || socket.user?.id;

      if (!threadId || typeof text !== 'string' || !text.trim()) {
        const errPayload = { ok: false, error: 'threadId and text are required' };
        socket.emit('error', { message: errPayload.error });
        if (typeof acknowledge === 'function') acknowledge(errPayload);
        return;
      }

      if (!verifiedUserId) {
        const errPayload = { ok: false, error: 'Unauthorized thread access' };
        socket.emit('error', { message: errPayload.error });
        if (typeof acknowledge === 'function') acknowledge(errPayload);
        return;
      }

      if (!consumeMessageToken()) {
        const errPayload = { ok: false, error: 'Rate limit exceeded. Please slow down.' };
        socket.emit('error', { message: errPayload.error });
        if (typeof acknowledge === 'function') acknowledge(errPayload);
        return;
      }

      try {
        const participant = await prisma.chatParticipant.findUnique({
          where: {
            threadId_userId: { threadId, userId: verifiedUserId },
          },
          select: { threadId: true, userId: true, leftAt: true },
        });

        if (!participant || participant.leftAt) {
          socket.emit('error', { message: 'Unauthorized thread access' });
          if (typeof acknowledge === 'function') {
            acknowledge({ ok: false, error: 'Unauthorized thread access' });
          }
          return;
        }

        const messageId = randomUUID();
        const trimmedText = text.trim();
        const nowIso = new Date().toISOString();
        let persistedDirectly = false;
        let resolvedMessageId = messageId;

        const persistDirectly = async () => {
          const saved = await persistMessage({
            messageId,
            threadId,
            senderId: verifiedUserId,
            clientMessageId,
            text: trimmedText,
            createdAt: nowIso,
          });
          if (saved?.id) {
            resolvedMessageId = saved.id;
          }
          persistedDirectly = true;
        };

        let timeoutId;
        try {
          await Promise.race([
            enqueueChatMessage({
              messageId,
              threadId,
              senderId: verifiedUserId,
              clientMessageId,
              text: trimmedText,
              createdAt: nowIso,
            }),
            new Promise((_, reject) => {
              timeoutId = setTimeout(
                () => reject(new Error('BullMQ enqueue timeout')),
                QUEUE_ENQUEUE_TIMEOUT_MS,
              );
            }),
          ]);

          const workerRunning =
            typeof isChatPersistenceWorkerRunning === 'function' &&
            isChatPersistenceWorkerRunning();
          if (!workerRunning && process.env.STANDALONE_WORKER !== 'true') {
            await persistDirectly();
          }
        } catch (queueErr) {
          console.warn(
            'Queue unavailable, persisting message directly to Prisma:',
            queueErr?.message || queueErr,
          );
          await persistDirectly();
        } finally {
          clearTimeout(timeoutId);
        }

        const message = {
          messageId: resolvedMessageId,
          clientMessageId,
          threadId,
          senderId: verifiedUserId,
          senderUid: socket.user?.clerkUserId,
          senderName: socket.user?.name,
          text: trimmedText,
          status: persistedDirectly ? 'sent' : 'queued',
          createdAt: nowIso,
        };

        io.to(threadRoom(threadId)).emit('chat:message', message);

        // Broadcast out-of-thread notification to participants not currently in room
        try {
          const thread = await prisma.chatThread.findUnique({
            where: { id: threadId },
            include: {
              participants: {
                where: { leftAt: null, userId: { not: verifiedUserId } },
                include: { user: true },
              },
            },
          });
          if (thread?.participants) {
            const timestamp = new Date(nowIso).getTime();
            for (const p of thread.participants) {
              const notifPayload = {
                type: 'global_new_message',
                matchId: threadId,
                messageId,
                senderUid: socket.user?.clerkUserId,
                senderName: socket.user?.name,
                text: trimmedText,
                timestamp,
              };
              emitToUser(p.userId, 'global_new_message', notifPayload);
              if (p.user?.clerkUserId) {
                emitToUser(p.user.clerkUserId, 'global_new_message', notifPayload);
              }
            }
          }
        } catch (_notifyErr) {}

        if (typeof acknowledge === 'function') {
          acknowledge({ ok: true, message });
        }
      } catch (error) {
        socket.emit('error', { message: error.message || 'Failed to send message' });
        if (typeof acknowledge === 'function') {
          acknowledge({ ok: false, error: error.message || 'Failed to send message' });
        }
      }
    });

    socket.on('chat:typing', async ({ threadId, isTyping } = {}) => {
      if (!threadId) return;
      try {
        const verifiedUserId = socket.userId || socket.user?.id;
        const participant = await prisma.chatParticipant.findUnique({
          where: { threadId_userId: { threadId, userId: verifiedUserId } },
          select: { threadId: true, userId: true, leftAt: true },
        });
        if (!participant || participant.leftAt) return;
        socket.to(threadRoom(threadId)).emit('chat:typing', {
          threadId,
          userId: verifiedUserId,
          senderUid: socket.user?.clerkUserId,
          isTyping: Boolean(isTyping),
        });
      } catch (_error) {
        // Do not disclose thread membership through typing events.
      }
    });

    socket.on('chat:read', async ({ threadId } = {}, acknowledge = () => {}) => {
      try {
        const verifiedUserId = socket.userId || socket.user?.id;
        if (!threadId || !verifiedUserId) {
          if (typeof acknowledge === 'function') acknowledge({ ok: false, error: 'threadId is required' });
          return;
        }
        await markThreadRead(threadId, verifiedUserId);
        io.to(threadRoom(threadId)).emit('chat:read', {
          threadId,
          userId: verifiedUserId,
          senderUid: socket.user?.clerkUserId,
          readAt: new Date().toISOString(),
        });
        if (typeof acknowledge === 'function') {
          acknowledge({ ok: true });
        }
      } catch (error) {
        if (typeof acknowledge === 'function') {
          acknowledge({ ok: false, error: error.message });
        }
      }
    });

    socket.on('disconnecting', () => {
      const activeUserId = socket.userId || socket.user?.id;
      let shouldEmitOffline = true;
      if (activeUserId && activeUserSockets.has(activeUserId)) {
        const sockets = activeUserSockets.get(activeUserId);
        sockets.delete(socket.id);
        if (sockets.size > 0) {
          shouldEmitOffline = false;
        } else {
          activeUserSockets.delete(activeUserId);
        }
      }

      if (!shouldEmitOffline) return;

      for (const room of socket.rooms) {
        if (room.startsWith('thread:')) {
          socket.to(room).emit('presence:changed', {
            userId: activeUserId,
            status: 'offline',
          });
        }
      }
    });

    socket.on('disconnect', () => {
      const activeUserId = socket.userId || socket.user?.id;
      if (activeUserId && activeUserSockets.has(activeUserId)) {
        const sockets = activeUserSockets.get(activeUserId);
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          activeUserSockets.delete(activeUserId);
        }
      }
      socket.removeAllListeners();
    });
  });

  return io;
}

function emitToUser(userId, event, payload) {
  if (!io) throw new Error('Socket.io server is not initialized');
  io.to(userRoom(userId)).emit(event, payload);
}

function emitToThread(threadId, event, payload) {
  if (!io) throw new Error('Socket.io server is not initialized');
  io.to(threadRoom(threadId)).emit(event, payload);
}

async function closeSocketServer() {
  activeUserSockets.clear();
  if (!io) return;
  await new Promise((resolve) => io.close(resolve));
  io = null;
}

module.exports = {
  initSocketServer,
  emitToUser,
  emitToThread,
  closeSocketServer,
};
