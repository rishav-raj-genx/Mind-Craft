import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { gamificationService } from '../services/gamificationService';
import {
  ArrowLeft, Flame, Code, Moon, Bug, BookOpen, GraduationCap,
  Trophy, Star, Users, Loader2, ChevronDown, ChevronUp, Clock, Coins,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Badge Icon Mapper ────────────────────────────────────────────────────────
const BADGE_ICONS = {
  streak_champion: Flame,
  session_pro: BookOpen,
  dsa_master: Code,
  late_night_learner: Moon,
  problem_solver: Bug,
  mentor: GraduationCap,
  top_rated: Star,
  social_butterfly: Users,
  wealthy_mind: Coins,
};

// ─── Badge unlock shimmer overlay ─────────────────────────────────────────────
const ShimmerBadge = ({ level }) =>
  level > 0 ? (
    <motion.span
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 12 }}
      className="absolute -top-2 -right-2 bg-success-lime text-green-900 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-[0_0_12px_rgba(220,253,139,0.5)] border border-success-lime/60 uppercase tracking-wide"
    >
      Lv.{level}
    </motion.span>
  ) : null;

// ─── Badge card animation variants ─────────────────────────────────────────────
const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.93 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: {
      delay: i * 0.08,
      duration: 0.45,
      type: 'spring',
      stiffness: 280,
      damping: 22,
    },
  }),
};

// ─── Progress bar animation ────────────────────────────────────────────────────
const AnimatedProgressBar = ({ progress, delay = 0 }) => (
  <div className="w-full bg-gray-200 dark:bg-surface-raised rounded-full h-2.5 overflow-hidden">
    <motion.div
      className="h-full rounded-full bg-gradient-to-r from-success-lime to-focus-purple"
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      transition={{ duration: 0.8, delay, ease: 'easeOut' }}
    />
  </div>
);

