import { describe, expect, it, vi } from 'vitest';
import api from '../config/api';
import { doubtService } from './doubtService';

vi.mock('../config/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('doubtService', () => {
  it('toggleUpvote issues POST /doubt/:id/upvote (HIGH-30)', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { upvotes: 3, hasUpvoted: true } } });
    const result = await doubtService.toggleUpvote('doubt-uuid');

    expect(api.post).toHaveBeenCalledWith('/doubt/doubt-uuid/upvote');
    expect(result.data.upvotes).toBe(3);
  });

  it('getTrending issues GET /doubt/trending (HIGH-29)', async () => {
    api.get.mockResolvedValue({ data: { success: true, data: [{ tag: '#DSA', count: 5 }] } });
    const result = await doubtService.getTrending();

    expect(api.get).toHaveBeenCalledWith('/doubt/trending');
    expect(result.data).toHaveLength(1);
  });

  it('acceptAnswer issues POST /doubt/:id/answer/:answerId/accept (HIGH-31)', async () => {
    api.post.mockResolvedValue({ data: { success: true, message: 'Answer accepted' } });
    const result = await doubtService.acceptAnswer('doubt-1', 'answer-1');

    expect(api.post).toHaveBeenCalledWith('/doubt/doubt-1/answer/answer-1/accept');
    expect(result.success).toBe(true);
  });
});
