import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { chatService } from '../services/chatService';
import { sessionService } from '../services/sessionService';
import { ArrowLeft, Send, Phone, Video, Info, Check, CheckCheck, Clock, CalendarPlus, Star, X, Loader2, MessageSquare, Plus } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { readCache, writeCache } from '../utils/cache';
import { useAppContext } from '../context/AppContext';

import RatingModal from '../components/RatingModal';

const getMessageTime = (timestamp) => Number(timestamp || Date.now());

const formatMessageTime = (timestamp) =>
  new Date(getMessageTime(timestamp)).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatDateDivider = (timestamp) => {
  const date = new Date(getMessageTime(timestamp));
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const sameMessageDay = (a, b) =>
  new Date(getMessageTime(a)).toDateString() === new Date(getMessageTime(b)).toDateString();

const isMessageSeen = (msg) => msg.read || msg.status === 'read';

// ── Session Booking Modal ───────────────────────────────────────────────
const BookingModal = ({ isOpen, onClose, onBook, matchId, currentUser, partnerId }) => {
  const [skill, setSkill] = useState('');
  const [scheduledAt, setScheduledAt] = useState(new Date());
  const [duration, setDuration] = useState(60);
  const [mode, setMode] = useState('Online');
  const [notes, setNotes] = useState('');
  const [booking, setBooking] = useState(false);

  if (!isOpen) return null;

  const handleBook = async () => {
    if (!skill.trim() || !scheduledAt) return;
    if (!partnerId) {
      alert("Still loading partner info, please try again in a moment.");
      return;
    }
    setBooking(true);
    try {
      await onBook({
        matchId,
        teacherUid: partnerId,
        learnerUid: currentUser.uid,
        skill,
        scheduledAt: scheduledAt.getTime(),
        duration,
        mode,
        meetLink: '',
        location: '',
        notes
      });
      onClose();
    } catch (err) {
      console.error('Booking failed', err);
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-container rounded-3xl p-8 max-w-md w-full shadow-2xl border border-gray-200 dark:border-surface-raised relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-on-surface transition-colors">
          <X size={20} />
        </button>

        <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface mb-6">Request Session</h3>

        <div className="flex flex-col gap-4">
          <div>
            <label className="block font-label-md text-label-md text-gray-700 dark:text-on-surface-variant mb-1.5">Subject / Skill</label>
            <input
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              placeholder="e.g. Data Structures, Calculus"
              className="w-full bg-gray-50 dark:bg-surface-raised border border-gray-200 dark:border-outline-variant rounded-xl py-3 px-4 text-sm text-gray-900 dark:text-on-surface focus:outline-none focus:border-success-lime"
            />
          </div>

          <div className="flex flex-col relative z-[200]">
            <label className="block font-label-md text-label-md text-gray-700 dark:text-on-surface-variant mb-1.5">When?</label>
            <DatePicker
              selected={scheduledAt}
              onChange={(date) => setScheduledAt(date)}
              showTimeSelect
              dateFormat="MMMM d, yyyy h:mm aa"
              className="w-full bg-gray-50 dark:bg-surface-raised border border-gray-200 dark:border-outline-variant rounded-xl py-3 px-4 text-sm text-gray-900 dark:text-on-surface focus:outline-none focus:border-success-lime"
              minDate={new Date()}
            />
          </div>

          <div>
            <label className="block font-label-md text-label-md text-gray-700 dark:text-on-surface-variant mb-1.5">Duration (mins)</label>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full bg-gray-50 dark:bg-surface-raised border border-gray-200 dark:border-outline-variant rounded-xl py-3 px-4 text-sm text-gray-900 dark:text-on-surface focus:outline-none focus:border-success-lime appearance-none"
            >
              <option value={30}>30 mins</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          <div>
            <label className="block font-label-md text-label-md text-gray-700 dark:text-on-surface-variant mb-1.5">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full bg-gray-50 dark:bg-surface-raised border border-gray-200 dark:border-outline-variant rounded-xl py-3 px-4 text-sm text-gray-900 dark:text-on-surface focus:outline-none focus:border-success-lime appearance-none"
            >
              <option value="Online">Online (Meet)</option>
              <option value="In-Person">In-Person</option>
            </select>
          </div>

          <div>
            <label className="block font-label-md text-label-md text-gray-700 dark:text-on-surface-variant mb-1.5">Additional Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific topics to cover..."
              className="w-full bg-gray-50 dark:bg-surface-raised border border-gray-200 dark:border-outline-variant rounded-xl p-4 text-sm text-gray-900 dark:text-on-surface focus:outline-none focus:border-success-lime resize-none h-20"
            />
          </div>
        </div>

        <button
          onClick={handleBook}
          disabled={!skill.trim() || !scheduledAt || booking}
          className={`w-full mt-6 py-3 rounded-full font-label-lg text-label-lg transition-all ${
            skill.trim() && scheduledAt
              ? 'bg-success-lime text-green-900 shadow-[0_4px_0_#b3d266] active:translate-y-[2px]'
              : 'bg-gray-200 dark:bg-surface-raised text-gray-400 cursor-not-allowed'
          }`}
        >
          {booking ? 'Booking...' : 'Book Session'}
        </button>
      </div>
    </div>
  );
};

// ── Main Chat Component ─────────────────────────────────────────────────
const Chat = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const { globalData } = useAppContext();
  
  // Use Master unified websocket state from NotificationContext
  const { 
    threads, 
    subscribeToChat, 
    sendMessage: globalSendMessage, 
    sendTyping: globalSendTyping, 
    markRead: globalMarkRead,
    editMessage: globalEditMessage,
    deleteMessage: globalDeleteMessage,
    unreadCounts
  } = useNotifications();
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [partner, setPartner] = useState(location.state?.partner || null);
  
  // -- New Chat feature state --
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [isCreatingThread, setIsCreatingThread] = useState(false);

  const handleStartNewChat = async (user) => {
    if (!user || !user.uid) return;
    setIsCreatingThread(true);
    try {
      const result = await chatService.getOrCreateThread(user.uid);
      if (result && result.matchId) {
        setShowNewChatModal(false);
        navigate(`/chat/${result.matchId}`, { state: { partner: user } });
      }
    } catch (err) {
      console.error("Failed to start chat", err);
    } finally {
      setIsCreatingThread(false);
    }
  };
  const [isTyping, setIsTyping] = useState(false);
  
  // Session state
  const [sessions, setSessions] = useState([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingSessionId, setRatingSessionId] = useState(null);
  const [calendarLoading, setCalendarLoading] = useState({});
  
  // Edit/Delete state
  const [longPressMsgId, setLongPressMsgId] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const pressTimer = useRef(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!matchId) return;
    if (!currentUser) return;
    
    const historyCacheKey = `chat-history:${matchId}`;
    const detailCacheKey = `chat-detail:${matchId}`;
    const cachedMessages = readCache(historyCacheKey, []);
    const cachedDetail = readCache(detailCacheKey, null);
    if (cachedMessages.length > 0) setMessages(cachedMessages);
    if (cachedDetail?.partner && !partner) setPartner(cachedDetail.partner);

    const initChat = async () => {
      try {
        // Fetch history
        const history = await chatService.getHistory(matchId);
        console.log("HISTORY FETCHED:", history);
        const historyMessages = Array.isArray(history) ? history : (history.data || history.messages || []);
        console.log("HISTORY MESSAGES SETTING:", historyMessages);
        if (historyMessages.length > 0 || cachedMessages.length === 0) {
          setMessages(historyMessages);
          writeCache(historyCacheKey, historyMessages);
        }

        const detail = await chatService.getThreadDetail(matchId).catch(() => null);
        if (detail?.data?.partner) {
          setPartner(detail.data.partner);
          writeCache(detailCacheKey, detail.data);
        }
        
        // Fetch sessions for this match
        loadSessions();
        setTimeout(() => globalMarkRead(matchId), 250);
      } catch (err) {
        console.error("Failed to init chat", err);
      }
    };

    initChat();

    // Subscribe to unified WebSocket
    const unsubscribe = subscribeToChat(matchId, (data) => {
      if (data.type === 'read_receipt') {
        setMessages(prev => prev.map(m => {
          const isMine = m.senderUid === currentUser.uid || m.senderId === currentUser.uid;
          return isMine ? { ...m, read: true, status: 'read' } : m;
        }));
        return;
      }

      if (data.type === 'typing') {
        if (data.uid !== currentUser.uid) {
          setIsTyping(true);
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
        }
        return;
      }

      if (data.type === 'message_edited') {
        setMessages(prev => prev.map(m => (m.id === data.messageId || m.messageId === data.messageId) ? { ...m, text: data.text, isEdited: true } : m));
        return;
      }
      
      if (data.type === 'message_deleted') {
        setMessages(prev => prev.filter(m => m.id !== data.messageId && m.messageId !== data.messageId));
        return;
      }

      if (data.type === 'message') {
        const incoming = {
          id: data.messageId,
          messageId: data.messageId,
          localId: data.localId,
          senderUid: data.senderUid,
          senderName: data.senderName,
          text: data.text,
          timestamp: data.timestamp,
          read: data.read || false,
          isEdited: data.isEdited || false,
        };

        setMessages(prev => {
          // If we sent this message optimistically, match by localId
          if (incoming.localId) {
            const optimisticIdx = prev.findIndex(m => m.localId === incoming.localId);
            if (optimisticIdx !== -1) {
              const updated = [...prev];
              updated[optimisticIdx] = { ...updated[optimisticIdx], ...incoming, status: 'sent' };
              return updated;
            }
          }
          
          // Duplicate fallback
          const isDuplicate = prev.find(m => m.id === incoming.id || m.messageId === incoming.messageId);
          if (isDuplicate) return prev;
          
          return [...prev, incoming];
        });
        
        setIsTyping(false);
        if (incoming.senderUid !== currentUser.uid && incoming.senderId !== currentUser.uid) {
          setTimeout(() => globalMarkRead(matchId), 150);
        }
      }
    });

    return () => unsubscribe();
  }, [matchId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (matchId && messages.length > 0) {
      writeCache(`chat-history:${matchId}`, messages);
    }
  }, [messages, isTyping]);

  async function loadSessions() {
    try {
      const res = await sessionService.getSessions(currentUser.uid);
      const matchSessions = (res.data || []).filter(s => s.matchId === matchId);
      setSessions(matchSessions);
    } catch (err) {
      console.error("Failed to load sessions", err);
    }
  }

  const handleStartPress = (msg) => {
    if (msg.senderUid !== currentUser.uid && msg.senderId !== currentUser.uid) return;
    if (isMessageSeen(msg)) return;
    pressTimer.current = setTimeout(() => {
      setLongPressMsgId(msg.id || msg.messageId);
    }, 500); // 500ms long press
  };

  const handleEndPress = () => {
    clearTimeout(pressTimer.current);
  };

  const handleEditClick = (msg) => {
    if (isMessageSeen(msg)) return;
    setEditingMsg(msg);
    setInputText(msg.text);
    setLongPressMsgId(null);
  };

  const handleDeleteClick = (msg) => {
    if (window.confirm("Delete this message?")) {
      globalDeleteMessage(matchId, msg.id || msg.messageId);
      setMessages(prev => prev.filter(m => m.id !== (msg.id || msg.messageId) && m.messageId !== (msg.id || msg.messageId)));
    }
    setLongPressMsgId(null);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText;
    setInputText('');

    if (editingMsg) {
      // Handle Edit
      const msgId = editingMsg.id || editingMsg.messageId;
      setMessages(prev => prev.map(m => (m.id === msgId || m.messageId === msgId) ? { ...m, text: text, isEdited: true } : m));
      globalEditMessage(matchId, msgId, text);
      setEditingMsg(null);
      return;
    }

    const localId = Date.now().toString() + Math.random().toString(36).substring(7);
    const optimisticMsg = {
      id: localId,
      messageId: localId,
      localId: localId,
      senderId: currentUser.uid,
      senderUid: currentUser.uid,
      text: text,
      timestamp: Date.now(),
      status: 'sending'
    };
    
    setMessages(prev => [...prev, optimisticMsg]);

    const sent = globalSendMessage(matchId, text, localId);
    if (!sent) {
      // Fallback if WS fails
      try {
        await chatService.sendMessage(matchId, text);
      } catch(err) {
        setMessages(prev => prev.map(m => m.localId === localId ? {...m, status: 'error'} : m));
      }
    }
  };

  const handleTyping = (e) => {
    setInputText(e.target.value);
    globalSendTyping(matchId);
  };

  // ── Session Actions ─────────────────────────────────────────────────
  const handleBookSession = async (sessionData) => {
    try {
      await sessionService.book(sessionData);
      alert('Session request sent! 📩 The other user will receive a notification to accept or reject it.');
      loadSessions();
    } catch (err) {
      console.error('Booking failed:', err);
      alert('Failed to book session: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleExportCalendar = async (sessionId) => {
    setCalendarLoading(prev => ({ ...prev, [sessionId]: true }));
    try {
      // Use the URL-based Google Calendar export (no OAuth required)
      const res = await sessionService.exportToCalendar(sessionId);
      if (res.data?.htmlLink) {
        window.open(res.data.htmlLink, '_blank');
      } else {
        alert('Could not generate calendar link.');
      }
    } catch (err) {
      console.error('Calendar export failed:', err);
      alert('Failed to add to calendar.');
    } finally {
      setCalendarLoading(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  const handleRateSession = async (sessionId, rating, comment) => {
    try {
      await sessionService.rate(sessionId, rating, comment);
      alert(`Rating submitted! You earned Mind Tokens! 🪙`);
      loadSessions();
    } catch (err) {
      console.error('Rating failed:', err);
      alert('Failed to submit rating: ' + (err.response?.data?.error || err.message));
    }
  };

  // ── No matchId — show threads list ─────────────────────────────────
  if (!matchId) {
    const chatableUsers = [...(globalData?.topMates || []), ...(globalData?.followedUsers || [])].filter((v, i, a) => a.findIndex(t => (t.uid === v.uid)) === i); // Unique users

    return (
      <div className="flex flex-col -mt-6 -mx-margin-mobile px-margin-mobile bg-gray-50 dark:bg-background-deep relative z-10 pb-6">
        <header className="py-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-on-surface">Your Messages</h2>
          <button 
            onClick={() => setShowNewChatModal(true)}
            className="w-10 h-10 rounded-full bg-purple-100 dark:bg-secondary-container text-purple-700 dark:text-focus-purple flex items-center justify-center hover:bg-purple-200 dark:hover:bg-purple-900/40 transition-colors shadow-sm"
          >
            <Plus size={20} />
          </button>
        </header>
        <div className="flex flex-col gap-3">
          {threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-70">
              <MessageSquare size={64} className="text-gray-300 dark:text-surface-raised mb-4" />
              <h2 className="font-headline-md text-gray-900 dark:text-on-surface">No Messages Yet</h2>
              <p className="text-gray-500 mt-2">Start a conversation with your mates.</p>
            </div>
          ) : (
            threads.map((thread) => {
              const partner = thread.partner;
              const unreadCount = unreadCounts[thread.matchId] || 0;
              const isUnread = unreadCount > 0 && thread.lastMessageSender !== currentUser?.uid;
              
              return (
                <div 
                  key={thread.matchId}
                  onClick={() => navigate(`/chat/${thread.matchId}`, { state: { partner } })}
                  className="bg-white dark:bg-surface-container rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-container-high transition-all active:scale-[0.98] border border-transparent hover:border-gray-100 dark:hover:border-surface-raised shadow-sm animate-in slide-in-from-top-2 duration-300"
                >
                  <div className="relative shrink-0">
                    <img 
                      src={partner?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.name || 'User')}&background=DCFD8B&color=151f00`} 
                      alt="Avatar" 
                      className="w-14 h-14 rounded-full object-cover" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-bold text-gray-900 dark:text-on-surface text-base truncate">{partner?.name || 'Study Partner'}</h3>
                      <div className="flex flex-col items-end gap-1">
                        {!!thread.lastMessageTime && (
                          <span className={`text-[11px] whitespace-nowrap ml-2 ${isUnread ? 'text-success-lime font-bold' : 'text-gray-400'}`}>
                            {new Date(thread.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className={`text-sm truncate ${isUnread ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500 dark:text-on-surface-variant'}`}>
                        {thread.lastMessage || 'Say hi!'}
                      </p>
                      {isUnread && (
                        <div className="min-w-[18px] px-1.5 h-[18px] bg-success-lime text-gray-900 text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 ml-2 shadow-sm">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* New Chat Modal */}
        {showNewChatModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white dark:bg-surface-container rounded-3xl p-6 w-full max-w-sm max-h-[70vh] flex flex-col relative animate-[slideUp_0.2s_ease-out]">
              <button 
                onClick={() => setShowNewChatModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 dark:bg-surface-raised flex items-center justify-center text-gray-500 dark:text-on-surface hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <X size={18} />
              </button>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Start New Chat</h3>
              
              <div className="flex-1 overflow-y-auto hide-scrollbar">
                {chatableUsers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Follow some users or match with mates to start chatting!</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {chatableUsers.map(user => (
                      <button
                        key={user.uid}
                        onClick={() => handleStartNewChat(user)}
                        disabled={isCreatingThread}
                        className="flex items-center gap-3 w-full p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-surface-raised transition-colors text-left"
                      >
                        <img 
                          src={user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}`}
                          alt={user.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1 overflow-hidden">
                          <p className="font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
                          <p className="text-xs text-gray-500 truncate">{user.college || 'Mindcraft User'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Upcoming sessions for this match
  const upcomingSessions = sessions.filter(s => s.status === 'upcoming');
  const pendingSessions = sessions.filter(s => s.status === 'pending');
  const completedUnrated = sessions.filter(s => s.status === 'completed' && (!s.rating || s.rating === 0));

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] -mt-6 -mx-margin-mobile px-margin-mobile bg-white dark:bg-background-deep relative z-50">
      {/* Chat Header */}
      <header className="flex items-center justify-between py-4 border-b border-gray-200 dark:border-surface-raised bg-white/80 dark:bg-background-deep/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-container transition-colors">
            <ArrowLeft size={20} />
          </button>
          <button onClick={() => partner?.uid && navigate(`/profile/${partner.uid}`)} className="flex items-center gap-3 text-left">
            <div className="relative">
              <img src={partner?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.name || 'Study Partner')}&background=DCFD8B&color=151f00`} alt={partner?.name || 'Study Partner'} className="w-10 h-10 rounded-full object-cover" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-background-deep rounded-full"></div>
            </div>
            <div>
              <h2 className="font-label-lg text-lg text-gray-900 dark:text-on-surface leading-tight">{partner?.name || 'Study Partner'}</h2>
              <p className="font-label-md text-gray-500 text-xs">
                {partner?.averageRating > 0 ? `${Number(partner.averageRating).toFixed(1)} rating` : 'New mate'}
                {partner?.college ? ` • ${partner.college}` : ''}
              </p>
            </div>
          </button>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowBookingModal(true)}
            className="p-2 text-green-600 dark:text-success-lime hover:bg-green-50 dark:hover:bg-surface-container rounded-full transition-colors"
            title="Request Session"
          >
            <CalendarPlus size={20} />
          </button>
        </div>
      </header>

      {/* Session Cards (Pending + Upcoming + Unrated) */}
      {(pendingSessions.length > 0 || upcomingSessions.length > 0 || completedUnrated.length > 0) && (
        <div className="py-3 flex flex-col gap-2 border-b border-gray-100 dark:border-surface-raised">
          {pendingSessions.map(session => (
            <div key={session.sessionId} className="bg-amber-50 dark:bg-surface-container rounded-xl p-3 flex items-center justify-between border border-amber-200 dark:border-amber-500/30">
              <div className="flex-1">
                <div className="font-label-md text-amber-700 dark:text-amber-400 text-xs uppercase tracking-wider flex items-center gap-1">
                  <Clock size={12} /> Pending Approval
                </div>
                <div className="font-body-md text-gray-900 dark:text-white text-sm mt-0.5">{session.skill}</div>
                <div className="font-label-md text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                  {new Date(session.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
            </div>
          ))}
          {upcomingSessions.map(session => (
            <div key={session.sessionId} className="bg-green-50 dark:bg-surface-container rounded-xl p-3 flex items-center justify-between border border-green-200 dark:border-success-lime/20">
              <div className="flex-1">
                <div className="font-label-md text-green-700 dark:text-success-lime text-xs uppercase tracking-wider">Upcoming Session</div>
                <div className="font-body-md text-gray-900 dark:text-on-surface text-sm mt-0.5">{session.skill}</div>
                <div className="font-label-md text-gray-500 text-xs mt-0.5">
                  {new Date(session.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
              <button
                onClick={() => handleExportCalendar(session.sessionId)}
                disabled={calendarLoading[session.sessionId]}
                className="bg-white dark:bg-surface-raised border border-green-200 dark:border-outline-variant rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-label-md text-green-700 dark:text-success-lime hover:bg-green-50 transition-colors"
              >
                {calendarLoading[session.sessionId] ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <CalendarPlus size={14} />
                )}
                Add to Calendar
              </button>
            </div>
          ))}
          {completedUnrated.map(session => (
            <div key={session.sessionId} className="bg-purple-50 dark:bg-secondary-container/20 rounded-xl p-3 flex items-center justify-between border border-purple-200 dark:border-secondary-container/30">
              <div className="flex-1">
                <div className="font-label-md text-purple-700 dark:text-secondary text-xs uppercase tracking-wider">Rate Session</div>
                <div className="font-body-md text-gray-900 dark:text-on-surface text-sm mt-0.5">{session.skill}</div>
              </div>
              <button
                onClick={() => { setRatingSessionId(session.sessionId); setShowRatingModal(true); }}
                className="bg-focus-purple text-white rounded-full px-4 py-1.5 flex items-center gap-1.5 text-xs font-label-md hover:bg-purple-500 transition-colors"
              >
                <Star size={14} /> Rate Now
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-3 hide-scrollbar">
        {messages.map((msg, idx) => {
          const isMine = msg.senderId === currentUser.uid || msg.senderUid === currentUser.uid;
          const previous = messages[idx - 1];
          const showDivider = !previous || !sameMessageDay(previous.timestamp, msg.timestamp);
          return (
            <div key={msg.id || msg.messageId || idx} className="contents">
              {showDivider && (
                <div className="text-center font-label-md text-gray-400 my-4 text-xs">
                  {formatDateDivider(msg.timestamp)}
                </div>
              )}
              <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`max-w-[75%] rounded-2xl px-4 py-2 relative group cursor-pointer ${
                    isMine 
                      ? 'bg-focus-purple text-white rounded-br-sm' 
                      : 'bg-gray-100 dark:bg-surface-container text-gray-900 dark:text-on-surface rounded-bl-sm border border-gray-200 dark:border-surface-raised'
                  } ${longPressMsgId === (msg.id || msg.messageId) ? 'ring-2 ring-offset-2 ring-focus-purple dark:ring-offset-background-deep' : ''}`}
                  onPointerDown={() => handleStartPress(msg)}
                  onPointerUp={handleEndPress}
                  onPointerLeave={handleEndPress}
                  onContextMenu={(e) => {
                    if (isMine) {
                      e.preventDefault();
                      setLongPressMsgId(msg.id || msg.messageId);
                    }
                  }}
                >
                  <p className="font-body-md text-[15px] break-words">{msg.text}</p>
                  <div className={`text-xs flex items-center justify-end gap-1 mt-1.5 opacity-90 ${isMine ? 'text-purple-100' : 'text-gray-500'}`}>
                    {msg.isEdited && <span className="mr-1 italic text-[10px]">Edited</span>}
                    {formatMessageTime(msg.timestamp)}
                    {isMine && (
                      msg.status === 'sending' ? <Clock size={12} /> :
                      isMessageSeen(msg) ? <CheckCheck size={14} className="text-blue-300" /> : <Check size={14} />
                    )}
                  </div>

                  {/* Edit/Delete Action Menu */}
                  {longPressMsgId === (msg.id || msg.messageId) && (
                    <div className="absolute top-full right-0 mt-1 bg-white dark:bg-surface-container border border-gray-200 dark:border-surface-raised rounded-xl shadow-lg z-50 overflow-hidden flex flex-col min-w-[120px]">
                      {!isMessageSeen(msg) && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEditClick(msg); }} 
                          className="px-4 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-surface-container-high text-left w-full border-b border-gray-100 dark:border-surface-raised"
                        >
                          Edit Message
                        </button>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(msg); }} 
                        className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 text-left w-full"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-surface-container text-gray-900 dark:text-on-surface rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center w-16">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="pt-3 pb-safe bg-white dark:bg-background-deep border-t border-gray-200 dark:border-surface-raised sticky bottom-0">
        <form onSubmit={handleSend} className="flex flex-col gap-2 bg-gray-100 dark:bg-surface-container rounded-[24px] p-1 border border-gray-200 dark:border-surface-raised transition-colors focus-within:border-focus-purple dark:focus-within:border-focus-purple">
          {editingMsg && (
            <div className="flex items-center justify-between px-4 pt-2 pb-1 text-xs text-purple-600 dark:text-purple-400 font-semibold border-b border-gray-200 dark:border-surface-raised">
              <span>Editing message</span>
              <button type="button" onClick={() => { setEditingMsg(null); setInputText(''); }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                Cancel
              </button>
            </div>
          )}
          <div className="flex items-end gap-2 w-full">
            <input 
              type="text" 
              value={inputText}
              onChange={handleTyping}
              placeholder="Type a message..." 
              className="flex-1 bg-transparent px-4 py-3 max-h-32 font-body-md text-gray-900 dark:text-on-surface focus:outline-none placeholder:text-gray-500 w-full"
            />
          <button 
            type="submit" 
            disabled={!inputText.trim()}
            className={`p-3 rounded-full mb-0.5 mr-0.5 transition-colors ${
              inputText.trim() 
                ? 'bg-focus-purple text-white shadow-md active:scale-95' 
                : 'bg-transparent text-gray-400'
            }`}
          >
            <Send size={20} className={inputText.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
          </button>
          </div>
        </form>
      </div>

      {/* Modals */}
      <BookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        onBook={handleBookSession}
        matchId={matchId}
        currentUser={currentUser}
        partnerId={partner?.uid}
      />
      <RatingModal
        isOpen={showRatingModal}
        onClose={() => { setShowRatingModal(false); setRatingSessionId(null); }}
        onSubmit={handleRateSession}
        sessionId={ratingSessionId}
      />
    </div>
  );
};

export default Chat;
