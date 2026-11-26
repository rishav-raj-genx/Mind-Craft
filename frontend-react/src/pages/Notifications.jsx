import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { sessionService } from '../services/sessionService';
import { gamificationService } from '../services/gamificationService';
import { doubtService } from '../services/doubtService';
import { chatService } from '../services/chatService';
import { matchService } from '../services/matchService';
import { ArrowLeft, Check, X, MessageCircle, Flame, Calendar, Bell, MessageSquare, Loader2, CheckCircle2, UserPlus } from 'lucide-react';

const MAX_READ_NOTIFS = 100;

const persistReadIds = (idSet) => {
  const arr = [...idSet];
  const capped = arr.length > MAX_READ_NOTIFS ? arr.slice(arr.length - MAX_READ_NOTIFS) : arr;
  try {
    localStorage.setItem('mindcraft_read_notifs', JSON.stringify(capped));
  } catch {
    // Ignore storage quota errors
  }
  return new Set(capped);
};

const Notifications = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { 
    notifications: contextNotifs, 
    markNotificationRead, 
    markAllNotificationsRead,
    unreadCounts,
    markRead: markChatRead,
    clearUnreadNotifications
  } = useNotifications();
  
  const [restNotifications, setRestNotifications] = useState([]);
  const [handledRequestIds, setHandledRequestIds] = useState(() => new Set());
  const [readIds, setReadIds] = useState(() => {
    try {
      const stored = localStorage.getItem('mindcraft_read_notifs');
      const parsed = stored ? JSON.parse(stored) : [];
      const arr = Array.isArray(parsed) ? parsed : [];
      return new Set(arr.length > MAX_READ_NOTIFS ? arr.slice(arr.length - MAX_READ_NOTIFS) : arr);
    } catch {
      return new Set();
    }
  }); // Track locally-dismissed REST notification IDs
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [activeTab, setActiveTab] = useState('All');

  const tabs = ['All', 'Messages', 'Forum', 'Sessions', 'Gamification', 'Social'];

  // Build dynamic notifications from real data sources (REST fallback)
  const buildNotifications = useCallback(async () => {
    if (!currentUser) return;
    const notifs = [];

    try {
      // Upcoming sessions
      const sessRes = await sessionService.getSessions(currentUser.uid, 'upcoming');
      const upcomingSessions = sessRes.data || [];
      upcomingSessions.forEach(s => {
        const isTeacher = s.teacherUid === currentUser.uid;
        const dateStr = new Date(s.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        notifs.push({
          id: `session-${s.sessionId}`,
          category: 'session',
          type: 'SESSION_REQUEST',
          title: 'Upcoming Session',
          message: isTeacher
            ? `You have an upcoming tutoring session for "${s.skill}" with ${s.peerName} on ${dateStr}.`
            : `You're scheduled to learn "${s.skill}" with ${s.peerName} on ${dateStr}.`,
          timestamp: s.scheduledAt,
          read: true, // Upcoming sessions are informational, not urgent
          sessionId: s.sessionId,
          actionable: false,
          route: '/sessions'
        });
      });

      // Pending session requests
      const pendingRes = await sessionService.getSessions(currentUser.uid, 'pending');
      const pendingSessions = pendingRes.data || [];
      pendingSessions.forEach(s => {
        const isTeacher = s.teacherUid === currentUser.uid;
        const dateStr = new Date(s.scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        if (isTeacher) {
          notifs.push({
            id: `session-req-${s.sessionId}`,
            category: 'session',
            type: 'SESSION_PENDING',
            title: 'Session Request',
            message: `${s.peerName} requested a session for "${s.skill}" on ${dateStr}.`,
            timestamp: s.createdAt || s.scheduledAt,
            read: false,
            sessionId: s.sessionId,
            actionable: true,
            route: '/sessions'
          });
        } else {
          notifs.push({
            id: `session-wait-${s.sessionId}`,
            category: 'session',
            type: 'SESSION_WAITING',
            title: 'Session Pending',
            message: `Your session request for "${s.skill}" with ${s.peerName} is waiting for approval.`,
            timestamp: s.createdAt || s.scheduledAt,
            read: true, // This is informational for the learner
            sessionId: s.sessionId,
            actionable: false,
            route: '/sessions'
          });
        }
      });
    } catch {
      // Ignore background fetch error
    }

    try {
      const streakRes = await gamificationService.getStreak(currentUser.uid);
      const streak = streakRes.data || {};
      if (streak.currentStreak > 0) {
        // Use a stable timestamp so streak doesn't always jump to top
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        notifs.push({
          id: `streak-alert-${today.getTime()}`,
          category: 'gamification',
          type: 'STREAK_ALERT',
          title: 'Streak Alert',
          message: `${streak.currentStreak} Day Streak! ${streak.currentStreak >= 7 ? "You're on fire! 🔥" : 'Keep studying daily to build your streak.'}`,
          timestamp: today.getTime(), // Midnight today, not Date.now()
          read: true, // Streak alerts are informational
          actionable: false,
          route: '/streak'
        });
      }
    } catch {
      // Ignore background fetch error
    }

    try {
      const doubtsRes = await doubtService.getAllDoubts('All Doubts');
      const doubts = doubtsRes.data || [];
      const otherDoubts = doubts.filter(d => d.authorUid !== currentUser.uid);
      otherDoubts.slice(0, 5).forEach(d => {
        notifs.push({
          id: `forum-${d.id}`,
          category: 'forum',
          type: 'NEW_DOUBT',
          title: 'New Doubt',
          message: `${d.authorName || 'Someone'} asked: "${d.title}"`,
          timestamp: d.createdAt,
          read: false,
          actionable: false,
          route: `/forum?doubtId=${d.id}`,
          doubtId: d.id
        });
      });

      const myDoubts = doubts.filter(d => d.authorUid === currentUser.uid && d.answerCount > 0);
      myDoubts.slice(0, 3).forEach(d => {
        notifs.push({
          id: `doubt-${d.id}`,
          category: 'social',
          type: 'FORUM_REPLY',
          title: 'Forum Activity',
          message: `Your doubt "${d.title}" has ${d.answerCount} answer${d.answerCount > 1 ? 's' : ''}!`,
          timestamp: d.createdAt,
          read: true,
          actionable: false,
          route: `/forum?doubtId=${d.id}`
        });
      });
    } catch {
      // Ignore background fetch error
    }

    try {
      const threadsRes = await chatService.getThreads(currentUser.uid);
      const threads = threadsRes.data || [];
      threads.forEach(t => {
        if (t.unread && t.lastMessageSender !== currentUser.uid) {
          notifs.push({
            id: `msg-${t.matchId}-${t.lastMessageTime || Date.now()}`,
            category: 'message',
            type: 'UNREAD_CHAT',
            title: 'New Message',
            message: `You have an unread message from ${t.partner?.name || 'a study partner'}.`,
            timestamp: t.lastMessageTime || Date.now(),
            read: false,
            actionable: true,
            route: `/chat/${t.matchId}`,
            matchId: t.matchId
          });
        }
      });
    } catch {
      // Ignore background fetch error
    }

    try {
      const matchRes = await matchService.getMatchRequests(currentUser.uid);
      const pendingRequests = matchRes?.data || [];
      pendingRequests.forEach((r) => {
        if (r.status && r.status !== 'PENDING') return;
        const reqId = r.requestId || r.id;
        notifs.push({
          id: `match-req-${reqId}`,
          category: 'social',
          type: 'MATCH_REQUEST',
          title: 'Match Request',
          message: `${r.requesterName || 'Someone'} requested to study with you for ${r.sharedSkill || 'a skill'}!`,
          timestamp: r.createdAt || Date.now(),
          read: false,
          requestId: reqId,
          actionable: true,
          route: '/notifications',
        });
      });
    } catch {
      // Ignore background fetch error
    }

    setRestNotifications(notifs);
    setLoading(false);
  }, [currentUser]);

  const clearUnreadRef = useRef(clearUnreadNotifications);
  useEffect(() => {
    clearUnreadRef.current = clearUnreadNotifications;
  }, [clearUnreadNotifications]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    let isMounted = true;
    const run = async () => {
      await buildNotifications();
      if (isMounted) {
        clearUnreadRef.current?.();
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.uid, buildNotifications]);

  // Handle local "mark as read" for REST items
  const handleMarkRead = useCallback((notif) => {
    // Mark context notification as read
    markNotificationRead(notif.id);
    // Mark REST notification as locally read with FIFO cap
    setReadIds((prev) => persistReadIds(new Set(prev).add(notif.id)));
    // If it's a chat notification, also mark that chat as read
    if (notif.matchId) {
      markChatRead(notif.matchId);
    }
  }, [markNotificationRead, markChatRead]);

  const handleMarkAllRead = useCallback(() => {
    markAllNotificationsRead();
    // Mark all notifications as locally read with FIFO cap
    setReadIds((prev) => {
      const next = new Set(prev);
      restNotifications.forEach((n) => next.add(n.id));
      contextNotifs.forEach((n) => next.add(n.id));
      return persistReadIds(next);
    });
  }, [markAllNotificationsRead, restNotifications, contextNotifs]);

  // ── Merge context and REST notifications ─────────────────────────
  const mergedNotifications = useMemo(() => {
    const map = new Map();
    
    // Add REST notifications, applying local read state
    restNotifications.forEach(n => {
      if (n.type === 'MATCH_REQUEST' && n.requestId && handledRequestIds.has(n.requestId)) return;
      const isLocallyRead = readIds.has(n.id);
      // Eliminate streak alerts that are already read/dismissed
      if (isLocallyRead && n.type === 'STREAK_ALERT') return;

      // For chat notifications, check if the chat has been read (no longer in unreadCounts)
      const isChatRead = n.matchId && !unreadCounts[n.matchId];
      map.set(n.id, { 
        ...n, 
        read: n.read || isLocallyRead || (n.matchId ? isChatRead : false)
      });
    });
    
    // Add Context (overwrites REST if dup, preserving actionable fields)
    contextNotifs.forEach(n => {
      if (n.type === 'MATCH_REQUEST' && n.requestId && handledRequestIds.has(n.requestId)) return;
      // Eliminate streak alerts that are already read/dismissed
      if (readIds.has(n.id) && n.type === 'STREAK_ALERT') return;
      
      const existing = map.get(n.id) || {};
      map.set(n.id, {
        ...existing,
        ...n,
        category: n.category || existing.category || 'general',
        read: n.read || readIds.has(n.id)
      });
    });
    
    let result = Array.from(map.values());
    
    // Sort newest first across all categories.
    result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Filter by tab
    if (activeTab !== 'All') {
      const cat = activeTab.toLowerCase();
      result = result.filter(n => {
        const nCat = (n.category || '').toLowerCase();
        if (cat === 'messages') return nCat === 'message' || nCat === 'messages';
        if (cat === 'sessions') return nCat === 'session' || nCat === 'sessions';
        return nCat.includes(cat);
      });
    }

    return result;
  }, [restNotifications, contextNotifs, activeTab, readIds, unreadCounts, handledRequestIds]);

  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(Number(ts));
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleAcceptSession = async (e, sessionId) => {
    e.stopPropagation();
    setActionLoading(prev => ({ ...prev, [sessionId]: true }));
    try {
      await sessionService.acceptSession(sessionId);
      alert('Session accepted! 🎉');
      buildNotifications();
    } catch (err) {
      alert('Failed to accept session: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const handleRejectSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to reject this session request?')) return;
    setActionLoading(prev => ({ ...prev, [sessionId]: true }));
    try {
      await sessionService.rejectSession(sessionId);
      alert('Session rejected.');
      buildNotifications();
    } catch {
      alert('Failed to reject session.');
    } finally {
      setActionLoading(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const handleAcceptMatch = async (e, requestId) => {
    e.stopPropagation();
    setActionLoading(prev => ({ ...prev, [requestId]: true }));
    try {
      const res = await matchService.acceptRequest(requestId);
      setHandledRequestIds(prev => new Set(prev).add(requestId));
      markNotificationRead(`match-req-${requestId}`);
      await buildNotifications();
      if (res?.data?.matchId) {
        navigate(`/chat/${res.data.matchId}`);
      }
    } catch (err) {
      alert('Failed to accept match request: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleDeclineMatch = async (e, requestId) => {
    e.stopPropagation();
    setActionLoading(prev => ({ ...prev, [requestId]: true }));
    try {
      await matchService.declineRequest(requestId);
      setHandledRequestIds(prev => new Set(prev).add(requestId));
      markNotificationRead(`match-req-${requestId}`);
      await buildNotifications();
    } catch (err) {
      alert('Failed to decline match request: ' + (err.response?.data?.error || err.message));
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const getIcon = (type, category) => {
    if (type === 'MATCH_REQUEST' || type === 'MATCH_ACCEPTED') return <UserPlus size={18} className="text-[#7C3AED]" />;
    if (category === 'session' || type?.includes('SESSION')) return <Calendar size={18} className="text-blue-500" />;
    if (type === 'FORUM_REPLY' || type === 'NEW_DOUBT' || type === 'NEW_ANSWER' || type === 'ANSWER_ACCEPTED' || category === 'forum' || category === 'social') return <MessageCircle size={18} className="text-[#7C3AED]" />;
    if (category === 'gamification') return <Flame size={18} className="text-orange-500" />;
    if (category === 'message' || type === 'UNREAD_CHAT') return <MessageSquare size={18} className="text-teal-500" />;
    return <Bell size={18} />;
  };

  const getTagColor = (type, category) => {
    if (category === 'session' || type?.includes('SESSION')) return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700';
    if (category === 'gamification') return 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700';
    if (category === 'forum') return 'bg-lime-50 dark:bg-lime-900/20 text-lime-700 dark:text-lime-300 border-lime-200 dark:border-lime-700';
    if (category === 'social') return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700';
    if (category === 'message') return 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700';
    return 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-background-deep -mx-margin-mobile px-margin-mobile -mt-6">
      {/* Header */}
      <header className="flex items-center justify-between py-6 sticky top-0 z-10 bg-gray-50/90 dark:bg-background-deep/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} aria-label="Go back" className="p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-white" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
        </div>
        <button 
          onClick={handleMarkAllRead}
          className="text-sm font-bold text-[#7C3AED] hover:bg-[#7C3AED]/10 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
        >
          <CheckCircle2 size={16} /> Mark all read
        </button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-4 pb-2">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === tab 
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' 
                : 'bg-white text-gray-600 border border-gray-200 dark:bg-surface-container dark:text-gray-300 dark:border-surface-raised hover:bg-gray-100 dark:hover:bg-surface-container-high'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="flex flex-col gap-3 pb-32 flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-[#DCFD8B] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : mergedNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Bell size={32} className="text-gray-400 dark:text-gray-600" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">All caught up!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">No new notifications in this category.</p>
          </div>
        ) : (
          mergedNotifications.map((notif, idx) => (
            <div
              key={notif.id}
              onClick={() => {
                handleMarkRead(notif);
                if (notif.route) navigate(notif.route);
              }}
              className={`bg-white dark:bg-surface-container rounded-2xl p-4 transition-all cursor-pointer ${
                notif.read
                  ? 'border border-gray-100 dark:border-surface-raised opacity-70'
                  : 'border border-success-lime shadow-sm ring-1 ring-success-lime/20'
              } hover:shadow-md hover:-translate-y-0.5 animate-in slide-in-from-bottom-4 duration-300`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <div className="flex justify-between items-start mb-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase font-bold border ${getTagColor(notif.type, notif.category)}`}>
                  {getIcon(notif.type, notif.category)} {notif.title}
                </span>
                <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap ml-2 mt-1">
                  {formatTime(notif.timestamp)}
                </span>
              </div>
              <p className={`text-sm leading-relaxed mb-3 ${notif.read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-on-surface font-semibold'}`}>
                {notif.message}
              </p>

              {/* Action Buttons */}
              {notif.type === 'SESSION_PENDING' && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={(e) => handleAcceptSession(e, notif.sessionId)}
                    disabled={actionLoading[notif.sessionId]}
                    className="text-xs font-bold bg-success-lime text-gray-900 px-4 py-2 rounded-full inline-flex items-center gap-1.5 hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    {actionLoading[notif.sessionId] ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Accept
                  </button>
                  <button
                    onClick={(e) => handleRejectSession(e, notif.sessionId)}
                    disabled={actionLoading[notif.sessionId]}
                    className="text-xs font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-4 py-2 rounded-full inline-flex items-center gap-1.5 hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              )}

              {notif.type === 'MATCH_REQUEST' && notif.requestId && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={(e) => handleAcceptMatch(e, notif.requestId)}
                    disabled={actionLoading[notif.requestId]}
                    className="text-xs font-bold bg-success-lime text-gray-900 px-4 py-2 rounded-full inline-flex items-center gap-1.5 hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    {actionLoading[notif.requestId] ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Accept
                  </button>
                  <button
                    onClick={(e) => handleDeclineMatch(e, notif.requestId)}
                    disabled={actionLoading[notif.requestId]}
                    className="text-xs font-bold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-4 py-2 rounded-full inline-flex items-center gap-1.5 hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    <X size={14} /> Decline
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
