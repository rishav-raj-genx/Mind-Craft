import { QueryClient } from '@tanstack/react-query';

export const isRetryableError = (error) => {
  const status = error?.response?.status;
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return false;
  }
  return !status || status === 408 || status === 429 || status >= 500;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => failureCount < 1 && isRetryableError(error),
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
