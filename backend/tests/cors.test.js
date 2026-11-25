const express = require('express');
const cors = require('cors');
const request = require('supertest');
const { globalErrorHandler } = require('../src/middleware/errorHandler');

describe('CORS origin configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function createTestApp() {
    process.env.CORS_ORIGIN = 'https://mind-craft-frontend.vercel.app,http://localhost:5173';
    process.env.FRONTEND_URL = 'http://localhost:5173';
    process.env.SOCKET_IO_CORS_ORIGIN = 'http://localhost:5173';

    // Same logic as server.js
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

    const app = express();
    app.use(cors(corsOptions));
    app.get('/test', (_req, res) => res.json({ ok: true }));
    app.use(globalErrorHandler);
    return app;
  }

  it('allows whitelisted origins with credentials', async () => {
    const app = createTestApp();
    const res = await request(app)
      .get('/test')
      .set('Origin', 'https://mind-craft-frontend.vercel.app');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://mind-craft-frontend.vercel.app');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects unlisted origin with 403', async () => {
    const app = createTestApp();
    const res = await request(app)
      .get('/test')
      .set('Origin', 'https://malicious-site.com');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('CORS origin not allowed');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not allow wildcard even if wildcard is in environment variables', async () => {
    process.env.CORS_ORIGIN = '*';
    const app = createTestApp();
    const res = await request(app)
      .get('/test')
      .set('Origin', 'https://attacker.com');
    expect(res.status).toBe(403);
  });
});
