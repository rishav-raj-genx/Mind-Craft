import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { gamificationService } from '../services/gamificationService';
import { ArrowLeft, Flame, Shield, Sparkles, BookOpen, X, Trophy, Zap, Crown, Diamond, Sprout, Loader2, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence, animate, useMotionValue, useTransform } from 'framer-motion';

// ─── CountUp Component ────────────────────────────────────────────────────────
const CountUp = ({ to, duration = 1.5 }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);

  useEffect(() => {
    const animation = animate(count, to, { duration, ease: "easeOut" });
    return animation.stop;
  }, [to, duration, count]);

  return <motion.span>{rounded}</motion.span>;
};

// ─── Confetti Particle ────────────────────────────────────────────────────────
const Particle = ({ x, y, color, delay }) => (
  <motion.div
    initial={{ x, y: 0, opacity: 1, scale: 1, rotate: 0 }}
    animate={{ x: x + (Math.random() - 0.5) * 200, y: y + 250 + Math.random() * 100, opacity: 0, scale: 0, rotate: Math.random() * 360 }}
    transition={{ duration: 1.4, delay, ease: 'easeOut' }}
    style={{
      position: 'absolute',
      width: 8, height: 8,
      borderRadius: Math.random() > 0.5 ? '50%' : 2,
      backgroundColor: color,
      top: '40%', left: '50%',
      pointerEvents: 'none',
    }}
  />
);

// ─── Streak Celebration Overlay ───────────────────────────────────────────────
const StreakCelebration = ({ streak, onDismiss }) => {
  const colors = ['#DCFD8B', '#A78BFA', '#FB923C', '#34D399', '#F472B6', '#60A5FA'];
  const particles = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 220,
    y: 0,
    color: colors[i % colors.length],
    delay: Math.random() * 0.4,
  }));

  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
    >
      <div className="relative flex flex-col items-center gap-4 select-none">
        {/* Confetti particles */}
        {particles.map(p => (
          <Particle key={p.id} x={p.x} y={p.y} color={p.color} delay={p.delay} />
        ))}

        {/* Flame burst */}
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: [0, 1.3, 1], rotate: [0, 10, -5, 0] }}
          transition={{ duration: 0.7, ease: 'backOut' }}
          className="text-[80px] leading-none"
        >
          🔥
        </motion.div>

        {/* Streak count */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 15 }}
          className="flex flex-col items-center gap-1"
        >
          <span
            className="font-bold tabular-nums"
            style={{ fontSize: 72, lineHeight: 1, color: '#DCFD8B', textShadow: '0 0 40px rgba(220,253,139,0.7)' }}
          >
            {streak}
          </span>
          <span className="text-white font-semibold text-2xl tracking-wide">Day Streak! 🎉</span>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="text-white/70 text-base text-center max-w-[220px]"
        >
          You're on fire! Keep the momentum going.
        </motion.p>

        {/* Dismiss hint */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          onClick={onDismiss}
          className="mt-2 flex items-center gap-1.5 text-white/50 text-sm hover:text-white/80 transition-colors"
        >
          <X size={14} /> Tap anywhere to dismiss
        </motion.button>
      </div>
    </motion.div>
  );
};

// ─── Badge Icon Mapper ────────────────────────────────────────────────────────
const BadgeIcon = ({ icon, size = 20, className = '' }) => {
  const icons = {
    Sprout: Sprout,
    Zap: Zap,
    Flame: Flame,
    Trophy: Trophy,
    Diamond: Diamond,
    Crown: Crown,
  };
  const IconComp = icons[icon] || Shield;
  return <IconComp size={size} className={className} />;
};

