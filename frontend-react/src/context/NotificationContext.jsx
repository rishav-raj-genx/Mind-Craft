import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../config/api';
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
  const { currentUser, getToken } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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
    if (!currentUser) return;
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
  }, [currentUser, pushNotification]);

  useEffect(() => {
    if (!currentUser) {
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

    const socket = io(API_BASE_URL, {
      path: '/socket.io',
      auth: async (cb) => {
        try {
          const token = await getToken();
          cb({ token });
        } catch {
          cb({});
        }
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      if (!isMounted) return;
      chatListeners.current.forEach((_callback, matchId) => {
        socket.emit('thread:join', { threadId: matchId });
      });
    });

    socket.on('chat:message', (message) => {
      if (!isMounted) return;
      const matchId = message.threadId;

      // Update listeners
      const listener = chatListeners.current.get(matchId);
      if (listener) {
        listener({
          type: 'message',
          matchId,
          messageId: message.messageId,
          senderUid: message.senderId,
          senderName: message.senderName,
          text: message.text,
          timestamp: new Date(message.createdAt).getTime(),
        });
      }

      // Update thread in list
      setThreads((prev) => {
        const existingIdx = prev.findIndex((t) => t.matchId === matchId);
        const updated = [...prev];
        const isSelf = message.senderId === currentUser.uid;
        if (existingIdx !== -1) {
          const thread = updated.splice(existingIdx, 1)[0];
          updated.unshift({
            ...thread,
            lastMessage: message.text,
            lastMessageTime: new Date(message.createdAt).getTime(),
            lastMessageSender: message.senderId,
            unread: !isSelf,
          });
        }
        return updated;
      });

      // Update unread count if not viewing this thread
      const currentMatchId = pathRef.current.split('/chat/')[1];
      if (message.senderId !== currentUser.uid && currentMatchId !== matchId) {
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
        listener({ type: 'typing', matchId: data.threadId, uid: data.userId, isTyping: data.isTyping });
      }
    });

    socket.on('chat:read', (data) => {
      const listener = chatListeners.current.get(data.threadId);
      if (listener) {
        listener({ type: 'read_receipt', matchId: data.threadId, readerUid: data.userId });
      }
    });

    socket.on('presence:changed', (data) => {
      chatListeners.current.forEach((listener) => {
        listener({ type: 'presence', uid: data.userId, status: data.status });
      });
    });

    socket.on('global_notification', (data) => {
      const notification = data.notification || {};
      pushNotification({
        id: data.id || `notif-${Date.now()}`,
        category: data.subType || CATEGORIES.SESSION,
        type: data.subType?.toUpperCase() || 'INFO',
        title: notification.title || 'Notification',
        message: notification.body || data.data?.message || '',
        timestamp: data.timestamp || Date.now(),
        read: false,
        route: data.data?.route || '/sessions',
        sessionId: data.sessionId,
      });

      setToastMessage({
        senderName: notification.title || 'Mindcraft',
        text: notification.body || data.data?.message || '',
        route: data.data?.route || '/sessions',
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
      if (!doubt.doubtId || doubt.authorUid === currentUser.uid) return;

      if (pathRef.current !== '/forum') {
        updateUnreadForumIds((prev) => new Set(prev).add(doubt.doubtId));
      }

      setToastMessage({
        senderName: doubt.authorName || 'Forum',
        text: `New doubt: ${doubt.title || 'Open forum'}`,
        route: `/forum?doubtId=${doubt.doubtId}`,
        timestamp: Date.now(),
      });
      setTimeout(() => setToastMessage(null), 4000);

      pushNotification({
        id: `forum-${doubt.doubtId}`,
        category: CATEGORIES.FORUM,
        type: 'NEW_DOUBT',
        title: 'New Doubt',
        message: `${doubt.authorName || 'Someone'} asked: "${doubt.title || 'a new doubt'}"`,
        timestamp: Date.now(),
        read: false,
        route: `/forum?doubtId=${doubt.doubtId}`,
        doubtId: doubt.doubtId,
      });
    });

    return () => {
      isMounted = false;
      socket.disconnect();
    };
  }, [currentUser, getToken, pushNotification, updateUnreadForumIds]);

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
