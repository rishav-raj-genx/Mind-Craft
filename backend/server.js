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
const { disconnectPrisma } = require('./src/config/prisma');
const { initSocketServer, closeSocketServer } = require('./src/config/socket');
const { closeRedis } = require('./src/config/redis');

// ── Express app ──────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// ── Global middleware ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // API-only, no HTML served
}));

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

app.use(cors({
  origin: process.env.CORS_ORIGIN || frontendUrl,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(compression({
  threshold: 1024,
  level: 6,
}));

// Clerk signs webhook requests against the unparsed payload.
app.use('/api/webhooks/clerk', clerkWebhookRoutes);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Health check ─────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    service: 'mindcraft-backend',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── API routes ───────────────────────────────────────────────────────
app.use('/api/user', userRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/voice-search', voiceSearchRoutes);
app.use('/api', gamificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/doubt', doubtRoutes);
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

    httpServer.close(() => {
      console.log('   ✔ HTTP server closed');
    });

    await closeSocketServer();
    await closeRedis();
    await disconnectPrisma();
    console.log('   ✔ All connections closed. Goodbye! 👋\n');
    process.exit(0);
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
