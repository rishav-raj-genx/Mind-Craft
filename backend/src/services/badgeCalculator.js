const { prisma } = require('../config/prisma');
const { calculateStreak } = require('./streakCalculator');

const BADGE_DEFINITIONS = [
  { id: 'streak_champion', name: 'Streak Champion', emoji: '🔥', description: 'Maintain a daily streak', metric: 'longestStreak', thresholds: [3, 7, 14, 30], color: 'from-orange-500/20 to-orange-400/10', borderColor: 'border-orange-400/30', iconColor: 'text-orange-500' },
  { id: 'session_pro', name: 'Session Pro', emoji: '📚', description: 'Complete tutoring sessions', metric: 'totalSessions', thresholds: [5, 15, 50], color: 'from-green-500/20 to-success-lime/10', borderColor: 'border-success-lime/30', iconColor: 'text-success-lime' },
  { id: 'dsa_master', name: 'DSA Master', emoji: '💻', description: 'DSA-related sessions', metric: 'dsaSessions', thresholds: [3, 10, 25], color: 'from-green-500/20 to-success-lime/10', borderColor: 'border-success-lime/30', iconColor: 'text-green-600' },
  { id: 'late_night_learner', name: 'Late Night Learner', emoji: '🌙', description: 'Sessions after midnight', metric: 'lateNightSessions', thresholds: [1, 5, 15], color: 'from-purple-500/20 to-focus-purple/10', borderColor: 'border-focus-purple/30', iconColor: 'text-focus-purple' },
  { id: 'problem_solver', name: 'Problem Solver', emoji: '🐛', description: 'Answer doubts in the forum', metric: 'doubtsAnswered', thresholds: [3, 10, 25], color: 'from-orange-500/20 to-orange-400/10', borderColor: 'border-orange-400/30', iconColor: 'text-orange-500' },
  { id: 'mentor', name: 'Mentor', emoji: '🎓', description: 'Teach sessions as a tutor', metric: 'sessionsTaught', thresholds: [3, 10, 30], color: 'from-blue-500/20 to-blue-400/10', borderColor: 'border-blue-400/30', iconColor: 'text-blue-600' },
  { id: 'top_rated', name: 'Top Rated', emoji: '⭐', description: 'Earn high ratings (avg ≥ 4.0)', metric: 'ratedSessions', thresholds: [5, 15, 30], color: 'from-yellow-500/20 to-yellow-400/10', borderColor: 'border-yellow-400/30', iconColor: 'text-yellow-500' },
  { id: 'social_butterfly', name: 'Social Butterfly', emoji: '🤝', description: 'Study with unique mates', metric: 'uniqueMates', thresholds: [3, 10, 25], color: 'from-pink-500/20 to-pink-400/10', borderColor: 'border-pink-400/30', iconColor: 'text-pink-500' },
  { id: 'wealthy_mind', name: 'Wealthy Mind', emoji: '🪙', description: 'Accumulate Mind Tokens', metric: 'mindTokens', thresholds: [100, 500, 1000], color: 'from-yellow-500/20 to-yellow-400/10', borderColor: 'border-yellow-400/30', iconColor: 'text-yellow-500' },
  { id: 'weekly_warrior', name: 'Weekly Warrior', emoji: '⚡', description: 'Maintained a perfect 7-day study streak this week', metric: 'weeklyWarriorCount', thresholds: [1, 4, 12], color: 'from-amber-500/20 to-yellow-400/10', borderColor: 'border-amber-400/30', iconColor: 'text-amber-500' },
  { id: 'spark_starter', name: 'Spark Starter', emoji: '🌱', description: 'Achieved a 3-day daily consistency streak', metric: 'longestStreak', thresholds: [3], color: 'from-emerald-500/20 to-green-400/10', borderColor: 'border-emerald-400/30', iconColor: 'text-emerald-500' },
  { id: '7_day_streak', name: '7-Day Streak', emoji: '🔥', description: 'Achieved a consecutive 7-day study streak', metric: 'longestStreak', thresholds: [7], color: 'from-orange-500/20 to-red-400/10', borderColor: 'border-orange-400/30', iconColor: 'text-orange-500' },
  { id: 'fortnight_focus', name: 'Fortnight Focus', emoji: '🔥', description: 'Achieved a 14-day study streak', metric: 'longestStreak', thresholds: [14], color: 'from-red-500/20 to-orange-400/10', borderColor: 'border-red-400/30', iconColor: 'text-red-500' },
  { id: 'monthly_master', name: 'Monthly Master', emoji: '🏆', description: 'Achieved a 30-day consistency streak', metric: 'longestStreak', thresholds: [30], color: 'from-yellow-500/20 to-amber-400/10', borderColor: 'border-yellow-400/30', iconColor: 'text-yellow-500' },
  { id: 'discipline_king', name: 'Discipline King', emoji: '💎', description: 'Achieved a 60-day consistency streak', metric: 'longestStreak', thresholds: [60], color: 'from-cyan-500/20 to-blue-400/10', borderColor: 'border-cyan-400/30', iconColor: 'text-cyan-500' },
  { id: 'century_legend', name: 'Century Legend', emoji: '👑', description: 'Achieved an epic 100-day consistency streak', metric: 'longestStreak', thresholds: [100], color: 'from-purple-500/20 to-yellow-400/10', borderColor: 'border-purple-400/30', iconColor: 'text-purple-500' },
  { id: 'master_tutor', name: 'Master Tutor', emoji: '🎖️', description: 'Recognized master tutor with exceptional feedback across sessions', metric: 'sessionsTaught', thresholds: [10, 25, 50], color: 'from-indigo-500/20 to-purple-400/10', borderColor: 'border-indigo-400/30', iconColor: 'text-indigo-500' },
];

