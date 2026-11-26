import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Chat from '../pages/Chat';
import { NotificationProvider, useNotifications } from '../context/NotificationContext';
import * as authContext from '../context/AuthContext';
import * as appContext from '../context/AppContext';
import { chatService } from '../services/chatService';
import { sessionService } from '../services/sessionService';

const mockSocketHandlers = {};
const mockSocketInstance = {
  connected: true,
  auth: {},
  on: vi.fn((event, handler) => {
    mockSocketHandlers[event] = handler;
  }),
  emit: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('socket.io-client', () => ({
  io: vi.fn((_url, opts) => {
    mockSocketInstance.auth = opts?.auth;
    return mockSocketInstance;
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('../services/chatService', () => ({
  chatService: {
    getHistory: vi.fn(),
    getThreadDetail: vi.fn(),
    getThreads: vi.fn(),
    sendMessage: vi.fn(),
    markRead: vi.fn(),
    editMessage: vi.fn(),
    deleteMessage: vi.fn(),
  },
}));

vi.mock('../services/sessionService', () => ({
  sessionService: {
    getSessions: vi.fn(),
  },
}));

vi.mock('../components/RatingModal', () => ({
  default: () => null,
}));

const CURRENT_USER = {
  uid: 'user_2clerk_sender',
  id: 'user_2clerk_sender',
  name: 'Sender User',
};

const PARTNER = {
  uid: 'user_2clerk_partner',
  id: 'uuid-partner',
  name: 'Study Partner',
};

describe('ChatMessageReconciliation & Real-Time Socket Context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.keys(mockSocketHandlers).forEach((k) => delete mockSocketHandlers[k]);
    mockSocketInstance.connected = true;
    Element.prototype.scrollTo = vi.fn();

    authContext.useAuth.mockReturnValue({
      currentUser: CURRENT_USER,
      getToken: vi.fn().mockResolvedValue('initial_token'),
      isRegistered: true,
      needsOnboarding: false,
    });

    appContext.useAppContext.mockReturnValue({
      globalData: { topMates: [], followedUsers: [] },
    });

    chatService.getThreads.mockResolvedValue({ data: [] });
    chatService.getHistory.mockResolvedValue({ data: [] });
    chatService.getThreadDetail.mockResolvedValue({ data: { partner: PARTNER } });
    chatService.markRead.mockResolvedValue({ success: true });
    chatService.editMessage.mockResolvedValue({ success: true });
    chatService.deleteMessage.mockResolvedValue({ success: true });
    sessionService.getSessions.mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderChatWithNotifications() {
    return render(
      <MemoryRouter initialEntries={['/chat/thread-1']}>
        <NotificationProvider>
          <Routes>
            <Route path="/chat/:matchId" element={<Chat />} />
          </Routes>
        </NotificationProvider>
      </MemoryRouter>,
    );
  }

  it('updates optimistic message in place by localId without duplicating and renders with isMine: true', async () => {
    renderChatWithNotifications();

    await waitFor(() => {
      expect(mockSocketHandlers['chat:message']).toBeDefined();
    });

    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'Hello real-time world!' } });
    fireEvent.submit(input.closest('form'));

    // Optimistic message rendered once on right side (isMine: true -> bg-focus-purple)
    const optimisticText = await screen.findByText('Hello real-time world!');
    expect(optimisticText).toBeInTheDocument();
    expect(optimisticText.closest('div[class*="bg-focus-purple"]')).not.toBeNull();

    // Capture clientMessageId emitted over Socket.io
    const sentEmit = mockSocketInstance.emit.mock.calls.find(([event]) => event === 'chat:message');
    expect(sentEmit).toBeDefined();
    const sentPayload = sentEmit[1];
    expect(sentPayload.clientMessageId).toBeTruthy();

    // Server broadcasts chat:message back with Prisma UUID senderId and Clerk senderUid
    act(() => {
      mockSocketHandlers['chat:message']({
        messageId: '99999999-9999-4999-8999-999999999999',
        clientMessageId: sentPayload.clientMessageId,
        threadId: 'thread-1',
        senderId: 'prisma-uuid-sender',
        senderUid: CURRENT_USER.uid,
        senderName: CURRENT_USER.name,
        text: 'Hello real-time world!',
        createdAt: new Date().toISOString(),
      });
    });

    // Still only ONE message element, NOT duplicated on the left side
    const allMatches = screen.getAllByText('Hello real-time world!');
    expect(allMatches).toHaveLength(1);
    const bubble = allMatches[0].closest('div[class*="rounded-2xl"]');
    expect(bubble.className).toContain('bg-focus-purple');
    expect(bubble.parentElement.className).toContain('justify-end');
  });

  it('renders sender own server-emitted message with isMine: true when senderId is Prisma UUID and senderUid is Clerk ID', async () => {
    renderChatWithNotifications();

    await waitFor(() => {
      expect(mockSocketHandlers['chat:message']).toBeDefined();
    });

    act(() => {
      mockSocketHandlers['chat:message']({
        messageId: '88888888-8888-4888-8888-888888888888',
        clientMessageId: 'other-tab-local-id',
        threadId: 'thread-1',
        senderId: 'prisma-uuid-sender',
        senderUid: CURRENT_USER.uid,
        senderName: CURRENT_USER.name,
        text: 'From another tab',
        createdAt: new Date().toISOString(),
      });
    });

    const msgEl = await screen.findByText('From another tab');
    const bubble = msgEl.closest('div[class*="rounded-2xl"]');
    expect(bubble.className).toContain('bg-focus-purple');
    expect(bubble.parentElement.className).toContain('justify-end');
  });

  it('wires real-time message_edited and message_deleted events from socket to Chat UI', async () => {
    renderChatWithNotifications();

    await waitFor(() => {
      expect(mockSocketHandlers.message_edited).toBeDefined();
      expect(mockSocketHandlers.message_deleted).toBeDefined();
    });

    act(() => {
      mockSocketHandlers['chat:message']({
        messageId: 'msg-live-1',
        clientMessageId: 'local-live-1',
        threadId: 'thread-1',
        senderId: 'prisma-uuid-partner',
        senderUid: PARTNER.uid,
        senderName: PARTNER.name,
        text: 'Original partner text',
        createdAt: new Date().toISOString(),
      });
    });

    expect(await screen.findByText('Original partner text')).toBeInTheDocument();

    act(() => {
      mockSocketHandlers.message_edited({
        matchId: 'thread-1',
        messageId: 'msg-live-1',
        text: 'Edited partner text',
      });
    });

    expect(await screen.findByText('Edited partner text')).toBeInTheDocument();
    expect(screen.getByText('Edited')).toBeInTheDocument();

    act(() => {
      mockSocketHandlers.message_deleted({
        matchId: 'thread-1',
        messageId: 'msg-live-1',
      });
    });

    expect(screen.queryByText('Edited partner text')).not.toBeInTheDocument();
  });

  it('recovers from Clerk token expiration on connect_error by refreshing token with skipCache and reconnecting', async () => {
    vi.useFakeTimers();
    const getTokenMock = vi.fn().mockResolvedValue('refreshed_clerk_token');

    authContext.useAuth.mockReturnValue({
      currentUser: CURRENT_USER,
      getToken: getTokenMock,
      isRegistered: true,
      needsOnboarding: false,
    });

    const Probe = () => {
      useNotifications();
      return null;
    };

    render(
      <MemoryRouter initialEntries={['/find']}>
        <NotificationProvider>
          <Probe />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(mockSocketHandlers.connect_error).toBeDefined();

    await act(async () => {
      mockSocketHandlers.connect_error({
        message: 'AUTH_INVALID: Invalid authentication token',
        data: { code: 'AUTH_INVALID' },
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });

    expect(getTokenMock).toHaveBeenCalledWith({ skipCache: true });
    expect(mockSocketInstance.auth.token).toBe('refreshed_clerk_token');
    expect(mockSocketInstance.connect).toHaveBeenCalledTimes(1);
  });

  it('debounces markRead calls during rapid incoming message bursts', async () => {
    vi.useFakeTimers();

    renderChatWithNotifications();

    await act(async () => {
      await Promise.resolve();
    });

    chatService.markRead.mockClear();

    act(() => {
      for (let i = 1; i <= 5; i += 1) {
        mockSocketHandlers['chat:message']({
          messageId: `burst-${i}`,
          clientMessageId: `burst-local-${i}`,
          threadId: 'thread-1',
          senderId: 'prisma-uuid-partner',
          senderUid: PARTNER.uid,
          senderName: PARTNER.name,
          text: `Burst message ${i}`,
          createdAt: new Date().toISOString(),
        });
      }
    });

    // Before 300ms debounce expires, markRead should not have fired yet
    expect(chatService.markRead).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(chatService.markRead).toHaveBeenCalledTimes(1);
    expect(chatService.markRead).toHaveBeenCalledWith('thread-1');
  });
});
