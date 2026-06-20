/**
 * streakCalculator.js — Daily Consistency Streak Calculator
 *
 * Queries a user's activity log to compute:
 *   - Current active streak (consecutive days including today)
 *   - Longest streak ever achieved
 *   - A 35-element array of active dates for the 7×5 GitHub-style
 *     consistency graph on the user profile page
 *
 * The "grid" output maps to 7 columns (days of the week) × 5 rows
 * (weeks), covering the most recent 35 calendar days.
 */

const { db }               = require('../config/firebase');
const { COLLECTION_USERS, COLLECTION_ACTIVITY_LOG } = require('../utils/constants');

/**
 * Calculates streak data for a user.
 *
 * @param {string} uid — Firebase UID
 * @returns {Promise<{
 *   currentStreak:  number,
 *   longestStreak:  number,
 *   activeDates:    string[],
 *   grid:           Array<{ date: string, active: boolean, dayOfWeek: number }>
 * }>}
 */
async function calculateStreak(uid) {
  // ── Fetch all activity log entries for the last 90 days ───────────
  const now       = new Date();
  const ninetyAgo = new Date(now);
  ninetyAgo.setDate(ninetyAgo.getDate() - 90);

  const snapshot = await db
    .collection(COLLECTION_USERS)
    .doc(uid)
    .collection(COLLECTION_ACTIVITY_LOG)
    .where('date', '>=', ninetyAgo.toISOString().split('T')[0])
    .orderBy('date', 'asc')
    .get();

  // ── Extract unique active dates ───────────────────────────────────
  const activeDateSet = new Set();
  for (const doc of snapshot.docs) {
    const date = doc.data().date; // 'YYYY-MM-DD'
    if (date) activeDateSet.add(date);
  }

  const activeDates = Array.from(activeDateSet).sort();

  // ── Calculate current streak ──────────────────────────────────────
  const currentStreak = computeCurrentStreak(activeDateSet, now);

  // ── Calculate longest streak ──────────────────────────────────────
  const longestStreak = computeLongestStreak(activeDates);

  // ── Build the 7×5 grid (35 days) for the frontend ────────────────
  const grid = buildConsistencyGrid(activeDateSet, now);

  return {
    currentStreak,
    longestStreak,
    activeDates: getLast35ActiveDates(activeDateSet, now),
    grid,
  };
}

/**
 * Computes the current streak by walking backwards from today.
 *
 * A streak is broken if a calendar day has no activity entry.
 * Today counts even if the user hasn't been active yet (we check
 * yesterday as the fallback starting point).
 *
 * @param {Set<string>} activeDateSet
 * @param {Date} now
 * @returns {number}
 */
function computeCurrentStreak(activeDateSet, now) {
  const today     = toDateString(now);
  const yesterday = toDateString(new Date(now.getTime() - 86400000));

  // Determine starting point: today if active, else yesterday
  let startDate;
  if (activeDateSet.has(today)) {
    startDate = today;
  } else if (activeDateSet.has(yesterday)) {
    startDate = yesterday;
  } else {
    return 0;
  }

  let streak  = 0;
  let current = new Date(startDate + 'T00:00:00Z');

  while (activeDateSet.has(toDateString(current))) {
    streak++;
    current.setDate(current.getDate() - 1);
  }

  return streak;
}

/**
 * Computes the longest streak from a sorted list of active dates.
 *
 * @param {string[]} sortedDates — Sorted array of 'YYYY-MM-DD' strings
 * @returns {number}
 */
function computeLongestStreak(sortedDates) {
  if (sortedDates.length === 0) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1] + 'T00:00:00Z');
    const curr = new Date(sortedDates[i] + 'T00:00:00Z');
    const diffDays = (curr - prev) / 86400000;

    if (diffDays === 1) {
      current++;
      longest = Math.max(longest, current);
    } else if (diffDays > 1) {
      current = 1;
    }
    // diffDays === 0 means duplicate date, skip
  }

  return longest;
}

/**
 * Builds a 7×5 (35-day) grid for the GitHub-style consistency graph.
 *
 * The grid covers the 35 most recent calendar days, arranged as:
 *   - 7 columns (Mon–Sun)
 *   - 5 rows (weeks)
 *   - Most recent day is bottom-right
 *
 * @param {Set<string>} activeDateSet
 * @param {Date} now
 * @returns {Array<{ date: string, active: boolean, dayOfWeek: number, weekIndex: number }>}
 */
function buildConsistencyGrid(activeDateSet, now) {
  const grid = [];
  const totalCells = 35; // 7 × 5

  for (let i = totalCells - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);

    const dateStr   = toDateString(d);
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
    const weekIndex = Math.floor((totalCells - 1 - i) / 7);

    grid.push({
      date:      dateStr,
      active:    activeDateSet.has(dateStr),
      dayOfWeek,
      weekIndex,
    });
  }

  return grid;
}

/**
 * Returns the active dates within the last 35 days.
 */
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

/**
 * Converts a Date to 'YYYY-MM-DD' string (UTC).
 */
function toDateString(date) {
  return date.toISOString().split('T')[0];
}

module.exports = { calculateStreak };
