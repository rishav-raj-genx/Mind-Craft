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
];

async function findUser(uid) {
  if (!uid) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uid);
  return prisma.user.findFirst({
    where: {
      OR: [
        { clerkUserId: uid },
        ...(isUuid ? [{ id: uid }] : []),
      ],
      deletedAt: null,
    },
  });
}

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

async function calculateBadges(uid) {
  const user = await findUser(uid);
  if (!user) {
    throw Object.assign(new Error(`User ${uid} not found`), { statusCode: 404 });
  }

  const [sessionMetrics, doubtsAnswered, streakData, badgeHistory] = await Promise.all([
    getSessionMetrics(user.id),
    prisma.doubtAnswer.count({ where: { authorId: user.id, deletedAt: null } }),
    calculateStreak(user.clerkUserId).catch(() => ({ currentStreak: user.currentStreak, longestStreak: user.longestStreak })),
    getBadgeHistory(user.id),
  ]);

  const metrics = {
    currentStreak: streakData.currentStreak || 0,
    longestStreak: streakData.longestStreak || 0,
    totalSessions: sessionMetrics.totalSessions,
    dsaSessions: sessionMetrics.dsaSessions,
    lateNightSessions: sessionMetrics.lateNightSessions,
    sessionsTaught: sessionMetrics.sessionsTaught,
    ratedSessions: sessionMetrics.ratedSessions,
    averageRating: Number(user.averageRating) || 0,
    uniqueMates: sessionMetrics.uniqueMates,
    doubtsAnswered,
    mindTokens: user.mindTokens || 0,
  };

  const badges = BADGE_DEFINITIONS.map(def => computeBadge(def, metrics));
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

  const recentSessions = sessions.slice(0, 20).map(s => ({
    sessionId: s.id,
    skill: s.title || 'General',
    scheduledAt: s.scheduledFor ? new Date(s.scheduledFor).getTime() : 0,
    mode: s.mode === 'IN_PERSON' ? 'In-Person' : 'Online',
    rating: 5,
    role: s.teacherId === userId ? 'teacher' : 'learner',
  }));

  return {
    totalSessions: sessions.length,
    sessionsTaught: teacherSessions.length,
    dsaSessions,
    lateNightSessions,
    ratedSessions: teacherSessions.length,
    averageRating: 5.0,
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
    level: ub.badge?.level || 1,
    earnedAt: ub.awardedAt.toISOString(),
  }));
}

async function recordBadgeEarned(uid, badgeId, badgeName, level = 1) {
  const user = await findUser(uid);
  if (!user) return false;

  try {
    await prisma.badge.upsert({
      where: { id: badgeId },
      update: { name: badgeName, level },
      create: { id: badgeId, name: badgeName, level },
    });

    const auditWeek = `manual_${new Date().toISOString().slice(0, 10)}`;
    await prisma.userBadge.upsert({
      where: { userId_badgeId_auditWeek: { userId: user.id, badgeId, auditWeek } },
      update: {},
      create: { userId: user.id, badgeId, auditWeek },
    });
    return true;
  } catch (_err) {
    return false;
  }
}

module.exports = { calculateBadges, recordBadgeEarned, BADGE_DEFINITIONS };
