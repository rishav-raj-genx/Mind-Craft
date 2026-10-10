const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { getRedisClients } = require('./redis');
const { socketAuth } = require('../middleware/socketAuth');
const { assertParticipant, markThreadRead } = require('../services/chatPersistenceService');
const { enqueueChatMessage } = require('../queues/chatPersistenceQueue');
const { randomUUID } = require('node:crypto');

let io;

function userRoom(userId) {
  return `user:${userId}`;
}

function threadRoom(threadId) {
  return `thread:${threadId}`;
}

function initSocketServer(httpServer) {
  const redis = getRedisClients();
  const options = {
    path: process.env.SOCKET_IO_PATH || '/socket.io',
    maxHttpBufferSize: 64 * 1024,
    cors: {
      origin: process.env.SOCKET_IO_CORS_ORIGIN || process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  };

  io = new Server(httpServer, options);
  if (redis.publisher && redis.subscriber) {
    io.adapter(createAdapter(redis.publisher, redis.subscriber));
  } else {
    console.warn('Socket.io Redis adapter disabled; using single-process rooms');
  }

  io.use(socketAuth);
  io.on('connection', (socket) => {
    const { user } = socket;
    socket.join(userRoom(user.id));

    socket.on('thread:join', async ({ threadId }, acknowledge = () => {}) => {
      try {
        await assertParticipant(threadId, user.id);
        await socket.join(threadRoom(threadId));
        socket.to(threadRoom(threadId)).emit('presence:changed', {
          userId: user.id, status: 'online',
        });
        acknowledge({ ok: true, threadId });
      } catch (error) {
        acknowledge({ ok: false, error: error.message });
      }
    });

    socket.on('thread:leave', ({ threadId } = {}) => {
      if (threadId) socket.leave(threadRoom(threadId));
    });

    socket.on('chat:message', async (payload = {}, acknowledge = () => {}) => {
      const { threadId, text, clientMessageId = randomUUID() } = payload;
      if (!threadId || typeof text !== 'string' || !text.trim()) {
        return acknowledge({ ok: false, error: 'threadId and text are required' });
      }
      try {
        await assertParticipant(threadId, user.id);
        const messageId = randomUUID();
        await enqueueChatMessage({
          messageId,
          threadId,
          senderId: user.id,
          clientMessageId,
          text: text.trim(),
          createdAt: new Date().toISOString(),
        });
        const message = {
          messageId, clientMessageId, threadId, senderId: user.id,
          senderName: user.name, text: text.trim(), status: 'queued',
          createdAt: new Date().toISOString(),
        };
        io.to(threadRoom(threadId)).emit('chat:message', message);
        acknowledge({ ok: true, message });
      } catch (error) {
        acknowledge({ ok: false, error: error.message });
      }
    });

    socket.on('chat:typing', async ({ threadId, isTyping } = {}) => {
      if (!threadId) return;
      try {
        await assertParticipant(threadId, user.id);
        socket.to(threadRoom(threadId)).emit('chat:typing', {
          threadId, userId: user.id, isTyping: Boolean(isTyping),
        });
      } catch (_error) {
        // Do not disclose thread membership through typing events.
      }
    });

    socket.on('chat:read', async ({ threadId }, acknowledge = () => {}) => {
      try {
        await markThreadRead(threadId, user.id);
        io.to(threadRoom(threadId)).emit('chat:read', {
          threadId, userId: user.id, readAt: new Date().toISOString(),
        });
        acknowledge({ ok: true });
      } catch (error) {
        acknowledge({ ok: false, error: error.message });
      }
    });

    socket.on('disconnect', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('thread:')) {
          socket.to(room).emit('presence:changed', {
            userId: user.id, status: 'offline',
          });
        }
      }
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
