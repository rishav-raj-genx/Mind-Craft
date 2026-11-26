import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../hooks/queryKeys';
import { matchService } from '../services/matchService';
import { doubtService } from '../services/doubtService';
import { userService } from '../services/userService';

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

export function prefetchFindMateData(uid) {
  if (uid) {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.matches(uid, {}),
      queryFn: () => matchService.getMatches(uid, {}),
    });
  }
  void queryClient.prefetchQuery({
    queryKey: queryKeys.metadataOptions,
    queryFn: userService.getMetadataOptions,
  });
}

export function prefetchDoubtForumData() {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.doubts('All Doubts'),
    queryFn: () => doubtService.getAllDoubts('All Doubts'),
  });
  void queryClient.prefetchQuery({
    queryKey: queryKeys.trendingDoubts,
    queryFn: doubtService.getTrending,
  });
}

export function prefetchProfileData(uid) {
  if (!uid) return;
  void queryClient.prefetchQuery({
    queryKey: queryKeys.fullProfile(uid),
    queryFn: () => userService.getFullProfile(uid),
  });
}

export function prefetchRouteData(path, uid) {
  if (!path) return;
  if (path.startsWith('/find')) {
    prefetchFindMateData(uid);
  } else if (path.startsWith('/forum')) {
    prefetchDoubtForumData();
  } else if (path.startsWith('/profile')) {
    prefetchProfileData(uid);
  }
}
