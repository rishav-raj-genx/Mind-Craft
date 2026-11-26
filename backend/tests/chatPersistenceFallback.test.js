const { EventEmitter } = require('node:events');

jest.mock('@clerk/express', () => ({
  verifyToken: jest.fn(),
}));

jest.mock('../src/config/redis', () => ({
  getRedisClients: jest.fn(() => ({
    base: null,
    publisher: null,
    subscriber: null,
  })),
  closeRedis: jest.fn().mockResolvedValue(),
}));

jest.mock('../src/queues/chatPersistenceQueue', () => ({
  enqueueChatMessage: jest.fn(),
  getChatPersistenceQueue: jest.fn(() => {
    throw new Error('Redis is required for chat persistence');
  }),
}));

jest.mock('../src/workers/chatPersistenceWorker', () => ({
  startChatPersistenceWorker: jest.fn(),
  closeChatPersistenceWorker: jest.fn().mockResolvedValue(),
  isChatPersistenceWorkerRunning: jest.fn(() => false),
}));

const mockTx = {
  chatMessage: {
    upsert: jest.fn(),
  },
  chatThread: {
    updateMany: jest.fn(),
    update: jest.fn(),
  },
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
  chatParticipant: {
    findUnique: jest.fn(),
  },
  chatThread: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(async (cb) => cb(mockTx)),
};

jest.mock('../src/config/prisma', () => ({
  prisma: mockPrisma,
  disconnectPrisma: jest.fn().mockResolvedValue(),
}));

const roomEmissions = [];
let connectionHandler = null;

jest.mock('socket.io', () => {
  class MockServer {
    constructor() {
      this.middlewares = [];
    }

    use(fn) {
      this.middlewares.push(fn);
    }

    on(event, handler) {
      if (event === 'connection') {
        connectionHandler = handler;
      }
    }

    to(room) {
      return {
        emit: (event, payload) => {
          roomEmissions.push({ room, event, payload });
        },
      };
    }

    close(cb) {
      if (cb) cb();
    }
  }

  return { Server: MockServer };
});

const { initSocketServer, closeSocketServer } = require('../src/config/socket');
const { enqueueChatMessage } = require('../src/queues/chatPersistenceQueue');
const { isChatPersistenceWorkerRunning } = require('../src/workers/chatPersistenceWorker');

function createMockSocket(id, user) {
  const emitter = new EventEmitter();
  const joinedRooms = new Set();
  const socketEmissions = [];
  const socketRoomEmissions = [];

  const socket = {
    id,
    user,
    userId: user.id,
    rooms: joinedRooms,
    on: emitter.on.bind(emitter),
    emit: (event, payload) => {
      socketEmissions.push({ event, payload });
    },
    join: jest.fn((room) => {
      joinedRooms.add(room);
    }),
    leave: jest.fn((room) => {
      joinedRooms.delete(room);
    }),
    to: (room) => ({
      emit: (event, payload) => {
        socketRoomEmissions.push({ room, event, payload });
      },
    }),
    removeAllListeners: () => emitter.removeAllListeners(),
    trigger: async (event, ...args) => {
      const listeners = emitter.listeners(event);
      for (const listener of listeners) {
        await listener(...args);
      }
    },
    socketEmissions,
    socketRoomEmissions,
  };

  return socket;
}