const { resolveUser } = require('../utils/userResolver');

function computeBadge(definition, metrics) {
  const { id, name, emoji, description, metric, thresholds, color, borderColor, iconColor } = definition;
  const currentValue = metrics[metric] || 0;
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (currentValue >= thresholds[i]) level = i + 1;
  }
  const maxLevel = thresholds.length;
  const isMaxed = level >= maxLevel;
  const nextThreshold = isMaxed ? thresholds[maxLevel - 1] : thresholds[level];
  const prevThreshold = level > 0 ? thresholds[level - 1] : 0;
  const progress = isMaxed
    ? 100
    : (nextThreshold - prevThreshold > 0
      ? Math.max(0, Math.min(100, Math.round(((currentValue - prevThreshold) / (nextThreshold - prevThreshold)) * 100)))
      : 0);

  return {
    id,
    name,
    emoji,
    description,
    level,
    maxLevel,
    isMaxed,
    currentValue,
    nextThreshold,
    prevThreshold,
    progress,
    color,
    borderColor,
    iconColor,
    progressLabel: `${currentValue}/${nextThreshold}`,
  };
}

async function calculateBadges(uid, { persist = true } = {}) {
  const user = await resolveUser(uid);
  if (!user) {
    const defaultMetrics = {
      currentStreak: 0,
      longestStreak: 0,
      totalSessions: 0,
      dsaSessions: 0,
      lateNightSessions: 0,
      sessionsTaught: 0,
      ratedSessions: 0,
      averageRating: 0,
      uniqueMates: 0,
      doubtsAnswered: 0,
      mindTokens: 0,
      weeklyWarriorCount: 0,
    };
    const defaultBadges = BADGE_DEFINITIONS.map(def => computeBadge(def, defaultMetrics));
    return {
      badges: defaultBadges,
      totalEarned: 0,
      totalSessions: 0,
      sessionHistory: [],
      badgeHistory: [],
      metrics: defaultMetrics,
    };
  }

  const [sessionMetrics, doubtsAnswered, streakData, initialBadgeHistory] = await Promise.all([
    getSessionMetrics(user.id),
    prisma.doubtAnswer.count({ where: { authorId: user.id, deletedAt: null } }),
    calculateStreak(user.clerkUserId).catch(() => ({ currentStreak: user.currentStreak, longestStreak: user.longestStreak })),
    getBadgeHistory(user.id),
  ]);

  const weeklyWarriorCount = initialBadgeHistory.filter(h => h.badgeId === 'weekly_warrior').length;

  const metrics = {
    currentStreak: streakData.currentStreak || 0,
    longestStreak: Math.max(streakData.longestStreak || 0, user.longestStreak || 0),
    totalSessions: sessionMetrics.totalSessions,
    dsaSessions: sessionMetrics.dsaSessions,
    lateNightSessions: sessionMetrics.lateNightSessions,
    sessionsTaught: sessionMetrics.sessionsTaught,
    ratedSessions: sessionMetrics.ratedSessions,
    averageRating: Number(user.averageRating) || 0,
    uniqueMates: sessionMetrics.uniqueMates,
    doubtsAnswered,
    mindTokens: user.mindTokens || 0,
    weeklyWarriorCount,
  };

  const badges = BADGE_DEFINITIONS.map(def => computeBadge(def, metrics));

  // Persist newly unlocked badges or level-ups into UserBadge
  const recordedLevels = new Map();
  for (const entry of initialBadgeHistory) {
    const prev = recordedLevels.get(entry.badgeId) || 0;
    if ((entry.level || 1) > prev) {
      recordedLevels.set(entry.badgeId, entry.level || 1);
    }
  }

  let didRecord = false;
  if (persist) {
    for (const badge of badges) {
      if (badge.level > 0) {
        const recordedLevel = recordedLevels.get(badge.id) || 0;
        if (badge.level > recordedLevel) {
          const ok = await recordBadgeEarned(user.clerkUserId || uid, badge.id, badge.name, badge.level);
          if (ok) didRecord = true;
        }
      }
    }
  }

  const badgeHistory = didRecord ? await getBadgeHistory(user.id) : initialBadgeHistory;
  const totalEarned = badges.filter(b => b.level > 0).length;

  return {
    badges,
    totalEarned,
    totalSessions: metrics.totalSessions,
    sessionHistory: sessionMetrics.recentSessions,
    badgeHistory,
    metrics,
  };
}

