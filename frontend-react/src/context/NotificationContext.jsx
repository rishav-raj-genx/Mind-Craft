import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { API_BASE_URL } from '../config/api';
import { chatService } from '../services/chatService';
import { sessionService } from '../services/sessionService';
import { useLocation, useNavigate } from 'react-router-dom';
import { readCache, writeCache } from '../utils/cache';

const NotificationContext = createContext({});

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { currentUser, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [threads, setThreads] = useState([]); // Master in-memory thread list
  
  const wsRef = useRef(null);
  const chatListeners = useRef(new Map()); // matchId -> callback

  const fetchInitialData = async () => {
    if (!currentUser) return;
    try {
      // 1. Fetch unread chats & initialize threads
      const res = await chatService.getThreads(currentUser.uid);
      const data = res.data || [];
      setThreads(data);
      const unreadCount = data.filter(t => t.unread && t.lastMessageSender !== currentUser.uid).length;
      setUnreadChatCount(unreadCount);

      // 2. Fetch pending sessions
      const pendingRes = await sessionService.getSessions(currentUser.uid, 'pending');
      const hasPending = (pendingRes.data || []).some(s => s.teacherUid === currentUser.uid && s.status === 'pending');
      setHasUnreadNotifications(hasPending);
    } catch (err) {
      console.error('Error fetching initial notification data', err);
    }
  };

  useEffect(() => {
    if (!currentUser || !token) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    fetchInitialData();

    // ── Unified Master WebSocket ──────────────────────────────
    const wsBaseUrl = API_BASE_URL.replace(/^http/, 'ws');
    const ws = new WebSocket(`${wsBaseUrl}/ws?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => console.log('🌍 Unified WebSocket connected');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 1. Global Session Notification
        if (data.type === 'global_notification') {
          setHasUnreadNotifications(true);
          const audio = new Audio('/notification.mp3'); 
          audio.volume = 0.5;
          audio.play().catch(() => {});
          return;
        }

        // 2. Global Chat Notification (background)
        if (data.type === 'global_new_message') {
          const currentMatchId = location.pathname.split('/chat/')[1];
          const isCurrentlyInChat = currentMatchId === data.matchId;

          // Update Threads instantly in-memory (No network fetching!)
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
              // If completely new chat, we might need a quick fetch, but for now we rely on the next reload
              fetchInitialData();
            }
            return updated;
          });

          if (isCurrentlyInChat) {
            // Smart dismissal: If user is looking at this exact chat, instantly mark read and don't toast
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'read', matchId: data.matchId }));
            }
          } else {
            // Not in chat -> Toast & Play sound
            setUnreadChatCount(prev => prev + 1);
            const audio = new Audio('/notification.mp3'); 
            audio.volume = 0.5;
            audio.play().catch(() => {});
            setToastMessage(data);
            setTimeout(() => setToastMessage(null), 4000);
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

  // ── Unified WebSocket Methods ─────────────────────────────
  
  const subscribeToChat = (matchId, callback) => {
    chatListeners.current.set(matchId, callback);
    // Auto-join room when subscribing
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'join', matchId }));
    }
    return () => chatListeners.current.delete(matchId);
  };

  const sendMessage = (matchId, text, localId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', matchId, text, localId }));
      
      // Optimistically update threads list
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
      
      // Clear unread count locally
      setThreads(prev => prev.map(t => t.matchId === matchId ? { ...t, unread: false } : t));
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

  const clearUnreadNotifications = () => setHasUnreadNotifications(false);
  const decrementUnreadChat = () => setUnreadChatCount(prev => Math.max(0, prev - 1));

  return (
    <NotificationContext.Provider value={{
      unreadChatCount,
      hasUnreadNotifications,
      clearUnreadNotifications,
      decrementUnreadChat,
      fetchInitialData,
      toastMessage,
      threads,
      subscribeToChat,
      sendMessage,
      sendTyping,
      markRead,
      editMessage,
      deleteMessage
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
