import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { WS_BASE_URL } from '../config/api';
import { chatService } from '../services/chatService';
import { userService } from '../services/userService';
import { requestNotificationPermission, onForegroundMessage } from '../config/firebase';
import { useLocation, useNavigate } from 'react-router-dom';

const NotificationContext = createContext({});

export const useNotifications = () => useContext(NotificationContext);

// ── Notification categories ──────────────────────────────────────────
const CATEGORIES = {
  MESSAGE: 'message',
  SESSION: 'session',
  GAMIFICATION: 'gamification',
  SOCIAL: 'social',
  REVIEW: 'review',
  FORUM: 'forum',
};

// ── Helper: Sort threads by lastMessageTime descending ───────────────
const sortThreadsByTimestamp = (threads) =>
  [...threads].sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

export const NotificationProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // ── Chat State ─────────────────────────────────────────────────────
  const [threads, setThreads] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({}); // Map<matchId, number>
  const [unreadForumIds, setUnreadForumIds] = useState(new Set());
  const [toastMessage, setToastMessage] = useState(null);
  
  // ── Unified Notifications State ────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  
  const wsRef = useRef(null);
  const chatListeners = useRef(new Map()); // matchId -> callback
  const fcmInitialized = useRef(false);
  const pathRef = useRef(location.pathname);

  useEffect(() => {
    pathRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!currentUser) {
      setUnreadForumIds(new Set());
      return;
    }

    try {
      const raw = localStorage.getItem(`mindcraft_unread_forum:${currentUser.uid}`);
      setUnreadForumIds(new Set(raw ? JSON.parse(raw) : []));
    } catch {
      setUnreadForumIds(new Set());
    }
  }, [currentUser]);

  // ── Computed values ────────────────────────────────────────────────
  const unreadChatCount = useMemo(
    () => Object.values(unreadCounts).reduce((sum, c) => sum + c, 0),
    [unreadCounts]
  );
  const unreadForumCount = unreadForumIds.size;

  // Derive hasUnreadNotifications from actual state (single source of truth)
  const hasUnreadNotifications = useMemo(
    () => notifications.some(n => !n.read),
    [notifications]
  );

  const updateUnreadForumIds = useCallback((updater) => {
    setUnreadForumIds(prev => {
      const next = updater(prev);
      if (currentUser) {
        localStorage.setItem(`mindcraft_unread_forum:${currentUser.uid}`, JSON.stringify([...next]));
      }
      return next;
    });
  }, [currentUser]);

  // ── Add a notification to the unified list ─────────────────────────
  const pushNotification = useCallback((notif) => {
    setNotifications(prev => {
      const existingIdx = prev.findIndex(n => n.id === notif.id);
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = { ...updated[existingIdx], ...notif };
        return updated;
      }
      return [notif, ...prev];
    });
  }, []);

  // ── Fetch initial data from REST ───────────────────────────────────
  const fetchInitialData = useCallback(async () => {
    if (!currentUser) return;
    try {
      // 1. Fetch threads & compute per-thread unread counts
      const res = await chatService.getThreads(currentUser.uid);
      const data = res.data || [];
      setThreads(sortThreadsByTimestamp(data));
      
      // Build unread counts map from thread data
      const counts = {};
      data.forEach(t => {
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
      console.error('Error fetching initial notification data', err);
    }
  }, [currentUser, pushNotification]);

  // ── FCM Token Setup ────────────────────────────────────────────────
  const initFCM = async () => {
    if (fcmInitialized.current || !currentUser) return;
    fcmInitialized.current = true;
    
    try {
      const fcmToken = await requestNotificationPermission();
      if (fcmToken) {
        // Save token to backend
        await userService.saveFcmToken(currentUser.uid, fcmToken);
        console.log('✅ FCM token saved to backend');
      }
      
      // Listen for foreground FCM messages
      onForegroundMessage((payload) => {
        console.log('📱 Foreground FCM message:', payload);
        const title = payload.notification?.title || payload.data?.title || 'Mindcraft';
        const body = payload.notification?.body || payload.data?.body || '';
        const data = payload.data || {};

        if ((data.type === 'chat' || data.type === 'forum_doubt') && wsRef.current?.readyState === WebSocket.OPEN) {
          return;
        }
        
        setToastMessage({
          senderName: title,
          text: body,
          matchId: data.matchId,
          route: data.route || data.url,
          timestamp: Date.now(),
        });
        setTimeout(() => setToastMessage(null), 4000);

        if (data.type === 'chat' && data.matchId) {
          const notificationTs = Number(data.timestamp || Date.now());
          const currentMatchId = pathRef.current.split('/chat/')[1];
          if (currentMatchId !== data.matchId) {
            setUnreadCounts(prev => ({
              ...prev,
              [data.matchId]: (prev[data.matchId] || 0) + 1,
            }));
          }
          pushNotification({
            id: `msg-${data.matchId}-${data.messageId || notificationTs}`,
            category: CATEGORIES.MESSAGE,
            title: 'New Message',
            message: body || 'You have a new message.',
            timestamp: notificationTs,
            read: false,
            route: `/chat/${data.matchId}`,
            matchId: data.matchId,
          });
        }

        if (data.type === 'forum_doubt' && data.doubtId) {
          if (pathRef.current !== '/forum') {
            updateUnreadForumIds(prev => new Set(prev).add(data.doubtId));
          }
          pushNotification({
            id: `forum-${data.doubtId}`,
            category: CATEGORIES.FORUM,
            type: 'NEW_DOUBT',
            title: 'New Doubt',
            message: body || 'A new doubt was posted.',
            timestamp: Date.now(),
            read: false,
            route: data.route || `/forum?doubtId=${data.doubtId}`,
            doubtId: data.doubtId,
          });
        }
      });
    } catch (err) {
      console.warn('FCM init skipped:', err.message);
    }
  };

  // ── WebSocket Connection & Message Handling ────────────────────────
  useEffect(() => {
    if (!currentUser) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      fcmInitialized.current = false;
      setThreads([]);
      setUnreadCounts({});
      setNotifications([]);
      chatListeners.current.clear();
      return;
    }

    fetchInitialData();
    initFCM();

    // ── Unified Master WebSocket ──────────────────────────────────
    let reconnectTimer;
    let isMounted = true;

    const connectWebSocket = async () => {
      if (!isMounted || !currentUser) return;
      try {
        const token = await currentUser.getIdToken();
        const ws = new WebSocket(`${WS_BASE_URL}/ws?token=${encodeURIComponent(token)}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('🌍 Unified WebSocket connected');
          chatListeners.current.forEach((_callback, matchId) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'join', matchId }));
            }
          });
        };

      ws.onmessage = (event) => {
        try {
        const data = JSON.parse(event.data);
        
        // 1. Structured Global Notification (sessions, badges, streaks, social, reviews)
        if (data.type === 'global_notification') {
          const audio = new Audio('/notification.mp3'); 
          audio.volume = 0.5;
          audio.play().catch(() => {});
          
          // Parse structured notification payload
          const subType = data.subType || 'general';
          const d = data.data || {};
          let category = CATEGORIES.SESSION;
          let title = 'Notification';
          let message = d.message || 'You have a new notification';
          let route = '/notifications';
          
          switch (subType) {
            case 'session_booked':
              category = CATEGORIES.SESSION;
              title = 'Session Booked';
              message = d.message || `Session booked with ${d.partnerName || 'a user'}`;
              route = '/sessions';
              break;
            case 'session_reminder':
              category = CATEGORIES.SESSION;
              title = 'Session Reminder';
              message = d.message || 'Session starts in 15 mins';
              route = '/sessions';
              break;
            case 'session_rate':
              category = CATEGORIES.SESSION;
              title = 'Rate Session';
              message = d.message || 'Please rate your recent session';
              route = '/sessions';
              break;
            case 'badge_unlocked':
              category = CATEGORIES.GAMIFICATION;
              title = 'Badge Unlocked! 🏆';
              message = d.message || `You unlocked the ${d.badgeName || ''} badge!`;
              route = '/badges';
              break;
            case 'streak_update':
              category = CATEGORIES.GAMIFICATION;
              title = 'Streak Update 🔥';
              message = d.message || `Your streak is now ${d.streak || 0} days!`;
              route = '/streak';
              break;
            case 'new_follower':
              category = CATEGORIES.SOCIAL;
              title = 'New Follower';
              message = d.message || `${d.followerName || 'Someone'} started following you`;
              route = d.followerUid ? `/profile/${d.followerUid}` : '/notifications';
              break;
            case 'new_review':
              category = CATEGORIES.REVIEW;
              title = 'New Review ⭐';
              message = d.message || `${d.reviewerName || 'Someone'} left you a ${d.rating || 5}-star review!`;
              route = '/ratings';
              break;
            default:
              break;
          }
          
          pushNotification({
            id: `ws-${subType}-${Date.now()}`,
            category,
            title,
            message,
            timestamp: Date.now(),
            read: false,
            route,
          });
          return;
        }

        // 2. Global Chat Notification (background)
        if (data.type === 'global_new_message') {
          if (!data.matchId) {
            const notification = data.notification || {};
            const nested = data.data || {};
            const route = nested.route || '/notifications';
            const isForum = nested.type === 'FORUM_REPLY';

            const audio = new Audio('/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {});

            setToastMessage({
              senderName: notification.title || 'Mindcraft',
              text: notification.body || 'You have a new notification',
              route,
              timestamp: Date.now(),
            });
            setTimeout(() => setToastMessage(null), 4000);

            pushNotification({
              id: nested.id || `notif-${Date.now()}`,
              category: isForum ? CATEGORIES.FORUM : CATEGORIES.SESSION,
              type: nested.type || 'GENERAL',
              title: notification.title || 'Notification',
              message: notification.body || 'You have a new notification',
              timestamp: Date.now(),
              read: false,
              route,
            });
            return;
          }

          const currentMatchId = pathRef.current.split('/chat/')[1];
          const isCurrentlyInChat = currentMatchId === data.matchId;

          // Update Threads instantly in-memory + sort
          setThreads(prev => {
            const existingIdx = prev.findIndex(t => t.matchId === data.matchId);
            let updated = [...prev];
            if (existingIdx !== -1) {
              const thread = updated.splice(existingIdx, 1)[0];
              updated.unshift({
                ...thread,
                lastMessage: data.text,
                lastMessageTime: data.timestamp,
                lastMessageSender: data.senderUid,
                unread: !isCurrentlyInChat
              });
            } else {
              fetchInitialData();
            }
            return updated; // Already sorted — newest at index 0
          });

          if (isCurrentlyInChat) {
            // User is looking at this exact chat → instant mark read
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'read', matchId: data.matchId }));
            }
          } else {
            // Not in chat → increment unread count, toast, sound
            setUnreadCounts(prev => ({
              ...prev,
              [data.matchId]: (prev[data.matchId] || 0) + 1
            }));
            
            const audio = new Audio('/notification.mp3'); 
            audio.volume = 0.5;
            audio.play().catch(() => {});
            setToastMessage(data);
            setTimeout(() => setToastMessage(null), 4000);
            
            // Push into unified notifications
            pushNotification({
              id: `msg-${data.matchId}-${data.messageId || data.timestamp || Date.now()}`,
              category: CATEGORIES.MESSAGE,
              title: 'New Message',
              message: `New message from ${data.senderName || 'Study Partner'}`,
              timestamp: data.timestamp || Date.now(),
              read: false,
              route: `/chat/${data.matchId}`,
              matchId: data.matchId, // store for clearing
            });
          }
          return;
        }

        // 3. Global Forum Notification
        if (data.type === 'global_forum_doubt') {
          const doubt = data.data || {};
          if (!doubt.doubtId || doubt.authorUid === currentUser.uid) return;

          const isInForum = pathRef.current === '/forum';
          if (!isInForum) {
            updateUnreadForumIds(prev => new Set(prev).add(doubt.doubtId));
          }

          const audio = new Audio('/notification.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});

          const route = doubt.route || `/forum?doubtId=${doubt.doubtId}`;
          setToastMessage({
            senderName: doubt.authorName || 'Forum',
            text: `New doubt: ${doubt.title || 'Open forum'}`,
            route,
            timestamp: doubt.createdAt || Date.now(),
          });
          setTimeout(() => setToastMessage(null), 4000);

          pushNotification({
            id: `forum-${doubt.doubtId}`,
            category: CATEGORIES.FORUM,
            type: 'NEW_DOUBT',
            title: 'New Doubt',
            message: `${doubt.authorName || 'Someone'} asked: "${doubt.title || 'a new doubt'}"`,
            timestamp: doubt.createdAt || Date.now(),
            read: false,
            route,
            doubtId: doubt.doubtId,
          });
          return;
        }

        // 4. Room-specific Chat Events (Route to Chat.jsx listeners)
        if (data.matchId) {
          const listener = chatListeners.current.get(data.matchId);
          if (listener) {
            listener(data);
          }
        }
      } catch (err) {
        console.warn('WebSocket message parse failed:', err);
      }
    };

      ws.onclose = () => {
        console.log('🌍 Unified WebSocket disconnected. Attempting reconnect in 5s...');
        if (isMounted) {
          reconnectTimer = setTimeout(connectWebSocket, 5000);
        }
      };
      
      ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
        ws.close();
      };
      } catch (err) {
        console.warn('Failed to connect WS:', err);
        if (isMounted) {
          reconnectTimer = setTimeout(connectWebSocket, 5000);
        }
      }
    };

    connectWebSocket();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [currentUser]);

  // ── Listen for service worker notification clicks ──────────────────
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data.url) {
        navigate(event.data.url);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [navigate]);

  // ── Unified WebSocket Methods ─────────────────────────────────────
  
  const subscribeToChat = (matchId, callback) => {
    chatListeners.current.set(matchId, callback);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'join', matchId }));
    }
    return () => chatListeners.current.delete(matchId);
  };

  const sendMessage = (matchId, text, localId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', matchId, text, localId }));
      
      // Optimistically update threads list (already sorted — newest first)
      setThreads(prev => {
        const existingIdx = prev.findIndex(t => t.matchId === matchId);
        let updated = [...prev];
        if (existingIdx !== -1) {
          const thread = updated.splice(existingIdx, 1)[0];
          updated.unshift({
            ...thread,
            lastMessage: text,
            lastMessageTime: Date.now(),
            lastMessageSender: currentUser.uid,
            unread: false
          });
        }
        return updated;
      });
      return true;
    }
    return false;
  };

  const sendTyping = (matchId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', matchId }));
    }
  };

  const markRead = (matchId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'read', matchId }));
    }
    chatService.markRead(matchId).catch(() => {});
    
    // Clear unread count for this thread
    setThreads(prev => prev.map(t => t.matchId === matchId ? { ...t, unread: false } : t));
    setUnreadCounts(prev => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });

    // Also mark any matching notification as read
    setNotifications(prev => prev.map(n => {
      if (n.matchId === matchId || n.route === `/chat/${matchId}`) {
        return { ...n, read: true };
      }
      return n;
    }));
  };

  const markForumVisited = useCallback(() => {
    updateUnreadForumIds(() => new Set());
    setNotifications(prev => prev.map(n => (
      n.category === CATEGORIES.FORUM || n.type === 'NEW_DOUBT'
        ? { ...n, read: true }
        : n
    )));
  }, [updateUnreadForumIds]);

  const editMessage = (matchId, messageId, text) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'edit_message', matchId, messageId, text }));
    }
  };

  const deleteMessage = (matchId, messageId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'delete_message', matchId, messageId }));
    }
  };

  // ── Notification Management ────────────────────────────────────────
  const clearUnreadNotifications = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const markNotificationRead = useCallback((id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  return (
    <NotificationContext.Provider value={{
      // Chat
      unreadChatCount,
      unreadForumCount,
      unreadCounts,
      threads,
      subscribeToChat,
      sendMessage,
      sendTyping,
      markRead,
      markForumVisited,
      editMessage,
      deleteMessage,
      toastMessage,
      fetchInitialData,
      // Notifications
      hasUnreadNotifications,
      notifications,
      clearUnreadNotifications,
      markNotificationRead,
      markAllNotificationsRead,
    }}>
      {children}
      
      {/* Global Toast for incoming messages */}
      {toastMessage && (
        <div className="fixed top-24 sm:top-8 left-1/2 -translate-x-1/2 z-[10000] bg-white dark:bg-surface-container shadow-2xl rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top-12 fade-in duration-300 border-2 border-success-lime dark:border-[#DCFD8B]/50 w-[90%] sm:w-96 cursor-pointer"
             onClick={() => { setToastMessage(null); navigate(toastMessage.route || `/chat/${toastMessage.matchId}`); }}>
          <div className="w-12 h-12 rounded-full bg-success-lime flex items-center justify-center text-gray-900 font-bold text-xl shrink-0">
            {toastMessage.senderName?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-sm font-bold text-gray-900 dark:text-on-surface truncate">{toastMessage.senderName}</h4>
              <span className="text-[10px] text-gray-500 font-bold bg-success-lime/20 px-2 py-0.5 rounded-full text-success-lime">NEW</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-on-surface-variant truncate font-medium">{toastMessage.text}</p>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};
