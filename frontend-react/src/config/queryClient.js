import { QueryClient } from '@tanstack/react-query';

const isRetryableError = (error) => {
  const status = error?.response?.status;
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