describe('Socket.io Chat Persistence Fallback & Guards', () => {
  const senderUser = {
    id: '11111111-1111-4111-8111-111111111111',
    clerkUserId: 'user_2sender_clerk',
    name: 'Sender Student',
    email: 'sender@example.com',
    deletedAt: null,
  };

  const threadId = '22222222-2222-4222-8222-222222222222';

  beforeEach(async () => {
    jest.clearAllMocks();
    roomEmissions.length = 0;
    connectionHandler = null;
    delete process.env.STANDALONE_WORKER;

    mockPrisma.chatParticipant.findUnique.mockResolvedValue({
      threadId,
      userId: senderUser.id,
      leftAt: null,
    });
    mockPrisma.chatThread.findUnique.mockResolvedValue({
      id: threadId,
      participants: [],
    });
    mockTx.chatMessage.upsert.mockImplementation(async ({ create }) => ({
      id: create.id || '33333333-3333-4333-8333-333333333333',
      threadId: create.threadId,
      senderId: create.senderId,
      clientMessageId: create.clientMessageId,
      text: create.text,
      createdAt: create.createdAt || new Date(),
    }));
    mockTx.chatThread.updateMany.mockResolvedValue({ count: 1 });

    initSocketServer({});
  });

  afterEach(async () => {
    await closeSocketServer();
  });

  it('persists chat:message directly to Postgres via Prisma when BullMQ is disabled/unavailable', async () => {
    enqueueChatMessage.mockRejectedValue(new Error('Redis is required for chat persistence'));
    isChatPersistenceWorkerRunning.mockReturnValue(false);

    const socket = createMockSocket('sock-1', senderUser);
    connectionHandler(socket);

    const ack = jest.fn();
    await socket.trigger(
      'chat:message',
      {
        threadId,
        text: 'Hello without BullMQ!',
        clientMessageId: 'local-123',
      },
      ack,
    );

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.chatMessage.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          senderId_clientMessageId: {
            senderId: senderUser.id,
            clientMessageId: 'local-123',
          },
        },
        create: expect.objectContaining({
          threadId,
          senderId: senderUser.id,
          clientMessageId: 'local-123',
          text: 'Hello without BullMQ!',
        }),
      }),
    );
    expect(mockTx.chatThread.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: threadId }),
        data: expect.objectContaining({
          lastMessage: 'Hello without BullMQ!',
          lastSenderId: senderUser.id,
        }),
      }),
    );

    const emittedChatMsg = roomEmissions.find((e) => e.event === 'chat:message');
    expect(emittedChatMsg).toBeDefined();
    expect(emittedChatMsg.room).toBe(`thread:${threadId}`);
    expect(emittedChatMsg.payload).toMatchObject({
      clientMessageId: 'local-123',
      senderId: senderUser.id,
      senderUid: senderUser.clerkUserId,
      text: 'Hello without BullMQ!',
      status: 'sent',
    });
    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true }),
    );
  });

  it('persists directly to Postgres when enqueue succeeds but in-process worker is absent', async () => {
    enqueueChatMessage.mockResolvedValue('job-1');
    isChatPersistenceWorkerRunning.mockReturnValue(false);

    const socket = createMockSocket('sock-no-worker', senderUser);
    connectionHandler(socket);

    const ack = jest.fn();
    await socket.trigger(
      'chat:message',
      {
        threadId,
        text: 'Render single dyno message',
        clientMessageId: 'local-render-1',
      },
      ack,
    );

    expect(mockTx.chatMessage.upsert).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: expect.objectContaining({ status: 'sent' }),
      }),
    );
  });

  it('enforces per-socket token-bucket rate limit (max 5 messages per 2 seconds)', async () => {
    enqueueChatMessage.mockRejectedValue(new Error('BullMQ disabled'));
    isChatPersistenceWorkerRunning.mockReturnValue(false);

    const socket = createMockSocket('sock-rate', senderUser);
    connectionHandler(socket);

    for (let i = 1; i <= 5; i += 1) {
      const ack = jest.fn();
      await socket.trigger(
        'chat:message',
        {
          threadId,
          text: `Message ${i}`,
          clientMessageId: `local-${i}`,
        },
        ack,
      );
      expect(ack).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    }

    const sixthAck = jest.fn();
    await socket.trigger(
      'chat:message',
      {
        threadId,
        text: 'Message 6 (spam)',
        clientMessageId: 'local-6',
      },
      sixthAck,
    );

    expect(sixthAck).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        error: expect.stringMatching(/Rate limit/i),
      }),
    );
    expect(mockTx.chatMessage.upsert).toHaveBeenCalledTimes(5);
  });

  it('does not emit offline presence until the user closes their last active socket', async () => {
    const socketTab1 = createMockSocket('sock-tab-1', senderUser);
    const socketTab2 = createMockSocket('sock-tab-2', senderUser);

    connectionHandler(socketTab1);
    connectionHandler(socketTab2);

    await socketTab1.trigger('thread:join', { threadId });
    await socketTab2.trigger('thread:join', { threadId });

    // Closing Tab 1 should NOT emit offline because Tab 2 is still connected
    await socketTab1.trigger('disconnecting');
    expect(socketTab1.socketRoomEmissions).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          event: 'presence:changed',
          payload: { userId: senderUser.id, status: 'offline' },
        }),
      ]),
    );

    // Closing Tab 2 drops active count to 0 -> emits offline
    await socketTab2.trigger('disconnecting');
    expect(socketTab2.socketRoomEmissions).toContainEqual({
      room: `thread:${threadId}`,
      event: 'presence:changed',
      payload: { userId: senderUser.id, status: 'offline' },
    });
  });
});
