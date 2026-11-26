import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { doubtService } from '../services/doubtService';
import { useDoubts, useToggleDoubtUpvote } from './useDoubtForum';
import { queryKeys } from './queryKeys';

vi.mock('../services/doubtService', () => ({
  doubtService: {
    getAllDoubts: vi.fn(),
    toggleUpvote: vi.fn(),
  },
}));

describe('useDoubts', () => {
  it('fetches and caches the selected forum filter', async () => {
    doubtService.getAllDoubts.mockResolvedValue({ data: [{ id: 'doubt-1' }] });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDoubts('#DSA'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data.data).toEqual([{ id: 'doubt-1' }]);
    expect(doubtService.getAllDoubts).toHaveBeenCalledWith('#DSA');
  });

  it('toggles upvote on a doubt', async () => {
    doubtService.toggleUpvote.mockResolvedValue({ success: true, data: { upvotes: 5, hasUpvoted: true } });
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useToggleDoubtUpvote(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('doubt-123');
    });

    expect(doubtService.toggleUpvote).toHaveBeenCalledWith('doubt-123');
  });

  it('optimistically updates upvote state in onMutate and rolls back on error', async () => {
    let rejectUpvote;
    doubtService.toggleUpvote.mockImplementation(
      () => new Promise((_resolve, reject) => {
        rejectUpvote = reject;
      }),
    );

    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(queryKeys.doubts('All Doubts'), {
      data: [{ id: 'doubt-opt-1', upvotes: 4, hasUpvoted: false }],
    });

    const wrapper = ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useToggleDoubtUpvote(), { wrapper });

    let pendingPromise;
    await act(async () => {
      pendingPromise = result.current.mutateAsync('doubt-opt-1').catch(() => {});
    });

    // Optimistically incremented before server resolves
    await waitFor(() => {
      const cached = client.getQueryData(queryKeys.doubts('All Doubts'));
      expect(cached.data[0].upvotes).toBe(5);
      expect(cached.data[0].hasUpvoted).toBe(true);
    });

    // Trigger failure and verify rollback
    await act(async () => {
      rejectUpvote(new Error('Network error'));
      await pendingPromise;
    });

    await waitFor(() => {
      const rolledBack = client.getQueryData(queryKeys.doubts('All Doubts'));
      expect(rolledBack.data[0].upvotes).toBe(4);
      expect(rolledBack.data[0].hasUpvoted).toBe(false);
    });
  });
});
