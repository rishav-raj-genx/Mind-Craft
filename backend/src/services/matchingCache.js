let redisClient;

function getRedisClient() {
  if (redisClient !== undefined) return redisClient;
  if (!process.env.REDIS_URL) {
    redisClient = null;
    return redisClient;
  }

  try {
    const Redis = require('ioredis');
    redisClient = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    redisClient.on('error', (error) => {
      console.warn('Matching Redis cache unavailable:', error.message);
    });
  } catch (error) {
    console.warn('Matching Redis cache disabled:', error.message);
    redisClient = null;
  }
  return redisClient;
}

async function getCachedFeed(key) {
  const client = getRedisClient();
  if (!client) return null;
  try {
    if (client.status === 'wait') await client.connect();
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn('Matching cache read skipped:', error.message);
    return null;
  }
}

async function setCachedFeed(key, value, ttlSeconds = 60) {
  const client = getRedisClient();
  if (!client) return;
  try {
    if (client.status === 'wait') await client.connect();
    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (error) {
    console.warn('Matching cache write skipped:', error.message);
  }
}

async function invalidateMatchingFeeds(userId) {
  const client = getRedisClient();
  if (!client) return;
  try {
    if (client.status === 'wait') await client.connect();
    const keys = await client.keys(`match-feed:v1:${userId}:*`);
    if (keys.length) await client.del(...keys);
  } catch (error) {
    console.warn('Matching cache invalidation skipped:', error.message);
  }
}

module.exports = { getCachedFeed, setCachedFeed, invalidateMatchingFeeds };
