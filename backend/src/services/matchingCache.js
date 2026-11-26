const { getRedisClients } = require('../config/redis');

function getRedisClient() {
  try {
    const clients = getRedisClients();
    return clients?.base || null;
  } catch (error) {
    console.warn('[MatchingCache Redis Error]:', error.message);
    return null;
  }
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

const MATCH_FEED_PREFIX = 'match-feed:v1';

async function deleteMatchingKeys(client, pattern) {
  if (typeof client.scan === 'function') {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (Array.isArray(keys) && keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== '0');
    return;
  }

  if (typeof client.keys === 'function') {
    const keys = await client.keys(pattern);
    if (Array.isArray(keys) && keys.length > 0) {
      await client.del(...keys);
    }
  }
}

async function invalidateMatchingFeeds(userId) {
  const client = getRedisClient();
  if (!client) return;
  try {
    if (client.status === 'wait') await client.connect();
    // Clear the user's feed and all peer/campus match feeds so new/updated peers appear immediately
    if (userId) {
      await deleteMatchingKeys(client, `${MATCH_FEED_PREFIX}:${userId}:*`);
    }
    await deleteMatchingKeys(client, `${MATCH_FEED_PREFIX}:*`);
  } catch (error) {
    console.warn('Matching cache invalidation skipped:', error.message);
  }
}

module.exports = { getCachedFeed, setCachedFeed, invalidateMatchingFeeds };
