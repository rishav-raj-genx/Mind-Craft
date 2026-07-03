import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sessionService } from '../services/sessionService';
import { gamificationService } from '../services/gamificationService';
import { doubtService } from '../services/doubtService';
import { chatService } from '../services/chatService';
import { ArrowLeft, Check, X, MessageCircle, Coins, Flame, UserPlus, Calendar, Bell, MessageSquare } from 'lucide-react';

const Notifications = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    buildNotifications();
  }, [currentUser]);

  // Build dynamic notifications from real data sources
  const buildNotifications = async () => {
    setLoading(true);
    const notifs = [];

      // 1. Upcoming sessions (session requests)
      const sessRes = await sessionService.getSessions(currentUser.uid, 'upcoming');
      const upcomingSessions = sessRes.data || [];
      upcomingSessions.forEach(s => {
        const isTeacher = s.teacherUid === currentUser.uid;
        notifs.push({
          id: `session-${s.sessionId}`,
          type: 'SESSION_REQUEST',
          title: 'Upcoming Session',
          message: isTeacher
            ? `You have an upcoming tutoring session for "${s.skill}".`
            : `You're scheduled to learn "${s.skill}" soon.`,
          timeAgo: formatTime(s.scheduledAt),
          read: false,
          sessionId: s.sessionId,
          actionable: false,
        });
      });

      // 1a. Pending session requests
      const pendingRes = await sessionService.getSessions(currentUser.uid, 'pending');
      const pendingSessions = pendingRes.data || [];
      pendingSessions.forEach(s => {
        const isTeacher = s.teacherUid === currentUser.uid;
        if (isTeacher) {
          notifs.push({
            id: `session-req-${s.sessionId}`,
            type: 'SESSION_PENDING',
            title: 'Session Request',
            message: `Someone requested a tutoring session for "${s.skill}" on ${new Date(s.scheduledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}.`,
            timeAgo: formatTime(s.createdAt || s.scheduledAt),
            read: false,
            sessionId: s.sessionId,
            actionable: true,
          });
        }
      });
    } catch (err) {
      console.error('Session notifs error:', err);
    }

    try {
      // 2. Streak notification
      const streakRes = await gamificationService.getStreak(currentUser.uid);
      const streak = streakRes.data || {};
      if (streak.currentStreak > 0) {
        notifs.push({
          id: 'streak-alert',
          type: 'STREAK_ALERT',
          title: 'Streak Alert',
          message: `${streak.currentStreak} Day Streak! ${streak.currentStreak >= 7 ? "You're on fire! 🔥" : 'Keep studying daily to build your streak.'}`,
          timeAgo: 'Today',
          read: streak.currentStreak > 3,
          actionable: false,
        });
      }
    } catch (err) {
      console.error('Streak notifs error:', err);
    }

    try {
      // 3. Token rewards — check recent transactions
      const tokensRes = await gamificationService.getTokens(currentUser.uid);
      const balance = tokensRes.data?.balance || 0;
      const transactions = tokensRes.data?.transactions || [];
      // Show the most recent transaction as a notification
      if (transactions.length > 0) {
        const latest = transactions[0];
        notifs.push({
          id: `token-${latest.id || 'latest'}`,
          type: 'REWARD',
          title: 'Token Reward',
          message: `You earned ${latest.amount || 0} Mind Tokens${latest.reason ? ` for ${latest.reason}` : ''}. Balance: ${balance}`,
          timeAgo: latest.createdAt ? formatTime(latest.createdAt) : 'Recently',
          read: true,
          actionable: false,
        });
      }
    } catch (err) {
      console.error('Token notifs error:', err);
    }

    try {
      // 4. Forum activity — check if your doubts got answers
      const doubtsRes = await doubtService.getAllDoubts('All Doubts');
      const doubts = doubtsRes.data || [];
      const myDoubts = doubts.filter(d => d.authorUid === currentUser.uid && d.answerCount > 0);
      myDoubts.slice(0, 3).forEach(d => {
        notifs.push({
          id: `doubt-${d.id}`,
          type: 'FORUM_REPLY',
          title: 'Forum Activity',
          message: `Your doubt "${d.title}" has ${d.answerCount} answer${d.answerCount > 1 ? 's' : ''}!`,
          timeAgo: formatTime(d.createdAt),
          read: true,
          actionable: false,
          doubtId: d.id,
        });
      });

      // 5. New Doubts - show doubts posted by others recently (last 24 hours)
      const now = Date.now();
      const recentDoubts = doubts.filter(d =>
        d.authorUid !== currentUser.uid &&
        (now - d.createdAt) < 24 * 60 * 60 * 1000
      );

      recentDoubts.slice(0, 5).forEach(d => {
        notifs.push({
          id: `new-doubt-${d.id}`,
          type: 'NEW_DOUBT',
          title: `New in ${d.tag}`,
          message: `${d.authorName} asked: "${d.title}"`,
          timeAgo: formatTime(d.createdAt),
          read: false, // Unread to grab attention
          actionable: false,
          doubtId: d.id,
        });
      });
    } catch (err) {
      console.error('Forum notifs error:', err);
    }

    try {
      // 6. Unread Chats
      const threadsRes = await chatService.getThreads(currentUser.uid);
      const threads = threadsRes.data || [];
      threads.forEach(t => {
        if (t.unread && t.lastMessageSender !== currentUser.uid) {
          notifs.push({
            id: `chat-${t.matchId}`,
            type: 'UNREAD_CHAT',
            title: 'New Message',
            message: `You have an unread message from a study partner.`,
            timeAgo: formatTime(t.lastMessageTime),
            read: false,
            actionable: true,
            matchId: t.matchId,
          });
        }
      });
    } catch (err) {
      console.error('Chat notifs error:', err);
    }

    // Sort by read status (unread first), keep the order otherwise
    notifs.sort((a, b) => (a.read === b.read ? 0 : a.read ? 1 : -1));
    setNotifications(notifs);
    setLoading(false);
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    const now = Date.now();
    const diff = now - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };



  const getIcon = (type) => {
    switch (type) {
      case 'SESSION_REQUEST': return <Calendar size={18} className="text-blue-500" />;
      case 'SESSION_PENDING': return <CalendarPlus size={18} className="text-emerald-500" />;
      case 'FORUM_REPLY': return <MessageCircle size={18} className="text-[#7C3AED]" />;
      case 'REWARD': return <Coins size={18} className="text-amber-500" />;
      case 'STREAK_ALERT': return <Flame size={18} className="text-orange-500" />;
      case 'NEW_DOUBT': return <MessageCircle size={18} className="text-pink-500" />;
      case 'UNREAD_CHAT': return <MessageSquare size={18} className="text-teal-500" />;
      default: return <Bell size={18} />;
    }
  };

  const getTagColor = (type) => {
    switch (type) {
      case 'SESSION_REQUEST': return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      case 'SESSION_PENDING': return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700';
      case 'FORUM_REPLY': return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700';
      case 'REWARD': return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700';
      case 'STREAK_ALERT': return 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700';
      case 'NEW_DOUBT': return 'bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-700';
      case 'UNREAD_CHAT': return 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700';
      default: return 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-white" />
          </button>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h1>
        </div>
      </header>

      {/* Notification List */}
      <div className="flex flex-col gap-3 pb-32">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-[#DCFD8B] border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400 text-sm">Loading notifications...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Bell size={32} className="text-gray-400 dark:text-gray-600" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">All caught up!</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">No new notifications.</p>
          </div>
        ) : (
          notifications.map((notif, idx) => (
            <article
              key={notif.id}
              className={`bg-white dark:bg-[#1C1C2E] rounded-2xl p-4 border transition-all ${notif.read
                  ? 'border-gray-100 dark:border-gray-800 opacity-75'
                  : 'border-[#7C3AED]/30 dark:border-purple-700/30 shadow-sm'
                }`}
              style={{ animationDelay: `${idx * 60}ms`, animation: 'slideUp 0.4s ease-out both' }}
            >
              <div className="flex justify-between items-center mb-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${getTagColor(notif.type)}`}>
                  {getIcon(notif.type)} {notif.title}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{notif.timeAgo}</span>
              </div>
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed mb-3">{notif.message}</p>

              {/* Action Buttons */}
              {notif.type === 'NEW_DOUBT' && (
                <button onClick={() => navigate(`/forum?doubtId=${notif.doubtId}`)} className="text-xs font-bold bg-[#DCFD8B] text-[#151f00] px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 hover:scale-105 transition-transform">
                  <MessageCircle size={12} /> Answer Doubt
                </button>
              )}
              {notif.type === 'FORUM_REPLY' && (
                <button onClick={() => navigate(`/forum?doubtId=${notif.doubtId}`)} className="text-xs font-bold bg-[#7C3AED] text-white px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 hover:scale-105 transition-transform">
                  <MessageCircle size={12} /> View Answers
                </button>
              )}
              {notif.type === 'UNREAD_CHAT' && (
                <button onClick={() => navigate(`/chat/${notif.matchId}`)} className="text-xs font-bold bg-teal-500 text-white px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 hover:scale-105 transition-transform">
                  <MessageSquare size={12} /> Open Chat
                </button>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
