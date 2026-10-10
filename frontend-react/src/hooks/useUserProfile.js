import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userService } from '../services/userService';
import { queryKeys } from './queryKeys';

export const useProfile = (uid, options = {}) => useQuery({
  queryKey: queryKeys.profile(uid),
  queryFn: () => userService.getProfile(uid),
  enabled: Boolean(uid) && (options.enabled ?? true),
  ...options,
});

export const useFullProfile = (uid, options = {}) => useQuery({
  queryKey: queryKeys.fullProfile(uid),
  queryFn: () => userService.getFullProfile(uid),
  enabled: Boolean(uid) && (options.enabled ?? true),
  ...options,
});

export const useUpdateProfile = (uid) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates) => userService.updateProfile(uid, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profile(uid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.fullProfile(uid) });
      queryClient.invalidateQueries({ queryKey: ['matches', uid] });
    },
  });
};
