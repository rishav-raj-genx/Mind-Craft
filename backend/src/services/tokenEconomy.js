/**
 * tokenEconomy.js — Mind Tokens Transactional Gamification System
 *
 * Manages the "Mind Token" virtual currency. All balance adjustments
 * use Firestore atomic transactions (FieldValue.increment) to eliminate
 * double-tap race conditions and balance exploitation.
 *
 * Token awards:
 *   - Forum answer:        +10 tokens
 *   - Session completed:   +25 tokens
 *   - 5-day streak bonus:  +15 tokens
 *   - 10-day streak bonus: +30 tokens
 *   - 30-day streak bonus: +100 tokens
 */

const { db, admin } = require('../config/firebase');
const {
  COLLECTION_USERS,
  COLLECTION_TOKEN_LEDGER,
  COLLECTION_ACTIVITY_LOG,
  TOKENS_FORUM_ANSWER,
  TOKENS_SESSION_COMPLETE,
  TOKENS_STREAK_5,
  TOKENS_STREAK_10,
  TOKENS_STREAK_30,
} = require('../utils/constants');

const FieldValue = admin.firestore.FieldValue;

/**
 * Awards tokens to a user using an atomic Firestore transaction.
 *
 * This function:
 *   1. Increments the user's `tokenBalance` atomically via FieldValue.increment()
 *   2. Writes a ledger entry to the user's `tokenLedger` subcollection
 *   3. Logs the activity in `activityLog` for streak tracking
 *
 * The entire operation is wrapped in a Firestore transaction to prevent
 * double-awarding from concurrent requests.
 *
 * @param {string} uid       — User's Firebase UID
 * @param {number} amount    — Number of tokens to award (positive integer)
 * @param {string} reason    — Human-readable reason (e.g. 'forum_answer')
 * @param {object} [meta={}] — Optional metadata (sessionId, questionId, etc.)
 * @returns {Promise<{ newBalance: number, transactionId: string }>}
 */
async function awardTokens(uid, amount, reason, meta = {}) {
  if (!uid || typeof amount !== 'number' || amount <= 0) {
    throw Object.assign(
      new Error('Invalid token award: uid and positive amount are required'),
      { statusCode: 400 },
    );
  }

  const userRef   = db.collection(COLLECTION_USERS).doc(uid);
  const ledgerRef = userRef.collection(COLLECTION_TOKEN_LEDGER).doc();

  const result = await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      throw Object.assign(new Error(`User ${uid} not found`), { statusCode: 404 });
    }

    // ── Atomic balance increment ──────────────────────────────────
    transaction.update(userRef, {
      tokenBalance: FieldValue.increment(amount),
    });

    // ── Ledger entry for audit trail ──────────────────────────────
    const ledgerEntry = {
      transactionId: ledgerRef.id,
      amount,
      reason,
      meta,
      timestamp: FieldValue.serverTimestamp(),
      type: 'credit',
    };
    transaction.set(ledgerRef, ledgerEntry);

    // ── Activity log for streak calculation ────────────────────────
    const activityRef = userRef.collection(COLLECTION_ACTIVITY_LOG).doc();
    transaction.set(activityRef, {
      type:      reason,
      timestamp: FieldValue.serverTimestamp(),
      date:      new Date().toISOString().split('T')[0], // YYYY-MM-DD
    });

    const currentBalance = userDoc.data().tokenBalance || 0;
    return { newBalance: currentBalance + amount, transactionId: ledgerRef.id };
  });

  console.log(`🪙 Awarded ${amount} tokens to ${uid} (${reason})`);
  return result;
}

/**
 * Awards tokens for answering a question in the Doubt Forum.
 * @param {string} uid
 * @param {string} [questionId]
 */
async function awardForumAnswer(uid, questionId = '') {
  return awardTokens(uid, TOKENS_FORUM_ANSWER, 'forum_answer', { questionId });
}

/**
 * Awards tokens for completing a tutoring session.
 * Awards both the teacher and the learner.
 * @param {string} teacherUid
 * @param {string} learnerUid
 * @param {string} sessionId
 */
async function awardSessionComplete(teacherUid, learnerUid, sessionId) {
  const [teacherResult, learnerResult] = await Promise.all([
    awardTokens(teacherUid, TOKENS_SESSION_COMPLETE, 'session_complete_teacher', { sessionId }),
    awardTokens(learnerUid, TOKENS_SESSION_COMPLETE, 'session_complete_learner', { sessionId }),
  ]);
  return { teacherResult, learnerResult };
}

/**
 * Awards streak bonus tokens based on the current streak length.
 * Only awards at milestone boundaries (5, 10, 30 days).
 *
 * @param {string} uid
 * @param {number} streakDays — Current streak length in days
 */
async function awardStreakBonus(uid, streakDays) {
  const milestones = [
    { days: 30, tokens: TOKENS_STREAK_30, label: '30_day_streak' },
    { days: 10, tokens: TOKENS_STREAK_10, label: '10_day_streak' },
    { days: 5,  tokens: TOKENS_STREAK_5,  label: '5_day_streak' },
  ];

  for (const m of milestones) {
    if (streakDays === m.days) {
      return awardTokens(uid, m.tokens, m.label, { streakDays });
    }
  }

  return null; // No milestone hit
}

/**
 * Gets the current token balance for a user.
 * @param {string} uid
 * @returns {Promise<number>}
 */
async function getBalance(uid) {
  const doc = await db.collection(COLLECTION_USERS).doc(uid).get();
  if (!doc.exists) {
    throw Object.assign(new Error(`User ${uid} not found`), { statusCode: 404 });
  }
  return doc.data().tokenBalance || 0;
}

/**
 * Gets paginated transaction history from the token ledger.
 *
 * @param {string} uid
 * @param {number} [limit=20]
 * @param {string} [startAfterTimestamp] — ISO timestamp for cursor pagination
 * @returns {Promise<Array<object>>}
 */
async function getTransactionHistory(uid, limit = 20, startAfterTimestamp = null) {
  let query = db
    .collection(COLLECTION_USERS)
    .doc(uid)
    .collection(COLLECTION_TOKEN_LEDGER)
    .orderBy('timestamp', 'desc')
    .limit(limit);

  if (startAfterTimestamp) {
    query = query.startAfter(new Date(startAfterTimestamp));
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || null,
  }));
}

module.exports = {
  awardTokens,
  awardForumAnswer,
  awardSessionComplete,
  awardStreakBonus,
  getBalance,
  getTransactionHistory,
};
