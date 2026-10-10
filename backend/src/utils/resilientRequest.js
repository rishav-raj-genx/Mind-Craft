const sleep = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

const getProviderStatus = (error) => error?.response?.status || error?.statusCode || null;

const isRetryableError = (error) => {
  const status = getProviderStatus(error);
  if (error?.code === 'SARVAM_TIMEOUT' || error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
    return true;
  }
  if (!status) return Boolean(error?.request || error?.code === 'ERR_NETWORK');
  return status === 408 || status === 429 || status >= 500;
};

const normalizeProviderError = (error, {
  provider = 'external-provider',
  operation = 'request',
} = {}) => {
  const status = getProviderStatus(error);
  const timedOut = error?.code === 'ECONNABORTED'
    || error?.code === 'ETIMEDOUT'
    || error?.code === 'SARVAM_TIMEOUT'
    || error?.message?.toLowerCase().includes('timeout');
  const responseBody = error?.response?.data;
  const providerMessage = responseBody?.message || responseBody?.error;

  const normalized = new Error(
    timedOut
      ? `${provider} ${operation} timed out`
      : providerMessage || error?.message || `${provider} ${operation} failed`,
  );
  normalized.name = 'ProviderRequestError';
  normalized.provider = provider;
  normalized.operation = operation;
  normalized.statusCode = timedOut ? 504 : (status >= 500 || !status ? 503 : status);
  normalized.providerStatus = status;
  normalized.retryable = isRetryableError(error);
  normalized.code = timedOut ? 'SARVAM_TIMEOUT' : (error?.code || `SARVAM_HTTP_${status || 'NETWORK'}`);
  normalized.cause = error;
  return normalized;
};

async function requestWithRetry(operation, options = {}) {
  const {
    attempts = 1,
    baseDelayMs = 250,
    maxDelayMs = 3000,
    provider = 'external-provider',
    operationName = 'request',
    shouldRetry = isRetryableError,
  } = options;

  let lastError;
  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = normalizeProviderError(error, {
        provider,
        operation: operationName,
      });

      if (attempt >= attempts || !shouldRetry(lastError)) {
        lastError.attempts = attempt;
        throw lastError;
      }

      const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * (2 ** (attempt - 1)));
      const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exponentialDelay * 0.25)));
      await sleep(exponentialDelay + jitter);
    }
  }

  throw lastError;
}

const isTimeoutError = (error) => error?.code === 'SARVAM_TIMEOUT'
  || error?.code === 'ECONNABORTED'
  || error?.code === 'ETIMEDOUT';

const withAxiosTimeout = (config, timeoutMs) => ({
  ...config,
  timeout: timeoutMs,
});

module.exports = {
  isRetryableError,
  isTimeoutError,
  normalizeProviderError,
  requestWithRetry,
  withAxiosTimeout,
};
