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
    redisClient.on('error', (err) => {
      console.error('[MatchingCache Redis Error]:', err.message);
    });
  } catch (error) {
    console.error('[MatchingCache Redis Error]:', error.message);
    redisClient = null;
  }
  return redisClient;
}

const DEFAULT_CACHE_TTL_SECONDS = 300; // 5 minutes explicit TTL to prevent unbounded cache growth

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

async function setCachedFeed(key, value, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) {
  const client = getRedisClient();
  if (!client) return;
  try {
    if (client.status === 'wait') await client.connect();
    const ttl = Number.isInteger(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : DEFAULT_CACHE_TTL_SECONDS;
    await client.set(key, JSON.stringify(value), 'EX', ttl);
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
