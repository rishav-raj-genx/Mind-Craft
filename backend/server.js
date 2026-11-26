/**
 * server.js — Mindcraft Backend Entry Point
 *
 * Production-grade Express.js REST API for the Mindcraft P2P college
 * tutoring platform. Pure JSON API powered by Prisma (PostgreSQL),
 * Clerk Authentication, Socket.io, and BullMQ.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// ── Middleware ────────────────────────────────────────────────────────
const { globalErrorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const clerkWebhookRoutes = require('./src/routes/clerkWebhook');

// ── Routes ───────────────────────────────────────────────────────────
const userRoutes = require('./src/routes/user');
const matchRoutes = require('./src/routes/match');
const voiceSearchRoutes = require('./src/routes/voiceSearch');
const gamificationRoutes = require('./src/routes/gamification');
const chatRoutes = require('./src/routes/chat');
const sessionRoutes = require('./src/routes/session');
const doubtRoutes = require('./src/routes/doubt');
const authRoutes = require('./src/routes/auth');

// ── Services & DB ────────────────────────────────────────────────────
const { prisma, disconnectPrisma } = require('./src/config/prisma');
const { initSocketServer, closeSocketServer } = require('./src/config/socket');
const { getRedisClients, closeRedis } = require('./src/config/redis');
const { startChatPersistenceWorker, closeChatPersistenceWorker } = require('./src/workers/chatPersistenceWorker');

// ── Express app ──────────────────────────────────────────────────────
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ── Global middleware ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // API-only, no HTML served
}));

function getAllowedOrigins() {
  const sources = [
    process.env.CORS_ORIGIN,
    process.env.FRONTEND_URL,
    process.env.SOCKET_IO_CORS_ORIGIN,
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

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalized = origin.trim().replace(/\/+$/, '');
    const allowed = getAllowedOrigins();
    if (allowed.includes(normalized)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(compression({
  threshold: 1024,
  level: 6,
}));

// ── Rate limiters ───────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
});

const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  message: {
    success: false,
    error: 'Rate limit exceeded, please slow down.',
  },
});

app.use(globalLimiter);

// Clerk signs webhook requests against the unparsed payload (mounted before express.json)
app.use('/api/webhooks/clerk', clerkWebhookRoutes);
app.use('/api/clerk-webhook', clerkWebhookRoutes);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Health check ─────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  let redisStatus = 'disconnected';

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch (_err) {
    dbStatus = 'disconnected';
  }

  try {
    const clients = getRedisClients();
    const redis = clients?.base;
    if (!redis) {
      throw new Error('Redis not configured');
    }
    const pong = await redis.ping();
    if (pong === 'PONG' || pong === true || pong) {
      redisStatus = 'connected';
    } else {
      redisStatus = 'disconnected';
    }
  } catch (_err) {
    redisStatus = 'disconnected';
  }

  if (dbStatus !== 'connected' || redisStatus !== 'connected') {
    return res.status(503).json({
      status: 'degraded',
      database: dbStatus,
      redis: redisStatus,
    });
  }

  return res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    services: {
      postgres: 'connected',
      redis: 'connected',
    },
  });
});

// ── API routes ───────────────────────────────────────────────────────
app.use('/api/user', userRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/voice-search', strictLimiter, voiceSearchRoutes);
app.use('/api', gamificationRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/doubt', doubtRoutes);
app.use('/api/doubts', doubtRoutes);
app.use('/api/auth', authRoutes);

// ── 404 + error handling ─────────────────────────────────────────────
app.use(notFoundHandler);
app.use(globalErrorHandler);

// ── Create HTTP server (shared with Socket.io) ─────────────────────────
const httpServer = http.createServer(app);

// ── Boot sequence ────────────────────────────────────────────────────
async function boot() {
  console.log('\n🧠 ══════════════════════════════════════════════');
  console.log('   MINDCRAFT BACKEND — Starting up…');
  console.log('══════════════════════════════════════════════\n');

  // 1. Socket.io server with Redis adapter
  initSocketServer(httpServer);

  // 1b. In-process BullMQ worker fallback for single-dyno hosting
  const shouldRunInProcessWorker =
    process.env.RUN_IN_PROCESS_WORKERS === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.STANDALONE_WORKER !== 'true' && process.env.RUN_IN_PROCESS_WORKERS !== 'false') ||
    process.env.EMBEDDED_WORKERS === 'true';

  if (shouldRunInProcessWorker) {
    try {
      startChatPersistenceWorker();
      console.log('   ✔ In-process chat persistence worker started');
    } catch (workerErr) {
      console.warn('   ⚠️ Failed to start in-process chat persistence worker:', workerErr.message);
    }
  }

  // 2. Start listening
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 Mindcraft backend listening on port ${PORT}`);
    console.log(`   Health:        http://localhost:${PORT}/health`);
    console.log(`   API base:      http://localhost:${PORT}/api`);
    console.log(`   Socket.io:     http://localhost:${PORT}/socket.io`);
    console.log(`   Environment:   ${process.env.NODE_ENV || 'development'}\n`);
  });

  // ── Graceful shutdown ───────────────────────────────────────────
  const shutdown = async (signal) => {
    console.log(`\n⏹️  ${signal} received — shutting down gracefully…`);

    const forceExitTimeout = setTimeout(() => {
      console.error('   ⚠️ Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
    forceExitTimeout.unref();

    httpServer.close(() => {
      console.log('   ✔ HTTP server closed');
    });

    try {
      await closeChatPersistenceWorker();
      await closeSocketServer();
      await closeRedis();
      await disconnectPrisma();
      console.log('   ✔ All connections closed. Goodbye! 👋\n');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  boot().catch((err) => {
    console.error('Fatal boot error:', err);
    process.exit(1);
  });
}

module.exports = { app, httpServer, boot };
