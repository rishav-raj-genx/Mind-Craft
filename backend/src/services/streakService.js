/**
 * streakService.js — Daily Consistency Streak Service
 *
 * Tracks user daily check-in activity, computes streaks without arbitrary cutoffs,
 * and handles freeze shield consumption accurately.
 */

const { prisma } = require('../config/prisma');

const BADGE_MILESTONES = [
  { days: 3,   name: 'Spark Starter',    emoji: '🌱', icon: 'Sprout',    level: 1, freezeReward: 1 },
  { days: 7,   name: 'Week Warrior',     emoji: '⚡', icon: 'Zap',       level: 2, freezeReward: 1 },
  { days: 14,  name: 'Fortnight Focus',  emoji: '🔥', icon: 'Flame',     level: 3, freezeReward: 1 },
  { days: 30,  name: 'Monthly Master',   emoji: '🏆', icon: 'Trophy',    level: 4, freezeReward: 1 },
  { days: 60,  name: 'Discipline King',  emoji: '💎', icon: 'Diamond',   level: 5, freezeReward: 1 },
  { days: 100, name: 'Century Legend',   emoji: '👑', icon: 'Crown',     level: 6, freezeReward: 2 },
];

function toDateString(date) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + IST_OFFSET_MS);
  return istDate.toISOString().split('T')[0];
}

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
    select: { id: true, clerkUserId: true },
  });
}

async function recordCheckIn(uid) {
  const user = await findUser(uid);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const dateStr = toDateString(new Date());
  const activityDate = new Date(`${dateStr}T00:00:00.000Z`);
  const existing = await prisma.activityDay.findUnique({
    where: { userId_activityDate: { userId: user.id, activityDate } },
    select: { activityTypes: true },
  });

  const activityTypes = Array.from(new Set([...(existing?.activityTypes || []), 'app_open']));
  await prisma.activityDay.upsert({
    where: { userId_activityDate: { userId: user.id, activityDate } },
    update: { activityTypes: { set: activityTypes } },
    create: { userId: user.id, activityDate, activityTypes },
  });

  return { alreadyCheckedIn: Boolean(existing) };
}

async function calculateStreak(uid) {
  const user = await findUser(uid);
  if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const now = new Date();
  // Track true continuous daily activity without artificial 90-day reset floor
  const rows = await prisma.activityDay.findMany({
    where: { userId: user.id },
    select: { activityDate: true },
    orderBy: { activityDate: 'asc' },
  });

  const activeDates = rows.map((row) => row.activityDate.toISOString().slice(0, 10));
  const activeDateSet = new Set(activeDates);
  const longestStreak = computeLongestStreak(activeDates);
  const totalActiveDays = activeDates.length;
  const initialStreakFreezes = computeStreakFreezes(longestStreak);

  const { currentStreak, streakFreezes } = computeCurrentStreakWithShields(
    activeDateSet,
    now,
    initialStreakFreezes,
  );

  const effectiveLongest = Math.max(longestStreak, currentStreak);
  const grid = buildConsistencyGrid(activeDateSet, now);
  const badges = computeBadges(currentStreak, effectiveLongest, totalActiveDays);

  // Sync latest streak to User record
  await prisma.user.update({
    where: { id: user.id },
    data: {
      currentStreak,
      longestStreak: effectiveLongest,
      totalActiveDays,
    },
  }).catch(() => {});

  return {
    currentStreak,
    longestStreak: effectiveLongest,
    activeDates: getLast35ActiveDates(activeDateSet, now),
    grid,
    badges,
    streakFreezes,
    totalActiveDays,
  };
}

function computeStreakFreezes(longestStreak) {
  let freezes = 2;
  for (const milestone of BADGE_MILESTONES) {
    if (longestStreak >= milestone.days) {
      freezes += milestone.freezeReward;
    }
  }
  return freezes;
}

function countConsecutive(activeDateSet, startDateStr) {
  let count = 0;
  let current = new Date(startDateStr + 'T00:00:00Z');
  while (activeDateSet.has(toDateString(current))) {
    count++;
    current.setUTCDate(current.getUTCDate() - 1);
  }
  return count;
}

