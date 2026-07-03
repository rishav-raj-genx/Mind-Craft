import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { chatService, ChatWebSocket } from '../services/chatService';
import { sessionService } from '../services/sessionService';
import { ArrowLeft, Send, Phone, Video, Info, Check, CheckCheck, Clock, CalendarPlus, Star, X, Loader2, MessageSquare } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

// ── Rating Modal Component ──────────────────────────────────────────────
const RatingModal = ({ isOpen, onClose, onSubmit, sessionId }) => {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    try {
      await onSubmit(sessionId, rating, comment);
      onClose();
    } catch (err) {
      console.error('Rating submission failed', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-container rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-200 dark:border-surface-raised relative animate-[fadeIn_0.2s_ease-out]">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-on-surface transition-colors">
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface">Rate this Session</h3>
          <p className="font-body-sm text-body-sm text-gray-500 dark:text-on-surface-variant mt-2">How was your learning experience?</p>
        </div>

        {/* 5-Star Rating */}
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              onClick={() => setRating(star)}
              className="transition-transform hover:scale-110 active:scale-95"
            >
              <Star
                size={36}
                className={`transition-colors ${
                  star <= (hoveredStar || rating)
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300 dark:text-surface-raised'
                }`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your feedback (optional)..."
          className="w-full bg-gray-50 dark:bg-surface-raised border border-gray-200 dark:border-outline-variant rounded-xl p-4 text-sm text-gray-900 dark:text-on-surface placeholder:text-gray-400 focus:outline-none focus:border-success-lime resize-none h-24 mb-6"
        />

        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className={`w-full py-3 rounded-full font-label-lg text-label-lg transition-all ${
            rating > 0
              ? 'bg-success-lime text-green-900 shadow-[0_4px_0_#b3d266] active:translate-y-[2px] active:shadow-[0_2px_0_#b3d266]'
              : 'bg-gray-200 dark:bg-surface-raised text-gray-400 cursor-not-allowed'
          }`}
        >
          {submitting ? 'Submitting...' : `Submit Rating (${rating}/5)`}
        </button>
      </div>
    </div>
  );
};

// ── Session Booking Modal ───────────────────────────────────────────────
const BookingModal = ({ isOpen, onClose, onBook, matchId, currentUser, partnerId }) => {
  const [skill, setSkill] = useState('');
  const [scheduledAt, setScheduledAt] = useState(new Date());
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
        scheduledAt: new Date(scheduledAt).getTime(),
        mode,
        notes,
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
              timeFormat="HH:mm"
              timeIntervals={15}
              timeCaption="Time"
              dateFormat="MMMM d, yyyy h:mm aa"
              className="w-full bg-gray-50 dark:bg-surface-raised border border-gray-200 dark:border-outline-variant rounded-xl py-3 px-4 text-sm text-gray-900 dark:text-on-surface focus:outline-none focus:border-success-lime"
              minDate={new Date()}
            />
          </div>

          <div>
            <label className="block font-label-md text-label-md text-gray-700 dark:text-on-surface-variant mb-1.5">Mode</label>
            <div className="flex gap-3">
              {['Online', 'In-Person'].map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 px-4 rounded-full text-sm font-label-md transition-colors border ${
                    mode === m
                      ? 'bg-success-lime/20 border-success-lime text-green-700 dark:text-success-lime'
                      : 'bg-gray-50 dark:bg-surface-raised border-gray-200 dark:border-outline-variant text-gray-600 dark:text-on-surface-variant'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-label-md text-label-md text-gray-700 dark:text-on-surface-variant mb-1.5">Notes (optional)</label>
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
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [partner, setPartner] = useState(location.state?.partner || null);
  const [isTyping, setIsTyping] = useState(false);
  const [threads, setThreads] = useState([]);
  
  // Session state
  const [sessions, setSessions] = useState([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingSessionId, setRatingSessionId] = useState(null);
  const [calendarLoading, setCalendarLoading] = useState({});

  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!matchId) {
      if (currentUser) {
        chatService.getThreads(currentUser.uid).then(res => {
          setThreads(res.data || []);
        }).catch(err => console.error(err));
      }
      return;
    }

    if (!currentUser) return;

    const initChat = async () => {
      try {
        // Fetch history
        const history = await chatService.getHistory(matchId);
        setMessages(history.data || history.messages || []);

        const detail = await chatService.getThreadDetail(matchId).catch(() => null);
        if (detail?.data?.partner) {
          setPartner(detail.data.partner);
        }
        
        // Setup WebSocket
        const token = await currentUser.getIdToken();
        wsRef.current = new ChatWebSocket(
          matchId, 
          token, 
          handleReceiveMessage, 
          handleTypingIndicator
        );

        // Fetch sessions for this match
        loadSessions();
      } catch (err) {
        console.error("Failed to init chat", err);
      }
    };

    initChat();

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, [matchId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const loadSessions = async () => {
    try {
      const res = await sessionService.getSessions(currentUser.uid);
      // Filter sessions for this match
      const matchSessions = (res.data || []).filter(s => s.matchId === matchId);
      setSessions(matchSessions);
    } catch (err) {
      console.error("Failed to load sessions", err);
    }
  };

  const handleReceiveMessage = (data) => {
    const incoming = data.message || (
      data.type === 'message'
        ? {
            id: data.messageId,
            messageId: data.messageId,
            senderUid: data.senderUid,
            senderName: data.senderName,
            text: data.text,
            timestamp: data.timestamp,
            read: data.read || false,
          }
        : null
    );

    if (incoming) {
      setMessages(prev => {
        const isDuplicate = prev.find(m => 
          m.id === incoming.id || 
          m.messageId === incoming.messageId ||
          (m.senderUid === incoming.senderUid && m.text === incoming.text && Math.abs(m.timestamp - incoming.timestamp) < 5000)
        );
        if (isDuplicate) {
          return prev.map(m => (m === isDuplicate && m.status) ? { ...m, ...incoming, status: 'sent' } : m);
        }
        return [...prev, incoming];
      });
      setIsTyping(false);
    }
  };

  const handleTypingIndicator = (data) => {
    if (data.uid !== currentUser.uid) {
      setIsTyping(true);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText;
    setInputText('');

    const optimisticMsg = {
      id: Date.now().toString(),
      messageId: Date.now().toString(),
      senderId: currentUser.uid,
      senderUid: currentUser.uid,
      text: text,
      timestamp: Date.now(),
      status: 'sending'
    };
    
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      if (wsRef.current) {
        const sentOverSocket = wsRef.current.sendMessage(text);
        if (!sentOverSocket) {
          await chatService.sendMessage(matchId, text);
        }
        setTimeout(() => {
          setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? {...m, status: 'sent'} : m));
        }, 500);
      } else {
        await chatService.sendMessage(matchId, text);
      }
    } catch (err) {
      console.error("Failed to send message", err);
      setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? {...m, status: 'error'} : m));
    }
  };

  const handleTyping = (e) => {
    setInputText(e.target.value);
    if (wsRef.current) {
      wsRef.current.sendTyping();
    }
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
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] -mt-6 -mx-margin-mobile px-margin-mobile bg-gray-50 dark:bg-background-deep relative z-50">
        <header className="py-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-on-surface">Your Messages</h2>
        </header>
        <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col gap-3 pb-safe">
          {threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-70">
              <MessageSquare size={64} className="text-gray-300 dark:text-surface-raised mb-4" />
              <h2 className="font-headline-md text-gray-900 dark:text-on-surface">No Messages Yet</h2>
              <p className="text-gray-500 mt-2">Go to Find Mate to start a conversation.</p>
            </div>
          ) : (
            threads.map((thread) => {
              const partner = thread.partner;
              return (
                <div 
                  key={thread.matchId}
                  onClick={() => navigate(`/chat/${thread.matchId}`, { state: { partner } })}
                  className="bg-white dark:bg-surface-container rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-container-high transition-all active:scale-[0.98] border border-transparent hover:border-gray-100 dark:hover:border-surface-raised shadow-sm"
                >
                  <div className="relative">
                    <img 
                      src={partner?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(partner?.name || 'User')}&background=DCFD8B&color=151f00`} 
                      alt="Avatar" 
                      className="w-14 h-14 rounded-full object-cover" 
                    />
                    {thread.unread && thread.lastMessageSender !== currentUser?.uid && (
                      <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-success-lime border-2 border-white dark:border-background-deep rounded-full"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-bold text-gray-900 dark:text-on-surface text-base truncate">{partner?.name || 'Study Partner'}</h3>
                      {thread.lastMessageTime && (
                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                          {new Date(thread.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm truncate ${thread.unread && thread.lastMessageSender !== currentUser?.uid ? 'text-gray-900 dark:text-white font-semibold' : 'text-gray-500 dark:text-on-surface-variant'}`}>
                      {thread.lastMessage || 'Say hi!'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
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
        <div className="text-center font-label-md text-gray-400 my-4 text-xs">Today</div>
        
        {messages.map((msg, idx) => {
          const isMine = msg.senderId === currentUser.uid || msg.senderUid === currentUser.uid;
          return (
            <div key={msg.id || msg.messageId || idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 relative group ${
                isMine 
                  ? 'bg-focus-purple text-white rounded-br-sm' 
                  : 'bg-gray-100 dark:bg-surface-container text-gray-900 dark:text-on-surface rounded-bl-sm border border-gray-200 dark:border-surface-raised'
              }`}>
                <p className="font-body-md text-[15px] break-words">{msg.text}</p>
                <div className={`text-[10px] flex items-center justify-end gap-1 mt-1 opacity-70 ${isMine ? 'text-purple-100' : 'text-gray-500'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  {isMine && (
                    msg.status === 'sending' ? <Clock size={10} /> :
                    msg.status === 'read' ? <CheckCheck size={12} className="text-blue-300" /> : <Check size={12} />
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
        <form onSubmit={handleSend} className="flex items-end gap-2 bg-gray-100 dark:bg-surface-container rounded-[24px] p-1 border border-gray-200 dark:border-surface-raised transition-colors focus-within:border-focus-purple dark:focus-within:border-focus-purple">
          <input 
            type="text" 
            value={inputText}
            onChange={handleTyping}
            placeholder="Type a message..." 
            className="flex-1 bg-transparent px-4 py-3 max-h-32 font-body-md text-gray-900 dark:text-on-surface focus:outline-none placeholder:text-gray-500"
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
