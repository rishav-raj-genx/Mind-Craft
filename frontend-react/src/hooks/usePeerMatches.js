import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { matchService } from '../services/matchService';
import { userService } from '../services/userService';
import { queryKeys } from './queryKeys';

export const usePeerMatches = (uid, filters = {}, options = {}) => useQuery({
  queryKey: queryKeys.matches(uid, filters),
  queryFn: () => matchService.getMatches(uid, filters),
  enabled: Boolean(uid) && (options.enabled ?? true),
  ...options,
});

export const useBroadPeerMatches = (uid, options = {}) => useQuery({
  queryKey: queryKeys.broadMatches(uid),
  queryFn: () => matchService.getBroadMatches(uid),
  enabled: Boolean(uid) && (options.enabled ?? true),
  ...options,
});

export const useFollowing = (uid, options = {}) => useQuery({
  queryKey: queryKeys.following(uid),
  queryFn: () => userService.getFollowing(uid),
  enabled: Boolean(uid) && (options.enabled ?? true),
  ...options,
});

export const useSearchUsers = (query, options = {}) => useQuery({
  queryKey: queryKeys.searchUsers(query),
  queryFn: () => userService.searchUsers(query),
  enabled: Boolean(query?.trim()) && (options.enabled ?? true),
  ...options,
});

export const useMetadataOptions = (options = {}) => useQuery({
  queryKey: queryKeys.metadataOptions,
  queryFn: userService.getMetadataOptions,
  ...options,
});

export const useSendMatchRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: matchService.sendRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['matches'] }),
  });
};

export const useFollowUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: userService.followUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['following'] }),
  });
};
