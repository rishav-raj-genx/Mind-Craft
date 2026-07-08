import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../config/api';
import { chatService } from '../services/chatService';
import { sessionService } from '../services/sessionService';
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
};

// ── Helper: Sort threads by lastMessageTime descending ───────────────
const sortThreadsByTimestamp = (threads) =>
  [...threads].sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

export const NotificationProvider = ({ children }) => {
  const { currentUser, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // ── Chat State ─────────────────────────────────────────────────────
  const [threads, setThreads] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({}); // Map<matchId, number>
  const [toastMessage, setToastMessage] = useState(null);
  
  // ── Unified Notifications State ────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  
  const wsRef = useRef(null);
  const chatListeners = useRef(new Map()); // matchId -> callback
  const fcmInitialized = useRef(false);

  // ── Computed values ────────────────────────────────────────────────
  const unreadChatCount = Object.values(unreadCounts).reduce((sum, c) => sum + c, 0);

  // ── Add a notification to the unified list ─────────────────────────
  const pushNotification = useCallback((notif) => {
    setNotifications(prev => {
      // Deduplicate by id
      if (prev.find(n => n.id === notif.id)) return prev;
      return [notif, ...prev];
    });
    setHasUnreadNotifications(true);
  }, []);

  // ── Fetch initial data from REST ───────────────────────────────────
  const fetchInitialData = async () => {
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
        }
      });
      setUnreadCounts(counts);

      // 2. Fetch pending sessions → sets notification dot
      const pendingRes = await sessionService.getSessions(currentUser.uid, 'pending');
      const hasPending = (pendingRes.data || []).some(s => s.teacherUid === currentUser.uid && s.status === 'pending');
      if (hasPending) setHasUnreadNotifications(true);
    } catch (err) {
      console.error('Error fetching initial notification data', err);
    }
  };

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
        
        setToastMessage({
          senderName: title,
          text: body,
          matchId: payload.data?.matchId,
          timestamp: Date.now(),
        });
        setTimeout(() => setToastMessage(null), 4000);
      });
    } catch (err) {
      console.warn('FCM init skipped:', err.message);
    }
  };

  // ── WebSocket Connection & Message Handling ────────────────────────
  useEffect(() => {
    if (!currentUser || !token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    fetchInitialData();
    initFCM();

    // ── Unified Master WebSocket ──────────────────────────────────
    const wsBaseUrl = API_BASE_URL.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBaseUrl}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => console.log('🌍 Unified WebSocket connected');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 1. Structured Global Notification (sessions, badges, streaks, social, reviews)
        if (data.type === 'global_notification') {
          setHasUnreadNotifications(true);
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
          const currentMatchId = location.pathname.split('/chat/')[1];
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
              id: `msg-${data.messageId || Date.now()}`,
              category: CATEGORIES.MESSAGE,
              title: 'New Message',
              message: `New message from ${data.senderName || 'Study Partner'}`,
              timestamp: data.timestamp || Date.now(),
              read: false,
              route: `/chat/${data.matchId}`,
            });
          }
          return;
        }

        // 3. Room-specific Chat Events (Route to Chat.jsx listeners)
        if (data.matchId) {
          const listener = chatListeners.current.get(data.matchId);
          if (listener) {
            listener(data.type, data);
          }
        }
      } catch (err) {}
    };

    ws.onclose = () => console.log('🌍 Unified WebSocket disconnected');

    return () => ws.close();
  }, [currentUser, token]);

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
      
      // Clear unread count for this thread
      setThreads(prev => prev.map(t => t.matchId === matchId ? { ...t, unread: false } : t));
      setUnreadCounts(prev => {
        const next = { ...prev };
        delete next[matchId];
        return next;
      });
    }
  };

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
  const clearUnreadNotifications = () => setHasUnreadNotifications(false);
  const decrementUnreadChat = () => {}; // Deprecated — handled by per-thread counts

  const markNotificationRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    // Recompute hasUnread
    setNotifications(prev => {
      const stillHasUnread = prev.some(n => !n.read);
      setHasUnreadNotifications(stillHasUnread);
      return prev;
    });
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setHasUnreadNotifications(false);
  };

  return (
    <NotificationContext.Provider value={{
      // Chat
      unreadChatCount,
      unreadCounts,
      threads,
      subscribeToChat,
      sendMessage,
      sendTyping,
      markRead,
      editMessage,
      deleteMessage,
      toastMessage,
      fetchInitialData,
      // Notifications
      hasUnreadNotifications,
      notifications,
      clearUnreadNotifications,
      decrementUnreadChat,
      markNotificationRead,
      markAllNotificationsRead,
    }}>
      {children}
      
      {/* Global Toast for incoming messages */}
      {toastMessage && (
        <div className="fixed top-24 sm:top-8 left-1/2 -translate-x-1/2 z-[10000] bg-white dark:bg-surface-container shadow-2xl rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-top-12 fade-in duration-300 border-2 border-success-lime dark:border-[#DCFD8B]/50 w-[90%] sm:w-96 cursor-pointer"
             onClick={() => { setToastMessage(null); navigate(`/chat/${toastMessage.matchId}`); }}>
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