/**
 * Computes current streak with accurate freeze shield deduction:
 * Only deducts a shield if user was active on day N-2, inactive on N-1, and has shields > 0.
 * Does NOT deduct shields for continuous dormancy.
 */
function computeCurrentStreakWithShields(activeDateSet, now, initialFreezes = 2) {
  const today = toDateString(now);
  const yesterday = toDateString(new Date(now.getTime() - 86400000));
  const dayBeforeYesterday = toDateString(new Date(now.getTime() - 2 * 86400000));

  let streakFreezes = initialFreezes;
  let currentStreak = 0;

  const isActiveToday = activeDateSet.has(today);
  const isActiveYesterday = activeDateSet.has(yesterday);
  const isActiveNMinus2 = activeDateSet.has(dayBeforeYesterday);

  // Only deduct shield if user was active on N-2, inactive on N-1, and has shields > 0
  const qualifiesForFreeze = isActiveNMinus2 && !isActiveYesterday && streakFreezes > 0;

  if (isActiveToday) {
    if (isActiveYesterday) {
      currentStreak = countConsecutive(activeDateSet, today);
    } else if (qualifiesForFreeze) {
      streakFreezes -= 1;
      currentStreak = 1 + countConsecutive(activeDateSet, dayBeforeYesterday);
    } else {
      // Dormant on both N-2 and N-1, or had 0 shields: starts fresh today
      currentStreak = 1;
    }
  } else {
    if (isActiveYesterday) {
      currentStreak = countConsecutive(activeDateSet, yesterday);
    } else if (qualifiesForFreeze) {
      streakFreezes -= 1;
      currentStreak = countConsecutive(activeDateSet, dayBeforeYesterday);
    } else {
      // Inactive today and yesterday without freeze shield coverage: streak reset
      currentStreak = 0;
    }
  }

  return { currentStreak, streakFreezes };
}

function computeCurrentStreak(activeDateSet, now) {
  return computeCurrentStreakWithShields(activeDateSet, now, 0).currentStreak;
}

function computeLongestStreak(sortedDates) {
  if (sortedDates.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + 'T00:00:00Z');
    const curr = new Date(sortedDates[i] + 'T00:00:00Z');
    const diffDays = Math.round((curr - prev) / 86400000);
    if (diffDays === 1) {
      current++;
      longest = Math.max(longest, current);
    } else if (diffDays > 1) {
      current = 1;
    }
  }
  return longest;
}

function computeBadges(currentStreak, longestStreak, totalActiveDays) {
  const bestStreak = Math.max(currentStreak, longestStreak);
  const earned = BADGE_MILESTONES.filter((b) => bestStreak >= b.days);
  const remaining = BADGE_MILESTONES.filter((b) => bestStreak < b.days);
  const next = remaining.length > 0 ? remaining[0] : null;
  const daysToNext = next ? next.days - currentStreak : 0;

  let progress = 0;
  if (next) {
    const prevMilestoneDays = earned.length > 0 ? earned[earned.length - 1].days : 0;
    const range = next.days - prevMilestoneDays;
    const completed = currentStreak - prevMilestoneDays;
    progress = range > 0 ? Math.max(0, Math.min(100, Math.round((completed / range) * 100))) : 0;
  } else {
    progress = 100;
  }

  return { earned, next, daysToNext: Math.max(0, daysToNext), progress, totalActiveDays };
}

function buildConsistencyGrid(activeDateSet, now) {
  const grid = [];
  const totalCells = 35;
  for (let i = totalCells - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = toDateString(d);
    const dayOfWeek = d.getDay();
    const weekIndex = Math.floor((totalCells - 1 - i) / 7);
    grid.push({ date: dateStr, active: activeDateSet.has(dateStr), dayOfWeek, weekIndex });
  }
  return grid;
}

function getLast35ActiveDates(activeDateSet, now) {
  const result = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = toDateString(d);
    if (activeDateSet.has(dateStr)) {
      result.push(dateStr);
    }
  }
  return result;
}

module.exports = {
  calculateStreak,
  recordCheckIn,
  BADGE_MILESTONES,
  computeStreakFreezes,
  computeCurrentStreak,
  computeCurrentStreakWithShields,
  computeLongestStreak,
  computeBadges,
  buildConsistencyGrid,
  getLast35ActiveDates,
  toDateString,
};