// ─── Earned Badge Card ────────────────────────────────────────────────────────
const EarnedBadge = ({ badge, index }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ delay: 0.3 + index * 0.1, type: 'spring', stiffness: 200, damping: 15 }}
    className="flex flex-col items-center gap-2 p-3 bg-gray-50 dark:bg-surface-raised/50 rounded-2xl border border-gray-200 dark:border-surface-raised"
  >
    <div className="w-12 h-12 rounded-full bg-success-lime/20 flex items-center justify-center">
      <span className="text-2xl">{badge.emoji}</span>
    </div>
    <span className="font-label-md text-label-md text-gray-700 dark:text-on-surface text-center leading-tight">
      {badge.name}
    </span>
    <span className="font-label-md text-label-md text-gray-400 dark:text-on-surface-variant text-xs">
      {badge.days}d
    </span>
  </motion.div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyStreakState = ({ navigate }) => (
  <motion.section
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="bg-white dark:bg-surface-container-low rounded-[24px] p-8 shadow-lg dark:shadow-[0px_10px_30px_rgba(0,0,0,0.3)] flex flex-col items-center text-center relative overflow-hidden transition-colors"
  >
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-gray-200/20 dark:bg-surface-raised/10 rounded-full blur-3xl pointer-events-none" />
    <div className="relative mb-4">
      <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-surface-raised flex flex-col items-center justify-center border-4 border-gray-200 dark:border-surface-raised">
        <Flame size={44} className="text-gray-300 dark:text-on-surface-variant/30" />
      </div>
    </div>
    <h1 className="font-headline-xl text-headline-xl text-gray-900 dark:text-on-surface mb-2 relative z-10">
      Start Your Streak!
    </h1>
    <p className="font-body-md text-body-md text-gray-500 dark:text-on-surface-variant max-w-xs relative z-10">
      Open the app every day to build your streak. Study sessions, forum answers, and daily check-ins all count!
    </p>
    <motion.button
      onClick={() => navigate('/find')}
      whileTap={{ scale: 0.97 }}
      className="mt-6 bg-success-lime text-green-900 font-headline-md text-headline-md rounded-full py-3 px-8 shadow-[0_4px_0_#b3d266] active:translate-y-[2px] active:shadow-[0_2px_0_#b3d266] transition-all flex items-center justify-center gap-2"
    >
      <BookOpen size={20} />
      Start Studying
    </motion.button>
  </motion.section>
);

