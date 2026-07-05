import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sessionService } from '../services/sessionService';
import { ArrowLeft, Calendar, Clock, MapPin, Video, User, CheckCircle, XCircle, CalendarPlus, ExternalLink, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import RatingModal from '../components/RatingModal';

const timeAgo = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const timeStr = (ts) => {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

// ─── Add to Calendar Button ────────────────────────────────────────────────────
const AddToCalendarBtn = ({ session }) => {
  const [added, setAdded] = useState(false);

  const handleAdd = async () => {
    try {
      setAdded(true);
      const response = await sessionService.exportToCalendar(session.sessionId, {});
      if (response.success && response.data && response.data.htmlLink) {
        window.open(response.data.htmlLink, '_blank', 'noopener,noreferrer');
      } else {
        alert('Failed to get calendar link from backend.');
      }
    } catch (err) {
      console.error('Error fetching calendar link:', err);
      alert('Failed to get calendar link from backend.');
    } finally {
      setTimeout(() => setAdded(false), 3000);
    }
  };

  return (
    <motion.button
      onClick={handleAdd}
      whileTap={{ scale: 0.94 }}
      className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
        added
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700'
          : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/40'
      }`}
    >
      {added ? (
        <>
          <CheckCircle size={13} />
          Opening Calendar...
        </>
      ) : (
        <>
          <CalendarPlus size={13} />
          Add to Calendar
          <ExternalLink size={11} className="opacity-60" />
        </>
      )}
    </motion.button>
  );
};

// ─── Session Card ──────────────────────────────────────────────────────────────
const SessionCard = ({ session: s, index, currentUserId, onRateClick }) => {
  const isTeacher = s.teacherUid === currentUserId;

  const statusColors = {
    upcoming: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
    completed: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700',
    cancelled: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
  };

  const statusIcons = {
    upcoming: <Clock size={14} />,
    completed: <CheckCircle size={14} />,
    cancelled: <XCircle size={14} />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, type: 'spring', stiffness: 260, damping: 22 }}
      className="bg-white dark:bg-[#1C1C2E] rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm"
    >
      {/* Top row: role + skill + status badge */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#7C3AED]/10 flex items-center justify-center">
            <User size={16} className="text-[#7C3AED]" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white">
              {isTeacher ? 'Teaching' : 'Learning'} — {s.skill}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.mode}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors[s.status] || statusColors.upcoming}`}>
          {statusIcons[s.status]} {s.status}
        </span>
      </div>

      {/* Date + time + join link */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <Calendar size={14} />
          <span>{timeAgo(s.scheduledAt)}</span>
        </div>
        {s.scheduledAt && (
          <div className="flex items-center gap-1">
            <Clock size={14} />
            <span>{timeStr(s.scheduledAt)} - {timeStr(s.scheduledAt + (s.duration || 60) * 60000)}</span>
          </div>
        )}
        {s.mode === 'Online' && s.meetLink && (
          <div className="flex items-center gap-1">
            <Video size={14} className="text-blue-500" />
            <a href={s.meetLink} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Join</a>
          </div>
        )}
        {s.mode === 'In-Person' && s.location && (
          <div className="flex items-center gap-1">
            <MapPin size={14} />
            <span>{s.location}</span>
          </div>
        )}
      </div>

      {/* Rating */}
      {s.rating > 0 ? (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-1 text-amber-500 text-sm font-semibold">
            {'★'.repeat(Math.round(s.rating))}{'☆'.repeat(5 - Math.round(s.rating))}
            <span className="text-gray-500 dark:text-gray-400 ml-1">{s.rating.toFixed(1)}</span>
          </div>
          {s.ratingComment && (
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 italic">"{s.ratingComment}"</p>
          )}
        </div>
      ) : (
        s.status === 'completed' && !isTeacher && (
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => onRateClick(s.sessionId)}
              className="flex items-center gap-2 text-sm font-semibold text-[#7C3AED] dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
              <Star size={16} /> Rate Tutor
            </button>
          </div>
        )
      )}

      {/* Add to Calendar — only for upcoming sessions */}
      {s.status === 'upcoming' && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Don't miss this session!
          </span>
          <AddToCalendarBtn session={s} />
        </div>
      )}
    </motion.div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
const SessionsDetail = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialFilter = searchParams.get('tab') || 'all';

  const [filter, setFilter] = useState(initialFilter);
  const [ratingSessionId, setRatingSessionId] = useState(null);

  useEffect(() => {
    if (currentUser) {
      const status = filter === 'all' ? null : filter;
      setLoading(true);
      sessionService.getSessions(currentUser.uid, status)
        .then(res => setSessions(res.data || []))
        .catch(err => console.error('Sessions fetch error', err))
        .finally(() => setLoading(false));
    }
  }, [currentUser, filter]);

  const handleRateSession = async (sessionId, rating, comment) => {
    try {
      await sessionService.rate(sessionId, rating, comment);
      setSessions((prev) =>
        prev.map((s) => (s.sessionId === sessionId ? { ...s, rating, ratingComment: comment } : s))
      );
    } catch (err) {
      console.error('Failed to rate session', err);
      alert('Failed to rate session. ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
      <header className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ArrowLeft size={20} className="text-gray-700 dark:text-white" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Sessions</h1>
      </header>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar">
        {['all', 'upcoming', 'completed', 'cancelled'].map(f => (
          <motion.button
            key={f}
            onClick={() => { setFilter(f); setLoading(true); }}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 rounded-full text-sm font-semibold capitalize whitespace-nowrap border transition-all ${
              filter === f
                ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
            }`}
          >
            {f === 'all' ? 'All Sessions' : f}
          </motion.button>
        ))}
      </div>

      {filter === 'completed' && !loading && sessions.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="bg-gradient-to-r from-[#DCFD8B] to-[#b3d266] rounded-2xl p-5 shadow-[0_4px_20px_rgba(220,253,139,0.3)] flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4 w-full">
            <div className="w-12 h-12 bg-black/10 rounded-full flex items-center justify-center shrink-0">
              <Clock size={24} className="text-[#151f00]" />
            </div>
            <div className="flex-1 text-left">
              <h3 className="font-bold text-[#151f00] text-lg leading-tight">Great Work!</h3>
              <p className="text-[#151f00]/80 text-sm font-semibold">You've spent a total of <span className="font-black text-[#151f00] text-base">{+(sessions.reduce((acc, s) => acc + (s.duration || 60), 0) / 60).toFixed(1)} hours</span> learning and teaching.</p>
            </div>
          </div>
          <Star size={40} className="text-[#151f00]/20 absolute right-4 bottom-4" />
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-[#DCFD8B] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Calendar size={48} className="text-gray-300 dark:text-gray-700 mb-4" />
          <p className="font-semibold text-gray-600 dark:text-gray-400">No sessions found</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Book a session with a mate to get started!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pb-32">
          {sessions.map((s, idx) => (
            <SessionCard
              key={s.sessionId || idx}
              session={s}
              index={idx}
              currentUserId={currentUser?.uid}
              onRateClick={setRatingSessionId}
            />
          ))}
        </div>
      )}
      
      <RatingModal
        isOpen={!!ratingSessionId}
        onClose={() => setRatingSessionId(null)}
        onSubmit={handleRateSession}
        sessionId={ratingSessionId}
      />
    </div>
  );
};

export default SessionsDetail;
