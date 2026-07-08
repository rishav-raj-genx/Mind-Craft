/**
 * badgeCalculator.js — Dynamic Badge Progress Calculator
 *
 * Computes badge progress for a user by querying real Firestore data:
 *   - Sessions (completed, taught, late-night, DSA-related)
 *   - Forum activity (doubts answered)
 *   - Streak data (current streak)
 *   - Ratings (average rating, total reviews)
 *   - Social (unique mates interacted with)
 *
 * Every badge starts at Level 0 with 0 progress. Nothing is hardcoded.
 */

const { db }            = require('../config/firebase');
const { calculateStreak } = require('./streakCalculator');
const {
  COLLECTION_USERS,
  COLLECTION_SESSIONS,
  COLLECTION_ACTIVITY_LOG,
  SESSION_COMPLETED,
} = require('../utils/constants');

// ── Badge Definitions ────────────────────────────────────────────────
// Each badge has an id, display info, and level thresholds.
// `metric` tells the calculator which real data to read.
const BADGE_DEFINITIONS = [
  {
    id: 'streak_champion',
    name: 'Streak Champion',
    emoji: '🔥',
    description: 'Maintain a daily streak',
    metric: 'longestStreak',
    thresholds: [3, 7, 14, 30],
    color: 'from-orange-500/20 to-orange-400/10',
    borderColor: 'border-orange-400/30',
    iconColor: 'text-orange-500',
  },
  {
    id: 'session_pro',
    name: 'Session Pro',
    emoji: '📚',
    description: 'Complete tutoring sessions',
    metric: 'totalSessions',
    thresholds: [5, 15, 50],
    color: 'from-green-500/20 to-success-lime/10',
    borderColor: 'border-success-lime/30',
    iconColor: 'text-success-lime',
  },
  {
    id: 'dsa_master',
    name: 'DSA Master',
    emoji: '💻',
    description: 'DSA-related sessions',
    metric: 'dsaSessions',
    thresholds: [3, 10, 25],
    color: 'from-green-500/20 to-success-lime/10',
    borderColor: 'border-success-lime/30',
    iconColor: 'text-green-600',
  },
  {
    id: 'late_night_learner',
    name: 'Late Night Learner',
    emoji: '🌙',
    description: 'Sessions after midnight',
    metric: 'lateNightSessions',
    thresholds: [1, 5, 15],
    color: 'from-purple-500/20 to-focus-purple/10',
    borderColor: 'border-focus-purple/30',
    iconColor: 'text-focus-purple',
  },
  {
    id: 'problem_solver',
    name: 'Problem Solver',
    emoji: '🐛',
    description: 'Answer doubts in the forum',
    metric: 'doubtsAnswered',
    thresholds: [3, 10, 25],
    color: 'from-orange-500/20 to-orange-400/10',
    borderColor: 'border-orange-400/30',
    iconColor: 'text-orange-500',
  },
  {
    id: 'mentor',
    name: 'Mentor',
    emoji: '🎓',
    description: 'Teach sessions as a tutor',
    metric: 'sessionsTaught',
    thresholds: [3, 10, 30],
    color: 'from-blue-500/20 to-blue-400/10',
    borderColor: 'border-blue-400/30',
    iconColor: 'text-blue-600',
  },
  {
    id: 'top_rated',
    name: 'Top Rated',
    emoji: '⭐',
    description: 'Earn high ratings (avg ≥ 4.0)',
    metric: 'ratedSessions',
    thresholds: [5, 15, 30],
    color: 'from-yellow-500/20 to-yellow-400/10',
    borderColor: 'border-yellow-400/30',
    iconColor: 'text-yellow-500',
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    emoji: '🤝',
    description: 'Study with unique mates',
    metric: 'uniqueMates',
    thresholds: [3, 10, 25],
    color: 'from-pink-500/20 to-pink-400/10',
    borderColor: 'border-pink-400/30',
    iconColor: 'text-pink-500',
  },
];

/**
 * Calculates all badge progress for a user.
 *
 * @param {string} uid — Firebase UID
 * @returns {Promise<{
 *   badges:         Array<object>,
 *   totalEarned:    number,
 *   totalSessions:  number,
 *   sessionHistory: Array<object>,
 *   badgeHistory:   Array<object>,
 * }>}
 */
async function calculateBadges(uid) {
  // ── Gather all metrics in parallel ──────────────────────────────
  const [sessionMetrics, forumMetrics, streakData] = await Promise.all([
    getSessionMetrics(uid),
    getForumMetrics(uid),
    calculateStreak(uid),
  ]);

  const metrics = {
    currentStreak:     streakData.currentStreak,
    longestStreak:     streakData.longestStreak,
    totalSessions:     sessionMetrics.totalSessions,
    dsaSessions:       sessionMetrics.dsaSessions,
    lateNightSessions: sessionMetrics.lateNightSessions,
    sessionsTaught:    sessionMetrics.sessionsTaught,
    ratedSessions:     sessionMetrics.ratedSessions,
    averageRating:     sessionMetrics.averageRating,
    uniqueMates:       sessionMetrics.uniqueMates,
    doubtsAnswered:    forumMetrics.doubtsAnswered,
  };

  // ── Compute badge progress ──────────────────────────────────────
  const badges = BADGE_DEFINITIONS.map(def => computeBadge(def, metrics));

  // ── Compute totals ──────────────────────────────────────────────
  const totalEarned = badges.filter(b => b.level > 0).length;

  // ── Badge history (when each level was earned) ──────────────────
  // Read from Firestore badge history subcollection
  const badgeHistory = await getBadgeHistory(uid);

  return {
    badges,
    totalEarned,
    totalSessions:  metrics.totalSessions,
    sessionHistory: sessionMetrics.recentSessions,
    badgeHistory,
    metrics,
  };
}

