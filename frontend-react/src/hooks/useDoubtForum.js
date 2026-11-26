import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doubtService } from '../services/doubtService';
import { queryKeys } from './queryKeys';

export const useDoubts = (filter = 'All Doubts', options = {}) => useQuery({
  queryKey: queryKeys.doubts(filter),
  queryFn: () => doubtService.getAllDoubts(filter),
  refetchInterval: (query) => {
    const list = query.state.data?.data;
    if (Array.isArray(list) && list.some((d) => d.aiAssistStatus === 'pending')) {
      return 3000;
    }
    return false;
  },
  ...options,
});

export const useTrendingDoubts = (options = {}) => useQuery({
  queryKey: queryKeys.trendingDoubts,
  queryFn: doubtService.getTrending,
  ...options,
});

export const useCreateDoubt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: doubtService.createDoubt,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doubts'] });
    },
  });
};

export const useAddAnswer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ doubtId, content }) => doubtService.addAnswer(doubtId, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doubts'] }),
  });
};

export const useToggleDoubtUpvote = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (doubtId) => doubtService.toggleUpvote(doubtId),
    onMutate: async (doubtId) => {
      await queryClient.cancelQueries({ queryKey: ['doubts'] });
      const previousQueries = queryClient.getQueriesData({ queryKey: ['doubts'] });

      queryClient.setQueriesData({ queryKey: ['doubts'] }, (old) => {
        if (!old || !Array.isArray(old.data)) return old;
        let changed = false;
        const nextData = old.data.map((doubt) => {
          if (doubt?.id !== doubtId) return doubt;
          changed = true;
          const nextHasUpvoted = !doubt.hasUpvoted;
          const currentUpvotes = typeof doubt.upvotes === 'number' ? doubt.upvotes : 0;
          return {
            ...doubt,
            hasUpvoted: nextHasUpvoted,
            upvotes: Math.max(0, currentUpvotes + (nextHasUpvoted ? 1 : -1)),
          };
        });
        return changed ? { ...old, data: nextData } : old;
      });

      return { previousQueries };
    },
    onError: (_err, _doubtId, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['doubts'] });
    },
  });
};

export const useResolveDoubt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (doubtId) => doubtService.resolveDoubt(doubtId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doubts'] }),
  });
};

export const useAcceptAnswer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ doubtId, answerId }) => doubtService.acceptAnswer(doubtId, answerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doubts'] }),
  });
};
