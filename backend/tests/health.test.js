jest.mock('@clerk/express', () => ({
  verifyToken: jest.fn(),
}));

const mockPing = jest.fn();
const mockQueryRaw = jest.fn();

jest.mock('../src/config/prisma', () => ({
  prisma: {
    $queryRaw: (...args) => mockQueryRaw(...args),
  },
  disconnectPrisma: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/config/redis', () => ({
  getRedisClients: jest.fn(() => ({
    base: {
      ping: mockPing,
      quit: jest.fn().mockResolvedValue(),
      disconnect: jest.fn(),
    },
    publisher: {
      quit: jest.fn().mockResolvedValue(),
      disconnect: jest.fn(),
    },
    subscriber: {
      quit: jest.fn().mockResolvedValue(),
      disconnect: jest.fn(),
    },
  })),
  closeRedis: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/config/socket', () => ({
  initSocketServer: jest.fn(),
  closeSocketServer: jest.fn().mockResolvedValue(),
  emitToUser: jest.fn(),
  broadcastToThread: jest.fn(),
}));

jest.mock('../src/workers/chatPersistenceWorker', () => ({
  startChatPersistenceWorker: jest.fn(),
  closeChatPersistenceWorker: jest.fn().mockResolvedValue(),
}));

const request = require('supertest');
const { app } = require('../server');

describe('GET /health (Deep SRE Health Check)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns HTTP 200 with service status "connected" when DB and Redis are healthy', async () => {
    mockQueryRaw.mockResolvedValue([{ 1: 1 }]);
    mockPing.mockResolvedValue('PONG');

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'ok',
      uptime: expect.any(Number),
      services: {
        postgres: 'connected',
        redis: 'connected',
      },
    });
  });

  it('returns HTTP 503 degraded when database query fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('PostgreSQL connection timeout'));
    mockPing.mockResolvedValue('PONG');

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'degraded',
      database: 'disconnected',
      redis: 'connected',
    });
  });

  it('returns HTTP 503 degraded when Redis ping fails', async () => {
    mockQueryRaw.mockResolvedValue([{ 1: 1 }]);
    mockPing.mockRejectedValue(new Error('Redis connection refused'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'degraded',
      database: 'connected',
      redis: 'disconnected',
    });
  });

  it('returns HTTP 503 degraded when both database and Redis are down', async () => {
    mockQueryRaw.mockRejectedValue(new Error('DB connection refused'));
    mockPing.mockRejectedValue(new Error('Redis unreachable'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      status: 'degraded',
      database: 'disconnected',
      redis: 'disconnected',
    });
  });
});
