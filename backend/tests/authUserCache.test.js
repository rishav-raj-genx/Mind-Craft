jest.mock('../src/config/redis', () => {
  const values = new Map();
  const client = {
    status: 'ready',
    get: jest.fn(async (key) => values.get(key) || null),
    set: jest.fn(async (key, value) => {
      values.set(key, value);
      return 'OK';
    }),
    del: jest.fn(async (...keys) => {
      keys.forEach((key) => values.delete(key));
      return keys.length;
    }),
  };

  return {
    getRedisClients: () => ({ base: client }),
    __values: values,
    __client: client,
  };
});

const redis = require('../src/config/redis');
const {
  AUTH_USER_CACHE_TTL_SECONDS,
  getOrLoadAuthUser,
  invalidateAuthUserCache,
} = require('../src/services/authUserCache');

describe('auth user cache', () => {
  beforeEach(() => {
    redis.__values.clear();
    jest.clearAllMocks();
  });

  it('caches a resolved user in Redis for 60 seconds', async () => {
    const user = { id: 'db-user-1', clerkUserId: 'user_cache_1' };
    const loader = jest.fn().mockResolvedValue(user);

    await expect(getOrLoadAuthUser(user.clerkUserId, loader)).resolves.toEqual(user);
    expect(redis.__client.set).toHaveBeenCalledWith(
      'auth-user:v1:user_cache_1',
      JSON.stringify(user),
      'EX',
      AUTH_USER_CACHE_TTL_SECONDS,
    );
    await expect(getOrLoadAuthUser(user.clerkUserId, loader)).resolves.toEqual(user);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('coalesces simultaneous misses for the same Clerk user', async () => {
    const user = { id: 'db-user-2', clerkUserId: 'user_cache_2' };
    let resolveLoad;
    let notifyStarted;
    const loaderStarted = new Promise((resolve) => {
      notifyStarted = resolve;
    });
    const loader = jest.fn(() => {
      notifyStarted();
      return new Promise((resolve) => {
        resolveLoad = resolve;
      });
    });

    const first = getOrLoadAuthUser(user.clerkUserId, loader);
    const second = getOrLoadAuthUser(user.clerkUserId, loader);
    await loaderStarted;
    resolveLoad(user);

    await expect(Promise.all([first, second])).resolves.toEqual([user, user]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('invalidates cached and in-flight user data', async () => {
    const oldUser = { id: 'db-user-3', clerkUserId: 'user_cache_3' };
    await getOrLoadAuthUser(oldUser.clerkUserId, async () => oldUser);

    await invalidateAuthUserCache(oldUser.clerkUserId);

    expect(redis.__client.del).toHaveBeenCalledWith('auth-user:v1:user_cache_3');
    const freshUser = { ...oldUser, name: 'Updated' };
    await expect(getOrLoadAuthUser(oldUser.clerkUserId, async () => freshUser)).resolves.toEqual(freshUser);
  });
});
