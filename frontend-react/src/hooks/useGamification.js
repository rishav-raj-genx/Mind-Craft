import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gamificationService } from '../services/gamificationService';
import { queryKeys } from './queryKeys';

export const useStreak = (uid, options = {}) => useQuery({
  queryKey: queryKeys.streak(uid),
  queryFn: () => gamificationService.getStreak(uid),
  enabled: Boolean(uid) && (options.enabled ?? true),
  ...options,
});

export const useBadges = (uid, options = {}) => useQuery({
  queryKey: queryKeys.badges(uid),
  queryFn: () => gamificationService.getBadges(uid),
  enabled: Boolean(uid) && (options.enabled ?? true),
  ...options,
});

export const useTokens = (uid, options = {}) => useQuery({
  queryKey: queryKeys.tokens(uid),
  queryFn: () => gamificationService.getTokens(uid),
  enabled: Boolean(uid) && (options.enabled ?? true),
  ...options,
});

export const useLeaderboard = (options = {}) => useQuery({
  queryKey: queryKeys.leaderboard,
  queryFn: gamificationService.getLeaderboard,
  ...options,
});

export const useCheckIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: gamificationService.checkIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streak'] });
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
  });
};