async function getSessionMetrics(userId) {
  const sessions = await prisma.tutoringSession.findMany({
    where: {
      OR: [{ teacherId: userId }, { learnerId: userId }],
      status: 'COMPLETED',
    },
    orderBy: { scheduledFor: 'desc' },
  });

  const teacherSessions = sessions.filter(s => s.teacherId === userId);
  const learnerSessions = sessions.filter(s => s.learnerId === userId);

  const dsaKeywords = ['dsa', 'data structure', 'algorithm', 'data structures'];
  const dsaSessions = sessions.filter(s => s.title && dsaKeywords.some(k => s.title.toLowerCase().includes(k))).length;

  const lateNightSessions = sessions.filter(s => {
    if (!s.scheduledFor) return false;
    const hour = new Date(s.scheduledFor).getUTCHours();
    return hour >= 0 && hour < 5;
  }).length;

  const mateSet = new Set();
  teacherSessions.forEach(s => mateSet.add(s.learnerId));
  learnerSessions.forEach(s => mateSet.add(s.teacherId));

  let ratedSessionsCount = 0;
  const recentSessions = sessions.slice(0, 20).map(s => {
    let sessionRating = 0;
    if (s.completionKey) {
      try {
        const parsed = JSON.parse(s.completionKey);
        const isTeacher = s.teacherId === userId;
        const entry = isTeacher
          ? (parsed[`learner_${s.learnerId}`] || (parsed.rating ? { rating: parsed.rating } : null))
          : parsed[`teacher_${s.teacherId}`];
        sessionRating = Number(entry?.rating) || 0;
        if (sessionRating > 0) ratedSessionsCount += 1;
      } catch (_e) {
        sessionRating = 0;
      }
    }
    return {
      sessionId: s.id,
      skill: s.title || 'General',
      scheduledAt: s.scheduledFor ? new Date(s.scheduledFor).getTime() : 0,
      mode: s.mode === 'IN_PERSON' ? 'In-Person' : 'Online',
      rating: sessionRating,
      role: s.teacherId === userId ? 'teacher' : 'learner',
    };
  });

  return {
    totalSessions: sessions.length,
    sessionsTaught: teacherSessions.length,
    dsaSessions,
    lateNightSessions,
    ratedSessions: ratedSessionsCount,
    uniqueMates: mateSet.size,
    recentSessions,
  };
}

async function getBadgeHistory(userId) {
  const userBadges = await prisma.userBadge.findMany({
    where: { userId },
    include: { badge: true },
    orderBy: { awardedAt: 'desc' },
    take: 20,
  });

  return userBadges.map(ub => ({
    id: `${ub.badgeId}_${ub.auditWeek}`,
    badgeId: ub.badgeId,
    badgeName: ub.badge?.name || ub.badgeId,
    level: ub.metadata?.level || ub.badge?.level || 1,
    earnedAt: ub.awardedAt ? new Date(ub.awardedAt).toISOString() : new Date().toISOString(),
  }));
}

async function recordBadgeEarned(uid, badgeId, badgeName, level = 1) {
  const user = await resolveUser(uid);
  if (!user) return false;

  try {
    const def = BADGE_DEFINITIONS.find(b => b.id === badgeId);
    await prisma.badge.upsert({
      where: { id: badgeId },
      update: {
        name: badgeName,
        level,
        ...(def?.emoji ? { emoji: def.emoji } : {}),
        ...(def?.description ? { description: def.description } : {}),
      },
      create: {
        id: badgeId,
        name: badgeName,
        level,
        emoji: def?.emoji || null,
        description: def?.description || null,
      },
    });

    const auditWeek = `manual_${new Date().toISOString().slice(0, 10)}_lv${level}`;
    await prisma.userBadge.upsert({
      where: { userId_badgeId_auditWeek: { userId: user.id, badgeId, auditWeek } },
      update: { metadata: { level } },
      create: { userId: user.id, badgeId, auditWeek, metadata: { level } },
    });
    return true;
  } catch (_err) {
    return false;
  }
}

module.exports = {
  calculateBadges,
  recordBadgeEarned,
  getBadgeHistory,
  computeBadge,
  BADGE_DEFINITIONS,
};
