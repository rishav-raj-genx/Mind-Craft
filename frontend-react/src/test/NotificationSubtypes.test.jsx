import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { NotificationProvider } from '../context/NotificationContext';
import Notifications from '../pages/Notifications';
import * as authContext from '../context/AuthContext';
import { chatService } from '../services/chatService';
import { sessionService } from '../services/sessionService';
import { gamificationService } from '../services/gamificationService';
import { doubtService } from '../services/doubtService';
import { matchService } from '../services/matchService';

const mockSocketHandlers = {};
const mockSocketInstance = {
  connected: true,
  auth: {},
  on: vi.fn((event, handler) => {
    mockSocketHandlers[event] = handler;
  }),
  off: vi.fn((event) => {
    delete mockSocketHandlers[event];
  }),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocketInstance),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/chatService', () => ({
  chatService: {
    getThreads: vi.fn(),
    markRead: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
  },
}));

vi.mock('../services/sessionService', () => ({
  sessionService: {
    getSessions: vi.fn(),
    acceptSession: vi.fn(),
    rejectSession: vi.fn(),
    getGoogleAuthUrl: vi.fn(),
  },
}));

vi.mock('../services/gamificationService', () => ({
  gamificationService: {
    getStreak: vi.fn(),
  },
}));

vi.mock('../services/doubtService', () => ({
  doubtService: {
    getAllDoubts: vi.fn(),
  },
}));

vi.mock('../services/matchService', () => ({
  matchService: {
    getMatchRequests: vi.fn(),
    acceptRequest: vi.fn(),
    declineRequest: vi.fn(),
  },
}));

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-testid="location-display">{`${location.pathname}${location.search}`}</div>;
};

describe('NotificationSubtypes & Inbox Hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.keys(mockSocketHandlers).forEach((k) => delete mockSocketHandlers[k]);

    authContext.useAuth.mockReturnValue({
      currentUser: { uid: 'clerk-user-1', name: 'Alice' },
      getToken: vi.fn().mockResolvedValue('test-token'),
      isRegistered: true,
      needsOnboarding: false,
    });

    chatService.getThreads.mockResolvedValue({ data: [] });
    sessionService.getSessions.mockResolvedValue({ data: [] });
    gamificationService.getStreak.mockResolvedValue({ data: { currentStreak: 0 } });
    doubtService.getAllDoubts.mockResolvedValue({ data: [] });
    matchService.getMatchRequests.mockResolvedValue({ data: [] });
    matchService.acceptRequest.mockResolvedValue({ success: true, data: { matchId: 'thread-1' } });
    matchService.declineRequest.mockResolvedValue({ success: true });
  });

  function renderNotificationsPage() {
    return render(
      <MemoryRouter initialEntries={['/notifications']}>
        <NotificationProvider>
          <Routes>
            <Route
              path="/notifications"
              element={
                <>
                  <Notifications />
                  <LocationDisplay />
                </>
              }
            />
            <Route path="/forum" element={<LocationDisplay />} />
            <Route path="/chat/:matchId" element={<LocationDisplay />} />
          </Routes>
        </NotificationProvider>
      </MemoryRouter>,
    );
  }

  it('renders new_answer and answer_accepted subtypes with proper titles and navigation links', async () => {
    renderNotificationsPage();

    await waitFor(() => {
      expect(mockSocketHandlers.global_forum_doubt).toBeDefined();
    });

    act(() => {
      mockSocketHandlers.global_forum_doubt({
        type: 'global_forum_doubt',
        subType: 'new_answer',
        timestamp: 1000,
        data: {
          doubtId: 'doubt-1',
          authorUid: 'clerk-user-2',
          authorName: 'Bob',
          doubtTitle: 'Graph BFS Traversal',
          route: '/forum?doubtId=doubt-1',
        },
      });

      mockSocketHandlers.global_forum_doubt({
        type: 'global_forum_doubt',
        subType: 'answer_accepted',
        timestamp: 2000,
        data: {
          doubtId: 'doubt-2',
          answerId: 'ans-2',
          authorUid: 'clerk-user-3',
          doubtTitle: 'Async Await Promises',
          tokenReward: 10,
          route: '/forum?doubtId=doubt-2',
        },
      });
    });

    expect(await screen.findByText('New Answer to Your Doubt')).toBeInTheDocument();
    expect(screen.getByText('Bob answered: "Graph BFS Traversal"')).toBeInTheDocument();
    const acceptedTitles = screen.getAllByText('Solution Accepted! 🌟');
    expect(acceptedTitles.length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText('Your answer was marked as the accepted solution (+10 Tokens)!').length,
    ).toBeGreaterThanOrEqual(1);

    fireEvent.click(acceptedTitles[0]);

    await waitFor(() => {
      expect(screen.getByTestId('location-display').textContent).toBe('/forum?doubtId=doubt-2');
    });
  });

  it('hydrates offline pending match requests with Accept and Decline actions', async () => {
    matchService.getMatchRequests.mockResolvedValue({
      data: [
        {
          requestId: 'match-req-1',
          fromUid: 'clerk-user-2',
          requesterName: 'Bob',
          sharedSkill: 'TypeScript',
          status: 'PENDING',
          createdAt: Date.now(),
        },
      ],
    });

    renderNotificationsPage();

    expect(await screen.findByText('Match Request')).toBeInTheDocument();
    expect(
      screen.getByText('Bob requested to study with you for TypeScript!'),
    ).toBeInTheDocument();

    const acceptBtn = screen.getByRole('button', { name: /accept/i });
    const declineBtn = screen.getByRole('button', { name: /decline/i });
    expect(acceptBtn).toBeInTheDocument();
    expect(declineBtn).toBeInTheDocument();

    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(matchService.acceptRequest).toHaveBeenCalledWith('match-req-1');
      expect(screen.getByTestId('location-display').textContent).toBe('/chat/thread-1');
    });
  });

  it('enforces a FIFO cap of 100 items for mindcraft_read_notifs when marking all read', async () => {
    const existing = Array.from({ length: 98 }, (_, i) => `old-notif-${i}`);
    localStorage.setItem('mindcraft_read_notifs', JSON.stringify(existing));

    matchService.getMatchRequests.mockResolvedValue({
      data: Array.from({ length: 5 }, (_, i) => ({
        requestId: `req-${i}`,
        requesterName: `User ${i}`,
        sharedSkill: 'Math',
        status: 'PENDING',
        createdAt: Date.now() - i * 1000,
      })),
    });

    renderNotificationsPage();

    expect(await screen.findByText('User 0 requested to study with you for Math!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mark all read/i }));

    const persisted = JSON.parse(localStorage.getItem('mindcraft_read_notifs'));
    expect(persisted).toHaveLength(100);
    expect(persisted[0]).toBe('old-notif-3');
    expect(persisted[persisted.length - 1]).toBe('match-req-req-4');
  });

  it('subscribes to socket error events, handles them cleanly, and cleans up on unmount', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { unmount } = renderNotificationsPage();

    await waitFor(() => {
      expect(mockSocketHandlers.error).toBeDefined();
    });

    act(() => {
      mockSocketHandlers.error({ message: 'Unauthorized thread access' });
    });

    expect(warnSpy).toHaveBeenCalledWith('Socket error event:', 'Unauthorized thread access');

    unmount();
    expect(mockSocketInstance.off).toHaveBeenCalledWith('error', expect.any(Function));
    warnSpy.mockRestore();
  });
});
