const { prisma } = require('../config/prisma');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIstDateString(date) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function dateOnly(dateString) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function getAuditWeekDates(now = new Date()) {
  const today = dateOnly(toIstDateString(now));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (7 - index));
    return date.toISOString().slice(0, 10);
  });
}

function getCurrentStreak(activeDates, now = new Date()) {
  const active = new Set(activeDates);
  const today = toIstDateString(now);
  const yesterday = toIstDateString(new Date(now.getTime() - 86400000));
  let current = active.has(today) ? today : (active.has(yesterday) ? yesterday : null);
  if (!current) return 0;

  let streak = 0;
  while (current && active.has(current)) {
    streak += 1;
    const previous = dateOnly(current);
    previous.setUTCDate(previous.getUTCDate() - 1);
    current = previous.toISOString().slice(0, 10);
  }
  return streak;
}

function getLongestStreak(activeDates) {
  const sorted = [...new Set(activeDates)].sort();
  let longest = 0;
  let current = 0;
  let previous;
  for (const value of sorted) {
    if (previous) {
      const difference = (dateOnly(value) - dateOnly(previous)) / 86400000;
      current = difference === 1 ? current + 1 : 1;
    } else {
      current = 1;
    }
    longest = Math.max(longest, current);
    previous = value;
  }
  return longest;
}

function calculateStreak(activeDates, now = new Date()) {
  const normalized = activeDates.map(value => value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10));
  return {
    currentStreak: getCurrentStreak(normalized, now),
    longestStreak: getLongestStreak(normalized),
    totalActiveDays: new Set(normalized).size,
  };
}

async function getUserStreak(userId, { now = new Date(), days = 365 } = {}) {
  const cutoff = new Date(now.getTime() - days * 86400000);
  const rows = await prisma.activityDay.findMany({
    where: { userId, activityDate: { gte: cutoff } },
    select: { activityDate: true },
    orderBy: { activityDate: 'asc' },
  });
  return calculateStreak(rows.map(row => row.activityDate), now);
}

module.exports = {
  calculateStreak,
  getAuditWeekDates,
  getUserStreak,
  toIstDateString,
};
