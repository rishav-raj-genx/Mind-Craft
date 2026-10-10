import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { matchService } from '../services/matchService';
import { usePeerMatches } from './usePeerMatches';

vi.mock('../services/matchService', () => ({
  matchService: {
    getMatches: vi.fn(),
  },
}));

describe('usePeerMatches', () => {
  it('does not fetch until a user id is available', async () => {
    const client = new QueryClient();
    const wrapper = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => usePeerMatches(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(matchService.getMatches).not.toHaveBeenCalled();
  });

  it('fetches matches for an authenticated user', async () => {
    matchService.getMatches.mockResolvedValue({ data: [{ tutor: { uid: 'peer-1' } }] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => usePeerMatches('user-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(matchService.getMatches).toHaveBeenCalledWith('user-1', {});
  });
});
