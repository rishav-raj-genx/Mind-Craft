const CACHE_PREFIX = 'mindcraft-cache:';

export const readCache = (key, fallback) => {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return fallback;
    return JSON.parse(raw).data ?? fallback;
  } catch {
    return fallback;
  }
};

export const writeCache = (key, data) => {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify({
      data,
      savedAt: Date.now(),
    }));
  } catch {
    // Ignore storage pressure/private-mode failures.
  }
};
