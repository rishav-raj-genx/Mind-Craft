const Redis = require('ioredis');

let clients;

function createRedisClient() {
  if (!process.env.REDIS_URL) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('REDIS_URL is required in production');
    }
    return null;
  }

  return new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

function getRedisClients() {
  if (clients) return clients;
  const base = createRedisClient();
  if (!base) {
    clients = { base: null, publisher: null, subscriber: null };
    return clients;
  }

  clients = {
    base,
    publisher: base,
    subscriber: base.duplicate(),
  };
  return clients;
}

async function closeRedis() {
  if (!clients) return;
  await Promise.all(
    [clients.base, clients.subscriber]
      .filter(Boolean)
      .map((client) => client.quit().catch(() => client.disconnect())),
  );
  clients = null;
}

module.exports = { getRedisClients, closeRedis };
