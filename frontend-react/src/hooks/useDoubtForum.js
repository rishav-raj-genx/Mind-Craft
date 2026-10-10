import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { doubtService } from '../services/doubtService';
import { queryKeys } from './queryKeys';

export const useDoubts = (filter = 'All Doubts', options = {}) => useQuery({
  queryKey: queryKeys.doubts(filter),
  queryFn: () => doubtService.getAllDoubts(filter),
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
    mutationFn: doubtService.toggleUpvote,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doubts'] }),
  });
};

export const useResolveDoubt = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: doubtService.resolveDoubt,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['doubts'] }),
  });
};
