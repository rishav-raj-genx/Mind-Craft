const { getRedisClients } = require('../config/redis');

const AUTH_USER_CACHE_TTL_SECONDS = 60;
const AUTH_USER_CACHE_PREFIX = 'auth-user:v1:';
const inFlightLoads = new Map();
const cacheEpochs = new Map();

function getRedisClient() {
  try {
    return getRedisClients()?.base || null;
  } catch (error) {
    console.warn('Auth user cache unavailable:', error.message);
    return null;
  }
}

function getCacheKey(clerkUserId) {
  return `${AUTH_USER_CACHE_PREFIX}${clerkUserId}`;
}

async function prepareClient(client) {
  if (client?.status === 'wait') await client.connect();
}

async function getCachedAuthUser(clerkUserId) {
  if (!clerkUserId) return null;
  const client = getRedisClient();
  if (!client) return null;

  try {
    await prepareClient(client);
    const value = await client.get(getCacheKey(clerkUserId));
    if (!value) return null;
    const user = JSON.parse(value);
    return user?.clerkUserId === clerkUserId ? user : null;
  } catch (error) {
    console.warn('Auth user cache read skipped:', error.message);
    return null;
  }
}

async function setCachedAuthUser(clerkUserId, user) {
  if (!clerkUserId || !user) return;
  const client = getRedisClient();
  if (!client) return;

  try {
    await prepareClient(client);
    await client.set(
      getCacheKey(clerkUserId),
      JSON.stringify(user),
      'EX',
      AUTH_USER_CACHE_TTL_SECONDS,
    );
  } catch (error) {
    console.warn('Auth user cache write skipped:', error.message);
  }
}

async function getOrLoadAuthUser(clerkUserId, loader, { bypassCache = false } = {}) {
  if (!clerkUserId) return loader();

  if (!bypassCache) {
    const cached = await getCachedAuthUser(clerkUserId);
    if (cached) return cached;

    const pending = inFlightLoads.get(clerkUserId);
    if (pending) return pending;
  }

  const epoch = cacheEpochs.get(clerkUserId) || 0;
  const load = Promise.resolve()
    .then(loader)
    .then(async (user) => {
      if (!bypassCache && user && (cacheEpochs.get(clerkUserId) || 0) === epoch) {
        await setCachedAuthUser(clerkUserId, user);
      }
      return user;
    });

  if (bypassCache) return load;
  inFlightLoads.set(clerkUserId, load);
  try {
    return await load;
  } finally {
    if (inFlightLoads.get(clerkUserId) === load) inFlightLoads.delete(clerkUserId);
  }
}

async function invalidateAuthUserCache(...clerkUserIds) {
  const ids = [...new Set(clerkUserIds.flat().filter((id) => typeof id === 'string' && id))];
  if (!ids.length) return;

  for (const id of ids) {
    cacheEpochs.set(id, (cacheEpochs.get(id) || 0) + 1);
    inFlightLoads.delete(id);
  }

  const client = getRedisClient();
  if (!client) return;

  try {
    await prepareClient(client);
    await client.del(...ids.map(getCacheKey));
  } catch (error) {
    console.warn('Auth user cache invalidation skipped:', error.message);
  }
}

module.exports = {
  AUTH_USER_CACHE_TTL_SECONDS,
  getCachedAuthUser,
  getOrLoadAuthUser,
  invalidateAuthUserCache,
};