// ─── Main Page ────────────────────────────────────────────────────────────────
const StreakDetail = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [streakData, setStreakData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);

  const dismissCelebration = useCallback(() => setShowCelebration(false), []);

  useEffect(() => {
    if (!currentUser) return;

    const loadStreak = async () => {
      setLoading(true);
      try {
        // First try check-in (records today's visit)
        let data = null;
        try {
          const checkInRes = await gamificationService.checkIn();
          data = checkInRes.data || checkInRes;
        } catch (_) {
          // Fallback to GET if check-in fails
          const res = await gamificationService.getStreak(currentUser.uid);
          data = res.data || res;
        }

        if (data) {
          setStreakData(data);

          // Show celebration only if streak increased this session
          const lastSeenStreak = parseInt(localStorage.getItem(`streak_seen_${currentUser.uid}`) || '0', 10);
          const currentStreak = data.currentStreak || 0;

          if (currentStreak > 0 && currentStreak > lastSeenStreak) {
            setShowCelebration(true);
            localStorage.setItem(`streak_seen_${currentUser.uid}`, String(currentStreak));
          }
        }
      } catch (err) {
        console.error('Failed to load streak data:', err);
        // Set empty streak data so the page renders with empty state
        setStreakData({
          currentStreak: 0,
          longestStreak: 0,
          activeDates: [],
          badges: { earned: [], next: null, daysToNext: 0, progress: 0 },
          streakFreezes: 2,
          totalActiveDays: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    loadStreak();
  }, [currentUser]);

  // ── Loading State ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        >
          <Loader2 size={32} className="text-success-lime" />
        </motion.div>
        <span className="text-gray-500 dark:text-on-surface-variant font-body-md">Loading streak data…</span>
      </div>
    );
  }

  // ── Extract Data ──────────────────────────────────────────────────
  const currentStreak = streakData?.currentStreak || 0;
  const longestStreak = streakData?.longestStreak || 0;
  const badges = streakData?.badges || { earned: [], next: null, daysToNext: 0, progress: 0 };
  const streakFreezes = streakData?.streakFreezes ?? 2;
  const totalActiveDays = streakData?.totalActiveDays || 0;

  // Generate active days set from streak data
  const activeDateSet = new Set(
    (streakData?.activeDates || []).map(d => {
      if (typeof d === 'string') return d.split('T')[0];
      return new Date(d).toISOString().split('T')[0];
    })
  );

  // Build 35-day contribution grid
  const gridCells = [];
  const todayDate = new Date();

  for (let i = 34; i >= 0; i--) {
    const d = new Date(todayDate);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    gridCells.push({
      dateStr,
      isActive: activeDateSet.has(dateStr),
      isToday: i === 0,
    });
  }

  const activeDaysInGrid = gridCells.filter(c => c.isActive).length;

  // ── Next badge info ───────────────────────────────────────────────
  const nextBadge = badges.next;
  const earnedBadges = badges.earned || [];
  const currentLevel = earnedBadges.length;
  const currentBadge = earnedBadges.length > 0 ? earnedBadges[earnedBadges.length - 1] : null;

  return (
    <>
      {/* Streak Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <StreakCelebration
            streak={currentStreak}
            onDismiss={dismissCelebration}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-6 animate-[fadeIn_0.3s_ease-out]">
        {/* Header */}
        <header className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-container transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-on-surface" />
          </button>
          <h2 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface">Daily Streak</h2>
        </header>

        {/* Empty State or Streak Hero */}
        {currentStreak === 0 && totalActiveDays === 0 ? (
          <EmptyStreakState navigate={navigate} />
        ) : (
          <>
            {/* Streak Hero */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white dark:bg-surface-container-low rounded-[24px] p-8 shadow-lg dark:shadow-[0px_10px_30px_rgba(0,0,0,0.3)] flex flex-col items-center text-center relative overflow-hidden transition-colors"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-success-lime/10 rounded-full blur-3xl pointer-events-none" />

              {/* Streak Flame */}
              <div className="relative mb-4">
                <motion.div
                  animate={currentStreak > 0 ? { scale: [1, 1.07, 1] } : {}}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                  className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 shadow-lg ${
                    currentStreak > 0
                      ? 'bg-orange-100 dark:bg-success-lime/20 border-orange-200 dark:border-success-lime/40 shadow-[0_0_30px_rgba(249,115,22,0.3)] dark:shadow-[0_0_30px_rgba(220,253,139,0.3)]'
                      : 'bg-gray-100 dark:bg-surface-raised border-gray-200 dark:border-surface-raised shadow-none'
                  }`}
                >
                  <Flame
                    size={44}
                    className={currentStreak > 0
                      ? 'text-orange-500 dark:text-success-lime drop-shadow-[0_0_8px_rgba(249,115,22,0.5)] dark:drop-shadow-[0_0_8px_rgba(220,253,139,0.5)]'
                      : 'text-gray-300 dark:text-on-surface-variant/40'
                    }
                  />
                </motion.div>
                {currentStreak > 0 && (
                  <div className="absolute inset-0 rounded-full bg-success-lime/20 animate-[pulse-ring_2s_ease-out_infinite]" />
                )}
              </div>

              <h1 className="font-headline-xl text-headline-xl text-gray-900 dark:text-on-surface mb-2 relative z-10">
                <CountUp to={currentStreak} /> Day Streak{currentStreak !== 1 ? '' : ''}!
              </h1>
              <p className="font-body-md text-body-md text-gray-500 dark:text-on-surface-variant max-w-xs relative z-10">
                {currentStreak > 0
                  ? "You're on fire! Keep studying every day to build your streak and unlock rewards."
                  : 'Your streak has reset. Open the app daily to start a new one!'}
              </p>

              {/* Stats Row */}
              <div className="flex items-center gap-3 mt-4 relative z-10 flex-wrap justify-center">
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-surface-container rounded-full py-2 px-5 border border-gray-200 dark:border-surface-raised">
                  <Sparkles size={16} className="text-focus-purple" />
                  <span className="font-label-lg text-label-lg text-gray-700 dark:text-on-surface">{activeDaysInGrid} Active Days</span>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-surface-container rounded-full py-2 px-5 border border-gray-200 dark:border-surface-raised">
                  <TrendingUp size={16} className="text-orange-500" />
                  <span className="font-label-lg text-label-lg text-gray-700 dark:text-on-surface">Best: {longestStreak}d</span>
                </div>
              </div>
            </motion.section>

            {/* 35-Day Contribution Grid */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-white dark:bg-surface-container-low rounded-[24px] p-6 shadow-lg dark:shadow-[0px_10px_30px_rgba(0,0,0,0.2)] transition-colors"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface">
                  Consistency
                </h3>
                <span className="font-label-md text-label-md text-gray-400 dark:text-on-surface-variant">Last 35 Days</span>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {gridCells.map((cell, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.015, duration: 0.25 }}
                    className={`w-10 h-10 rounded-[8px] flex items-center justify-center transition-all ${
                      cell.isActive
                        ? 'bg-[#DCFD8B] shadow-[0_0_10px_rgba(220,253,139,0.3)]'
                        : cell.isToday
                          ? 'bg-gray-100 dark:bg-surface-raised ring-2 ring-focus-purple'
                          : 'bg-gray-100 dark:bg-surface-raised/50 opacity-60'
                    }`}
                    title={`${cell.dateStr}${cell.isActive ? ' ✓' : ''}${cell.isToday ? ' (Today)' : ''}`}
                  >
                    {cell.isActive && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.015 + 0.15, type: 'spring', stiffness: 300 }}
                      >
                        <Flame size={14} className="text-green-800/60" />
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 mt-4 text-xs font-label-md text-gray-500">
                <span>Less</span>
                <div className="w-3 h-3 rounded-[3px] bg-gray-100 dark:bg-surface-raised/50 opacity-60"></div>
                <div className="w-3 h-3 rounded-[3px] bg-[#DCFD8B]"></div>
                <span>More</span>
              </div>
            </motion.section>

            {/* Earned Badges */}
            {earnedBadges.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="bg-white dark:bg-surface-container-low rounded-[24px] p-6 shadow-lg dark:shadow-[0px_10px_30px_rgba(0,0,0,0.2)] transition-colors"
              >
                <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface mb-4">
                  Badges Earned 🏅
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {earnedBadges.map((badge, i) => (
                    <EarnedBadge key={badge.days} badge={badge} index={i} />
                  ))}
                </div>
              </motion.section>
            )}

            {/* Next Badge Progress */}
            {nextBadge && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="bg-white dark:bg-surface-container-low rounded-[24px] p-6 shadow-lg dark:shadow-[0px_10px_30px_rgba(0,0,0,0.2)] transition-colors flex flex-col items-center text-center gap-4"
              >
                <div className="w-14 h-14 rounded-full bg-success-lime/20 dark:bg-success-lime/10 flex items-center justify-center">
                  <span className="text-3xl">{nextBadge.emoji}</span>
                </div>
                <div>
                  <span className="font-label-md text-label-md text-focus-purple bg-focus-purple/20 px-3 py-1 rounded-full border border-focus-purple/30">
                    Level {currentLevel + 1}
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface">{nextBadge.name}</h3>
                <p className="font-body-sm text-body-sm text-gray-500 dark:text-on-surface-variant">
                  {badges.daysToNext > 0
                    ? `${badges.daysToNext} more day${badges.daysToNext !== 1 ? 's' : ''} to unlock the ${nextBadge.days}-day badge. Keep it up!`
                    : 'Almost there! Keep your streak going!'}
                </p>

                <div className="w-full mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-label-md text-label-md text-gray-500 dark:text-on-surface-variant">
                      {currentStreak} Day{currentStreak !== 1 ? 's' : ''}
                    </span>
                    <span className="font-label-md text-label-md text-gray-500 dark:text-on-surface-variant">
                      {nextBadge.days} Days
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-surface-raised rounded-full h-3 overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-success-lime to-focus-purple rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${badges.progress}%` }}
                      transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </motion.section>
            )}

            {/* All Badges Earned */}
            {!nextBadge && earnedBadges.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="bg-gradient-to-br from-success-lime/20 to-focus-purple/20 dark:from-success-lime/10 dark:to-focus-purple/10 rounded-[24px] p-6 shadow-lg transition-colors flex flex-col items-center text-center gap-3 border border-success-lime/30 dark:border-success-lime/20"
              >
                <span className="text-5xl">👑</span>
                <h3 className="font-headline-md text-headline-md text-gray-900 dark:text-on-surface">Legendary Status!</h3>
                <p className="font-body-sm text-body-sm text-gray-500 dark:text-on-surface-variant">
                  You've earned every badge. You're a true Mindcraft legend!
                </p>
              </motion.section>
            )}

            {/* Streak Freeze */}
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
              className="bg-white dark:bg-surface-container-low rounded-[24px] p-5 shadow-sm dark:shadow-[0px_4px_15px_rgba(0,0,0,0.1)] transition-colors flex items-center gap-4 border border-gray-200 dark:border-surface-raised"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Shield size={24} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-body-lg text-body-lg text-gray-900 dark:text-on-surface font-semibold">Streak Freeze</h4>
                <p className="font-body-sm text-body-sm text-gray-500 dark:text-on-surface-variant">Protects your streak if you miss a day.</p>
              </div>
              <span className="bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full font-label-md text-label-md border border-blue-200 dark:border-blue-500/30">
                {streakFreezes} left
              </span>
            </motion.section>
          </>
        )}

        {/* Start Studying CTA */}
        <section className="pb-28">
          <motion.button
            onClick={() => navigate('/find')}
            whileTap={{ scale: 0.97 }}
            className="w-full bg-success-lime text-green-900 font-headline-md text-headline-md rounded-full py-4 shadow-[0_4px_0_#b3d266] active:translate-y-[2px] active:shadow-[0_2px_0_#b3d266] transition-all flex items-center justify-center gap-2"
          >
            <BookOpen size={22} />
            Start Studying Now
          </motion.button>
        </section>
      </div>
    </>
  );
};

export default StreakDetail;
