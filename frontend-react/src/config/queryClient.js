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
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});
