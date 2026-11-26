import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../config/api';
import { queryClient } from '../config/queryClient';
import { chatService } from '../services/chatService';
import { useLocation, useNavigate } from 'react-router-dom';

const NotificationContext = createContext({});

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(NotificationContext);

const CATEGORIES = {
  MESSAGE: 'message',
  SESSION: 'session',
  GAMIFICATION: 'gamification',
  SOCIAL: 'social',
  REVIEW: 'review',
  FORUM: 'forum',
};

const sortThreadsByTimestamp = (threads) =>
  [...threads].sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

export const NotificationProvider = ({ children }) => {
  const { currentUser, getToken, isRegistered, needsOnboarding } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthPage =
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/signup') ||
    location.pathname.startsWith('/sso-callback');

  const shouldConnect = Boolean(
    currentUser && !isAuthPage && isRegistered && !needsOnboarding
  );

  const [threads, setThreads] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [unreadForumIds, setUnreadForumIds] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem('mindcraft_unread_forum');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch {
      return new Set();
    }
  });
  const [toastMessage, setToastMessage] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const socketRef = useRef(null);
  const chatListeners = useRef(new Map());
  const pathRef = useRef(location.pathname);
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    pathRef.current = location.pathname;
  }, [location.pathname]);

  const activeThreads = currentUser ? threads : [];
  const activeUnreadCounts = useMemo(
    () => (currentUser ? unreadCounts : {}),
    [currentUser, unreadCounts],
  );
  const activeNotifications = useMemo(
    () => (currentUser ? notifications : []),
    [currentUser, notifications],
  );

  const unreadChatCount = useMemo(
    () => Object.values(activeUnreadCounts).reduce((sum, c) => sum + c, 0),
    [activeUnreadCounts],
  );
  const unreadForumCount = currentUser ? unreadForumIds.size : 0;
  const hasUnreadNotifications = useMemo(
    () => activeNotifications.some((n) => !n.read),
    [activeNotifications],
  );

  const updateUnreadForumIds = useCallback((updater) => {
    setUnreadForumIds((prev) => {
      const next = updater(prev);
      localStorage.setItem('mindcraft_unread_forum', JSON.stringify([...next]));
      return next;
    });
  }, []);

  const pushNotification = useCallback((notif) => {
    setNotifications((prev) => {
      const existingIdx = prev.findIndex((n) => n.id === notif.id);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], ...notif };
        return updated;
      }
      return [notif, ...prev];
    });
  }, []);

  const fetchInitialData = useCallback(async () => {
    if (!shouldConnect || !currentUser) return;
    try {
      const res = await chatService.getThreads(currentUser.uid);
      const data = res.data || [];
      setThreads(sortThreadsByTimestamp(data));

      const counts = {};
      data.forEach((t) => {
        if (t.unread && t.lastMessageSender !== currentUser.uid) {
          counts[t.matchId] = (counts[t.matchId] || 0) + 1;
          pushNotification({
            id: `msg-${t.matchId}-${t.lastMessageTime || Date.now()}`,
            category: CATEGORIES.MESSAGE,
            type: 'UNREAD_CHAT',
            title: 'New Message',
            message: `You have an unread message from ${t.partner?.name || 'a study partner'}.`,
            timestamp: t.lastMessageTime || Date.now(),
            read: false,
            route: `/chat/${t.matchId}`,
            matchId: t.matchId,
          });
        }
      });
      setUnreadCounts(counts);
    } catch (err) {
      console.warn('Error fetching initial notification data', err);
    }
  }, [currentUser, pushNotification, shouldConnect]);

  useEffect(() => {
    if (!shouldConnect) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      chatListeners.current.clear();
      return;
    }

    let isMounted = true;

    async function loadData() {
      try {
        const res = await chatService.getThreads(currentUser.uid);
        if (!isMounted) return;
        const data = res.data || [];
        setThreads(sortThreadsByTimestamp(data));

        const counts = {};
        const newNotifs = [];
        data.forEach((t) => {
          if (t.unread && t.lastMessageSender !== currentUser.uid) {
            counts[t.matchId] = (counts[t.matchId] || 0) + 1;
            newNotifs.push({
              id: `msg-${t.matchId}-${t.lastMessageTime || Date.now()}`,
              category: CATEGORIES.MESSAGE,
              type: 'UNREAD_CHAT',
              title: 'New Message',
              message: `You have an unread message from ${t.partner?.name || 'a study partner'}.`,
              timestamp: t.lastMessageTime || Date.now(),
              read: false,
              route: `/chat/${t.matchId}`,
              matchId: t.matchId,
            });
          }
        });
        setUnreadCounts(counts);
        if (newNotifs.length > 0) {
          setNotifications((prev) => {
            const combined = [...prev];
            newNotifs.forEach((n) => {
              const idx = combined.findIndex((item) => item.id === n.id);
              if (idx !== -1) {
                combined[idx] = { ...combined[idx], ...n };
              } else {
                combined.unshift(n);
              }
            });
            return combined;
          });
        }
      } catch (err) {
        console.warn('Error fetching initial notification data', err);
      }
    }

    loadData();

    let authRetryCount = 0;
    let authRetryTimer = null;
    const MAX_AUTH_RETRIES = 5;

    const authHandler = async (cb) => {
      try {
        if (authHandler.token) {
          const refreshedToken = authHandler.token;
          delete authHandler.token;
          cb({ token: refreshedToken });
          return;
        }
        const token = await getTokenRef.current?.();
        cb({ token });
      } catch {
        cb({});
      }
    };

    const socket = io(API_BASE_URL, {
      path: '/socket.io',
      auth: authHandler,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (!isMounted) return;
      authRetryCount = 0;
      if (authRetryTimer) {
        clearTimeout(authRetryTimer);
        authRetryTimer = null;
      }
      chatListeners.current.forEach((_callback, matchId) => {
        socket.emit('thread:join', { threadId: matchId });
      });
    });

    socket.on('connect_error', async (err) => {
      if (!isMounted) return;
      const errCode = err?.data?.code;
      const errMessage = err?.message || '';
      const isAuthFailure =
        errCode === 'AUTH_INVALID' ||
        errCode === 'AUTH_REQUIRED' ||
        /AUTH_INVALID|AUTH_REQUIRED|authentication|token|unauthorized/i.test(errMessage);

      if (!isAuthFailure || authRetryCount >= MAX_AUTH_RETRIES) {
        return;
      }

      const backoffMs = Math.min(1000 * (2 ** authRetryCount), 30000);
      authRetryCount += 1;

      if (authRetryTimer) {
        clearTimeout(authRetryTimer);
      }

      authRetryTimer = setTimeout(async () => {
        if (!isMounted) return;
        try {
          const freshToken = await getTokenRef.current?.({ skipCache: true });
          if (!isMounted || !freshToken) return;
          if (socket.auth && typeof socket.auth === 'object') {
            socket.auth.token = freshToken;
          } else if (typeof socket.auth === 'function') {
            socket.auth.token = freshToken;
          } else {
            socket.auth = { token: freshToken };
          }
          socket.connect();
        } catch (refreshErr) {
          console.warn('Socket auth token refresh failed', refreshErr);
        }
      }, backoffMs);
    });

    socket.on('chat:message', (message) => {
      if (!isMounted) return;
      const matchId = message.threadId;
      const resolvedSenderUid = message.senderUid || message.senderId;

      // Update listeners
      const listener = chatListeners.current.get(matchId);
      if (listener) {
        listener({
          type: 'message',
          matchId,
          messageId: message.messageId,
          localId: message.clientMessageId,
          senderUid: message.senderUid,
          senderId: message.senderId,
          senderName: message.senderName,
          text: message.text,
          timestamp: new Date(message.createdAt).getTime(),
        });
      }

      const isSelf =
        resolvedSenderUid === currentUser.uid || message.senderId === currentUser.uid;

      // Update thread in list
      setThreads((prev) => {
        const existingIdx = prev.findIndex((t) => t.matchId === matchId);
        const updated = [...prev];
        if (existingIdx !== -1) {
          const thread = updated.splice(existingIdx, 1)[0];
          updated.unshift({
            ...thread,
            lastMessage: message.text,
            lastMessageTime: new Date(message.createdAt).getTime(),
            lastMessageSender: resolvedSenderUid,
            unread: !isSelf,
          });
        }
        return updated;
      });

      // Update unread count if not viewing this thread
      const currentMatchId = pathRef.current.split('/chat/')[1];
      if (!isSelf && currentMatchId !== matchId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [matchId]: (prev[matchId] || 0) + 1,
        }));

        setToastMessage({
          senderName: message.senderName || 'Study Partner',
          text: message.text,
          matchId,
          route: `/chat/${matchId}`,
          timestamp: Date.now(),
        });
        setTimeout(() => setToastMessage(null), 4000);

        pushNotification({
          id: `msg-${matchId}-${message.messageId || Date.now()}`,
          category: CATEGORIES.MESSAGE,
          title: 'New Message',
          message: `New message from ${message.senderName || 'Study Partner'}`,
          timestamp: new Date(message.createdAt).getTime(),
          read: false,
          route: `/chat/${matchId}`,
          matchId,
        });
      }
    });

    socket.on('chat:typing', (data) => {
      const listener = chatListeners.current.get(data.threadId);
      if (listener) {
        listener({
          type: 'typing',
          matchId: data.threadId,
          uid: data.senderUid || data.userId,
          isTyping: data.isTyping,
        });
      }
    });

    socket.on('chat:read', (data) => {
      const listener = chatListeners.current.get(data.threadId);
      if (listener) {
        listener({
          type: 'read_receipt',
          matchId: data.threadId,
          readerUid: data.senderUid || data.userId,
        });
      }
    });

    socket.on('message_edited', (data) => {
      const listener = chatListeners.current.get(data.matchId);
      if (listener) listener({ type: 'message_edited', ...data });
    });

    socket.on('message_deleted', (data) => {
      const listener = chatListeners.current.get(data.matchId);
      if (listener) listener({ type: 'message_deleted', ...data });
    });

    socket.on('presence:changed', (data) => {
      chatListeners.current.forEach((listener) => {
        listener({ type: 'presence', uid: data.userId, status: data.status });
      });
    });

    socket.on('global_notification', (data) => {
      const notification = data.notification || {};
      const subType = data.subType || '';
      const isMatchRequest = subType === 'match_request';
      const isMatchAccepted = subType === 'match_accepted';

      let category = subType || CATEGORIES.SESSION;
      if (isMatchRequest || isMatchAccepted) {
        category = CATEGORIES.SOCIAL;
      } else if (subType.startsWith('session_')) {
        category = CATEGORIES.SESSION;
      } else if (subType === 'new_review') {
        category = CATEGORIES.REVIEW;
      }

      const notifId = isMatchRequest && data.data?.requestId
        ? `match-req-${data.data.requestId}`
        : (data.id || data.data?.id || `notif-${Date.now()}`);

      const title =
        notification.title ||
        (isMatchRequest ? 'Match Request' : isMatchAccepted ? 'Match Accepted' : 'Notification');
      const message = notification.body || data.data?.message || '';
      const route = data.data?.route || '/sessions';

      pushNotification({
        id: notifId,
        category,
        type: subType ? subType.toUpperCase() : 'INFO',
        title,
        message,
        timestamp: data.timestamp || Date.now(),
        read: false,
        route,
        sessionId: data.sessionId,
        requestId: data.data?.requestId,
        matchId: data.data?.matchId,
        actionable: isMatchRequest && Boolean(data.data?.requestId),
      });

      setToastMessage({
        senderName: title || 'Mindcraft',
        text: message,
        route,
        timestamp: Date.now(),
      });
      setTimeout(() => setToastMessage(null), 4000);
    });

    socket.on('global_new_message', (data) => {
      pushNotification({
        id: `gnm-${data.id || Date.now()}`,
        category: CATEGORIES.MESSAGE,
        title: data.notification?.title || 'New Message',
        message: data.notification?.body || data.text || 'You have an update.',
        timestamp: data.timestamp || Date.now(),
        read: false,
        route: data.data?.route || (data.matchId ? `/chat/${data.matchId}` : '/notifications'),
        matchId: data.matchId,
      });
    });

    socket.on('global_forum_doubt', (data) => {
      const doubt = data.data || {};
      if ((!doubt.doubtId && !doubt.route) || (doubt.authorUid && doubt.authorUid === currentUser.uid)) return;

      const subType = data.subType || 'new_doubt';
      const authorName = doubt.authorName || 'Someone';
      const doubtTitle = doubt.doubtTitle || doubt.title || 'a doubt';
      const route = doubt.route || (doubt.doubtId ? `/forum?doubtId=${doubt.doubtId}` : '/forum');

      if (doubt.doubtId && pathRef.current !== '/forum') {
        updateUnreadForumIds((prev) => new Set(prev).add(doubt.doubtId));
      }

      let title = 'New Doubt';
      let message = `${authorName} asked: "${doubt.doubtTitle || doubt.title || 'a new doubt'}"`;
      let notifType = 'NEW_DOUBT';
      let notifId = `forum-${doubt.doubtId || Date.now()}`;
      let toastSender = doubt.authorName || 'Forum';
      let toastText = `New doubt: ${doubt.doubtTitle || doubt.title || 'Open forum'}`;

      if (subType === 'new_answer') {
        title = 'New Answer to Your Doubt';
        message = `${authorName} answered: "${doubtTitle}"`;
        notifType = 'NEW_ANSWER';
        notifId = `forum-answer-${doubt.doubtId || Date.now()}-${data.timestamp || Date.now()}`;
        toastSender = title;
        toastText = message;
      } else if (subType === 'answer_accepted') {
        const reward = doubt.tokenReward ?? 10;
        title = 'Solution Accepted! 🌟';
        message = `Your answer was marked as the accepted solution (+${reward} Tokens)!`;
        notifType = 'ANSWER_ACCEPTED';
        notifId = `forum-accepted-${doubt.doubtId || Date.now()}-${doubt.answerId || data.timestamp || Date.now()}`;
        toastSender = title;
        toastText = message;
      }

      setToastMessage({
        senderName: toastSender,
        text: toastText,
        route,
        timestamp: Date.now(),
      });
      setTimeout(() => setToastMessage(null), 4000);

      pushNotification({
        id: notifId,
        category: CATEGORIES.FORUM,
        type: notifType,
        title,
        message,
        timestamp: data.timestamp || Date.now(),
        read: false,
        route,
        doubtId: doubt.doubtId,
      });
    });

    const handleSocketError = (err) => {
      if (!isMounted) return;
      const errMsg = typeof err === 'string' ? err : err?.message || 'Socket connection error';
      console.warn('Socket error event:', errMsg);
      setToastMessage({
        senderName: 'System',
        text: errMsg,
        timestamp: Date.now(),
      });
      setTimeout(() => {
        if (isMounted) setToastMessage(null);
      }, 4000);
    };

    socket.on('error', handleSocketError);

    socket.on('doubt:hint_ready', (payload) => {
      if (!payload?.doubtId) return;
      queryClient.setQueriesData({ queryKey: ['doubts'] }, (old) => {
        if (!old || !Array.isArray(old.data)) return old;
        let changed = false;
        const nextData = old.data.map((d) => {
          if (d?.id !== payload.doubtId) return d;
          changed = true;
          return {
            ...d,
            aiHint: payload.aiHint ?? d.aiHint,
            aiAssistStatus: payload.aiAssistStatus ?? d.aiAssistStatus,
            aiAssistError: payload.aiAssistError ?? null,
          };
        });
        return changed ? { ...old, data: nextData } : old;
      });
    });

    return () => {
      isMounted = false;
      if (authRetryTimer) {
        clearTimeout(authRetryTimer);
      }
      socket.off?.('error', handleSocketError);
      socket.disconnect();
    };
  }, [currentUser?.uid, pushNotification, shouldConnect, updateUnreadForumIds]);

  const subscribeToChat = useCallback((matchId, callback) => {
    chatListeners.current.set(matchId, callback);
    if (socketRef.current?.connected) {
      socketRef.current.emit('thread:join', { threadId: matchId });
    }
    return () => {
      chatListeners.current.delete(matchId);
      if (socketRef.current?.connected) {
        socketRef.current.emit('thread:leave', { threadId: matchId });
      }
    };
  }, []);

  const sendMessage = useCallback((matchId, text, localId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:message', {
        threadId: matchId,
        text,
        clientMessageId: localId,
      });

      setThreads((prev) => {
        const existingIdx = prev.findIndex((t) => t.matchId === matchId);
        const updated = [...prev];
        if (existingIdx !== -1) {
          const thread = updated.splice(existingIdx, 1)[0];
          updated.unshift({
            ...thread,
            lastMessage: text,
            lastMessageTime: Date.now(),
            lastMessageSender: currentUser?.uid,
            unread: false,
          });
        }
        return updated;
      });
      return true;
    }
    return false;
  }, [currentUser]);

  const sendTyping = useCallback((matchId, isTyping = true) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:typing', { threadId: matchId, isTyping });
    }
  }, []);

  const markRead = useCallback((matchId) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:read', { threadId: matchId });
    }
    chatService.markRead(matchId).catch(() => {});

    setThreads((prev) => prev.map((t) => (t.matchId === matchId ? { ...t, unread: false } : t)));
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });

    setNotifications((prev) =>
      prev.map((n) => {
        if (n.matchId === matchId || n.route === `/chat/${matchId}`) {
          return { ...n, read: true };
        }
        return n;
      }),
    );
  }, []);

  const markForumVisited = useCallback(() => {
    updateUnreadForumIds(() => new Set());
    setNotifications((prev) =>
      prev.map((n) =>
        n.category === CATEGORIES.FORUM || n.type === 'NEW_DOUBT'
          ? { ...n, read: true }
          : n,
      ),
    );
  }, [updateUnreadForumIds]);

  const editMessage = useCallback((matchId, messageId, text) => {
    chatService.editMessage(matchId, messageId, text).catch(() => {});
  }, []);

  const deleteMessage = useCallback((matchId, messageId) => {
    chatService.deleteMessage(matchId, messageId).catch(() => {});
  }, []);

  const clearUnreadNotifications = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const markNotificationRead = useCallback((id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        unreadChatCount,
        unreadForumCount,
        unreadCounts: activeUnreadCounts,
        threads: activeThreads,
        subscribeToChat,
        sendMessage,
        sendTyping,
        markRead,
        markForumVisited,
        editMessage,
        deleteMessage,
        toastMessage,
        fetchInitialData,
        hasUnreadNotifications,
        notifications: activeNotifications,
        clearUnreadNotifications,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}

      {toastMessage && (
        <div
          className="fixed top-24 sm:top-8 left-1/2 -translate-x-1/2 z-[10000] bg-white dark:bg-surface-container shadow-2xl rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top-12 fade-in duration-300 border-2 border-success-lime dark:border-[#DCFD8B]/50 w-[90%] sm:w-96 cursor-pointer"
          onClick={() => {
            setToastMessage(null);
            navigate(toastMessage.route || `/chat/${toastMessage.matchId}`);
          }}
        >
          <div className="w-12 h-12 rounded-full bg-success-lime flex items-center justify-center text-gray-900 font-bold text-xl shrink-0">
            {toastMessage.senderName?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-sm font-bold text-gray-900 dark:text-on-surface truncate">
                {toastMessage.senderName}
              </h4>
              <span className="text-[10px] text-gray-500 font-bold bg-success-lime/20 px-2 py-0.5 rounded-full text-success-lime">
                NEW
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-on-surface-variant truncate font-medium">
              {toastMessage.text}
            </p>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};