// ─── Format session timestamp ──────────────────────────────────────────────────
const formatDate = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ─── Session History Panel ─────────────────────────────────────────────────────
const SessionHistoryPanel = ({ sessions, onClose }) => (
  <motion.div
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: 'auto' }}
    exit={{ opacity: 0, height: 0 }}
    transition={{ duration: 0.3 }}
    className="overflow-hidden"
  >
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-surface-raised">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-label-lg text-label-lg text-gray-700 dark:text-on-surface">Session History</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-on-surface-variant">
          <ChevronUp size={16} />
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className="font-body-sm text-body-sm text-gray-400 dark:text-on-surface-variant italic">No sessions yet. Start studying to earn this badge!</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
          {sessions.map((s, i) => (
            <div key={i} className="flex items-center gap-3 py-2 px-3 bg-gray-50 dark:bg-surface-raised/50 rounded-xl">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                s.role === 'teacher' ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-green-100 dark:bg-green-500/20'
              }`}>
                {s.role === 'teacher'
                  ? <GraduationCap size={14} className="text-blue-600 dark:text-blue-400" />
                  : <BookOpen size={14} className="text-green-600 dark:text-green-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-body-sm text-body-sm text-gray-800 dark:text-on-surface truncate block">{s.skill}</span>
                <span className="font-label-md text-[10px] text-gray-400 dark:text-on-surface-variant">{formatDate(s.scheduledAt)} · {s.mode}</span>
              </div>
              {s.rating > 0 && (
                <div className="flex items-center gap-1">
                  <Star size={12} className="text-yellow-500 fill-yellow-500" />
                  <span className="font-label-md text-[11px] text-gray-600 dark:text-on-surface-variant">{s.rating}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  </motion.div>
);

// ─── Badge History Panel ───────────────────────────────────────────────────────
const BadgeHistoryPanel = ({ history, onClose }) => (
  <motion.div
    initial={{ opacity: 0, height: 0 }}
    animate={{ opacity: 1, height: 'auto' }}
    exit={{ opacity: 0, height: 0 }}
    transition={{ duration: 0.3 }}
    className="overflow-hidden"
  >
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-surface-raised">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-label-lg text-label-lg text-gray-700 dark:text-on-surface">Badges Earned</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-on-surface-variant">
          <ChevronUp size={16} />
        </button>
      </div>
      {history.length === 0 ? (
        <p className="font-body-sm text-body-sm text-gray-400 dark:text-on-surface-variant italic">No badges earned yet. Keep going!</p>
      ) : (
        <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
          {history.map((h, i) => (
            <div key={i} className="flex items-center gap-3 py-2 px-3 bg-gray-50 dark:bg-surface-raised/50 rounded-xl">
              <Trophy size={14} className="text-focus-purple flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="font-body-sm text-body-sm text-gray-800 dark:text-on-surface truncate block">
                  {h.badgeName} — Level {h.level}
                </span>
                <span className="font-label-md text-[10px] text-gray-400 dark:text-on-surface-variant">
                  {h.earnedAt ? formatDate(new Date(h.earnedAt).getTime()) : 'Just now'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </motion.div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const BadgeProgress = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [badgeData, setBadgeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedBadge, setExpandedBadge] = useState(null);
  const [showSessions, setShowSessions] = useState(false);
  const [showBadgeHistory, setShowBadgeHistory] = useState(false);

  useEffect(() => {
    if (!currentUser) return;

    const loadBadges = async () => {
      setLoading(true);
      try {
        const res = await gamificationService.getBadges(currentUser.uid);
        setBadgeData(res.data || res);
      } catch (err) {
        console.error('Failed to load badges:', err);
        setBadgeData({
          badges: [],
          totalEarned: 0,
          totalSessions: 0,
          sessionHistory: [],
          badgeHistory: [],
        });
      } finally {
        setLoading(false);
      }
    };

    loadBadges();
  }, [currentUser]);

  // ── Loading State ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader2 size={32} className="text-focus-purple" />
        </motion.div>
        <span className="text-gray-500 dark:text-on-surface-variant font-body-md">Loading badges…</span>
      </div>
    );
  }

  const badges = badgeData?.badges || [];
  const totalEarned = badgeData?.totalEarned || 0;
  const totalSessions = badgeData?.totalSessions || 0;
  const sessionHistory = badgeData?.sessionHistory || [];
  const badgeHistory = badgeData?.badgeHistory || [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-container transition-colors">
          <ArrowLeft size={20} className="text-gray-700 dark:text-on-surface" />
        </button>
        <h2 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface">Your Badges</h2>
      </header>

      {/* Hero Stats */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white dark:bg-surface-container-low rounded-[24px] p-8 shadow-lg dark:shadow-[0px_10px_30px_rgba(0,0,0,0.3)] transition-colors relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-focus-purple/10 rounded-full blur-3xl pointer-events-none" />

        <h2 className="font-headline-lg text-headline-lg text-gray-900 dark:text-on-surface mb-2">My Progress</h2>
        <p className="font-body-md text-body-md text-gray-500 dark:text-on-surface-variant mb-6">Keep up the momentum to unlock your next badge.</p>

        <div className="grid grid-cols-2 gap-4">
          {/* Sessions Attended — tappable */}
          <motion.button
            onClick={() => { setShowSessions(!showSessions); setShowBadgeHistory(false); }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 20 }}
            className="bg-gray-50 dark:bg-surface-container rounded-2xl p-5 flex flex-col items-center justify-center gap-2 border border-gray-200 dark:border-surface-raised hover:bg-gray-100 dark:hover:bg-surface-container-high transition-colors"
          >
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="font-headline-lg text-[36px] font-bold text-green-700 dark:text-success-lime tabular-nums"
            >
              {totalSessions}
            </motion.span>
            <span className="font-label-md text-label-md text-gray-500 dark:text-on-surface-variant uppercase tracking-wider text-center">Sessions</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${showSessions ? 'rotate-180' : ''}`} />
          </motion.button>

          {/* Badges Earned — tappable */}
          <motion.button
            onClick={() => { setShowBadgeHistory(!showBadgeHistory); setShowSessions(false); }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.18, type: 'spring', stiffness: 300, damping: 20 }}
            className="bg-gray-50 dark:bg-surface-container rounded-2xl p-5 flex flex-col items-center justify-center gap-2 border border-gray-200 dark:border-surface-raised hover:bg-gray-100 dark:hover:bg-surface-container-high transition-colors"
          >
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.38 }}
              className="font-headline-lg text-[36px] font-bold text-focus-purple tabular-nums"
            >
              {totalEarned}
            </motion.span>
            <span className="font-label-md text-label-md text-gray-500 dark:text-on-surface-variant uppercase tracking-wider text-center">Badges Earned</span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${showBadgeHistory ? 'rotate-180' : ''}`} />
          </motion.button>
        </div>

        {/* Expandable Session History */}
        <AnimatePresence>
          {showSessions && (
            <SessionHistoryPanel sessions={sessionHistory} onClose={() => setShowSessions(false)} />
          )}
        </AnimatePresence>

        {/* Expandable Badge History */}
        <AnimatePresence>
          {showBadgeHistory && (
            <BadgeHistoryPanel history={badgeHistory} onClose={() => setShowBadgeHistory(false)} />
          )}
        </AnimatePresence>
      </motion.section>

      {/* Badge List */}
      <section className="flex flex-col gap-3 pb-24">
        <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface mb-2">All Badges</h3>

        {badges.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-on-surface-variant">
            <Trophy size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-body-md">No badge data available yet.</p>
          </div>
        ) : (
          badges.map((badge, idx) => {
            const IconComp = BADGE_ICONS[badge.id] || Trophy;
            const isExpanded = expandedBadge === badge.id;

            return (
              <motion.div
                key={badge.id}
                custom={idx}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                whileHover={{ scale: 1.015, boxShadow: '0 8px 30px rgba(0,0,0,0.10)' }}
                onClick={() => setExpandedBadge(isExpanded ? null : badge.id)}
                className="bg-white dark:bg-surface-container rounded-2xl p-5 border border-gray-200 dark:border-surface-raised shadow-sm cursor-pointer relative"
              >
                {/* Level shimmer badge */}
                <ShimmerBadge level={badge.level} />

                <div className="flex items-center gap-4">
                  {/* Badge Icon */}
                  <motion.div
                    whileHover={{ rotate: [0, -8, 8, -4, 0] }}
                    transition={{ duration: 0.5 }}
                    className={`w-14 h-14 rounded-xl bg-gradient-to-br ${badge.color} flex items-center justify-center border ${badge.borderColor} flex-shrink-0`}
                  >
                    <span className="text-2xl">{badge.emoji}</span>
                  </motion.div>

                  {/* Badge Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-body-lg text-body-lg text-gray-900 dark:text-on-surface font-bold truncate">{badge.name}</h4>
                      {badge.isMaxed && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.08 + 0.3, type: 'spring' }}
                          className="bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded-full font-label-md text-[10px] border border-yellow-300 dark:border-yellow-500/30 flex-shrink-0"
                        >
                          MAX ✨
                        </motion.span>
                      )}
                    </div>
                    <p className="font-body-sm text-body-sm text-gray-500 dark:text-on-surface-variant truncate">{badge.description}</p>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-label-md text-label-md text-gray-500 dark:text-on-surface-variant">{badge.progressLabel}</span>
                        <span className="font-label-md text-label-md text-gray-400 dark:text-on-surface-variant">
                          Level {badge.level}/{badge.maxLevel}
                        </span>
                      </div>
                      <AnimatedProgressBar progress={badge.progress} delay={idx * 0.08 + 0.25} />
                    </div>
                  </div>
                </div>

                {/* Expanded Detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-surface-raised flex flex-col gap-2">
                        <div className="flex justify-between">
                          <span className="font-body-sm text-body-sm text-gray-500 dark:text-on-surface-variant">Current</span>
                          <span className="font-body-sm text-body-sm text-gray-800 dark:text-on-surface font-semibold">{badge.currentValue}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-body-sm text-body-sm text-gray-500 dark:text-on-surface-variant">Next Unlock</span>
                          <span className="font-body-sm text-body-sm text-gray-800 dark:text-on-surface font-semibold">
                            {badge.isMaxed ? 'All levels earned!' : `${badge.nextThreshold} needed`}
                          </span>
                        </div>
                        {badge.level > 0 && (
                          <div className="flex justify-between">
                            <span className="font-body-sm text-body-sm text-gray-500 dark:text-on-surface-variant">Status</span>
                            <span className="font-body-sm text-body-sm text-success-lime font-semibold">Earned ✓</span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </section>
    </div>
  );
};

export default BadgeProgress;
