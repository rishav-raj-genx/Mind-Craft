import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import DoubtForum from '../pages/DoubtForum';
import * as doubtHooks from '../hooks/useDoubtForum';
import * as authContext from '../context/AuthContext';
import * as notifContext from '../context/NotificationContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../context/NotificationContext', () => ({
  useNotifications: vi.fn(),
}));

vi.mock('../hooks/useDoubtForum', () => ({
  useDoubts: vi.fn(),
  useCreateDoubt: vi.fn(),
  useAddAnswer: vi.fn(),
  useResolveDoubt: vi.fn(),
  useToggleDoubtUpvote: vi.fn(),
  useAcceptAnswer: vi.fn(),
}));

vi.mock('../services/voiceService', () => ({
  voiceService: { search: vi.fn() },
}));

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
};

describe('DoubtForum URL ?tag= parameter routing & server filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    authContext.useAuth.mockReturnValue({
      currentUser: { uid: 'user-1', name: 'Test User' },
    });

    notifContext.useNotifications.mockReturnValue({
      markForumVisited: vi.fn(),
    });

    doubtHooks.useDoubts.mockReturnValue({
      data: {
        data: [
          {
            id: 'd-dsa',
            title: 'Red-Black Tree rotations',
            content: 'How do left and right rotations preserve black-height?',
            tag: '#DSA',
            status: 'OPEN',
            authorUid: 'user-2',
            authorName: 'Peer',
            upvotes: 4,
            hasUpvoted: false,
            answers: [],
            images: [],
            createdAt: Date.now(),
          },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    doubtHooks.useCreateDoubt.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    doubtHooks.useAddAnswer.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    doubtHooks.useResolveDoubt.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    doubtHooks.useToggleDoubtUpvote.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
    doubtHooks.useAcceptAnswer.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  });

  it('sets active tag to #DSA when loading /forum?tag=%23DSA', async () => {
    render(
      <MemoryRouter initialEntries={['/forum?tag=%23DSA']}>
        <Routes>
          <Route
            path="/forum"
            element={(
              <>
                <DoubtForum />
                <LocationDisplay />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(doubtHooks.useDoubts).toHaveBeenCalledWith('#DSA');
    });

    const dsaBtn = screen.getByRole('button', { name: '#DSA' });
    expect(dsaBtn.className).toContain('bg-[#7C3AED]');
  });

  it('syncs URL search params when switching filter tabs and queries onlyMine for My Doubts', async () => {
    render(
      <MemoryRouter initialEntries={['/forum']}>
        <Routes>
          <Route
            path="/forum"
            element={(
              <>
                <DoubtForum />
                <LocationDisplay />
              </>
            )}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '#Math' }));
    await waitFor(() => {
      expect(screen.getByTestId('location-search')).toHaveTextContent('?tag=%23Math');
      expect(doubtHooks.useDoubts).toHaveBeenCalledWith('#Math');
    });

    fireEvent.click(screen.getByRole('button', { name: 'My Doubts' }));
    await waitFor(() => {
      expect(doubtHooks.useDoubts).toHaveBeenCalledWith(
        expect.objectContaining({ onlyMine: true }),
      );
    });
  });
});