/**
 * Computes a single badge's level and progress from real metric data.
 */
function computeBadge(definition, metrics) {
  const { id, name, emoji, description, metric, thresholds, color, borderColor, iconColor } = definition;
  const currentValue = metrics[metric] || 0;

  // Determine level
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (currentValue >= thresholds[i]) {
      level = i + 1;
    }
  }

  // Determine next target
  const maxLevel = thresholds.length;
  const isMaxed = level >= maxLevel;
  const nextThreshold = isMaxed ? thresholds[maxLevel - 1] : thresholds[level];
  const prevThreshold = level > 0 ? thresholds[level - 1] : 0;

  // Progress towards next level
  let progress = 0;
  if (isMaxed) {
    progress = 100;
  } else {
    const range = nextThreshold - prevThreshold;
    const completed = currentValue - prevThreshold;
    progress = range > 0 ? Math.max(0, Math.min(100, Math.round((completed / range) * 100))) : 0;
  }

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

/**
 * Queries session data for badge metrics.
 */
async function getSessionMetrics(uid) {
  // Get all completed sessions where user is teacher OR learner
  const [asTeacher, asLearner] = await Promise.all([
    db.collection(COLLECTION_SESSIONS)
      .where('teacherUid', '==', uid)
      .where('status', '==', SESSION_COMPLETED)
      .get(),
    db.collection(COLLECTION_SESSIONS)
      .where('learnerUid', '==', uid)
      .where('status', '==', SESSION_COMPLETED)
      .get(),
  ]);

  const teacherSessions = asTeacher.docs.map(d => d.data());
  const learnerSessions = asLearner.docs.map(d => d.data());
  const allSessions = [...teacherSessions, ...learnerSessions];

  // Deduplicate by sessionId
  const seen = new Set();
  const uniqueSessions = allSessions.filter(s => {
    if (seen.has(s.sessionId)) return false;
    seen.add(s.sessionId);
    return true;
  });

  // Total completed sessions
  const totalSessions = uniqueSessions.length;

  // Sessions taught (as teacher)
  const sessionsTaught = teacherSessions.length;

  // DSA-related sessions (skill contains DSA, Data Structures, Algorithm, etc.)
  const dsaKeywords = ['dsa', 'data structure', 'algorithm', 'data structures'];
  const dsaSessions = uniqueSessions.filter(s =>
    s.skill && dsaKeywords.some(k => s.skill.toLowerCase().includes(k))
  ).length;

  // Late-night sessions (completed after midnight, before 5 AM)
  const lateNightSessions = uniqueSessions.filter(s => {
    if (!s.scheduledAt) return false;
    const hour = new Date(s.scheduledAt).getHours();
    return hour >= 0 && hour < 5;
  }).length;

  // Rated sessions with good ratings (≥ 4.0)
  const ratedSessions = uniqueSessions.filter(s => s.rating && s.rating >= 4.0).length;

  // Average rating
  const ratingsArr = uniqueSessions.filter(s => s.rating && s.rating > 0).map(s => s.rating);
  const averageRating = ratingsArr.length > 0
    ? ratingsArr.reduce((a, b) => a + b, 0) / ratingsArr.length
    : 0;

  // Unique mates (unique UIDs from the other side of sessions)
  const mateSet = new Set();
  teacherSessions.forEach(s => mateSet.add(s.learnerUid));
  learnerSessions.forEach(s => mateSet.add(s.teacherUid));
  const uniqueMates = mateSet.size;

  // Recent sessions (last 20, for history display)
  const recentSessions = uniqueSessions
    .sort((a, b) => (b.scheduledAt || 0) - (a.scheduledAt || 0))
    .slice(0, 20)
    .map(s => ({
      sessionId: s.sessionId,
      skill: s.skill,
      scheduledAt: s.scheduledAt,
      mode: s.mode,
      rating: s.rating || 0,
      role: s.teacherUid === uid ? 'teacher' : 'learner',
    }));

  return {
    totalSessions,
    sessionsTaught,
    dsaSessions,
    lateNightSessions,
    ratedSessions,
    averageRating: Math.round(averageRating * 10) / 10,
    uniqueMates,
    recentSessions,
  };
}

/**
 * Queries forum activity for badge metrics.
 */
async function getForumMetrics(uid) {
  const snapshot = await db
    .collection(COLLECTION_USERS)
    .doc(uid)
    .collection(COLLECTION_ACTIVITY_LOG)
    .where('type', '==', 'forum_answer')
    .get();

  return {
    doubtsAnswered: snapshot.size,
  };
}

/**
 * Gets badge earning history from Firestore.
 */
async function getBadgeHistory(uid) {
  try {
    const snapshot = await db
      .collection(COLLECTION_USERS)
      .doc(uid)
      .collection('badgeHistory')
      .orderBy('earnedAt', 'desc')
      .limit(50)
      .get();

    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      earnedAt: d.data().earnedAt?.toDate?.()?.toISOString() || null,
    }));
  } catch (_) {
    // Collection may not exist yet
    return [];
  }
}

/**
 * Records a badge earning event in history.
 */
async function recordBadgeEarned(uid, badgeId, badgeName, level) {
  const ref = db
    .collection(COLLECTION_USERS)
    .doc(uid)
    .collection('badgeHistory')
    .doc(`${badgeId}_level${level}`);

  const existing = await ref.get();
  if (existing.exists) return; // Already recorded

  await ref.set({
    badgeId,
    badgeName,
    level,
    earnedAt: require('../config/firebase').admin.firestore.FieldValue.serverTimestamp(),
  });
}

module.exports = { calculateBadges, recordBadgeEarned, BADGE_DEFINITIONS };
