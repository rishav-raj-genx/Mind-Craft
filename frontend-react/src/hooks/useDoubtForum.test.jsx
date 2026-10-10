import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { doubtService } from '../services/doubtService';
import { useDoubts } from './useDoubtForum';

vi.mock('../services/doubtService', () => ({
  doubtService: {
    getAllDoubts: vi.fn(),
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
});
