/**
 * tokenEconomy.js — Mind Tokens Transactional Gamification System
 *
 * Manages the "Mind Token" virtual currency using Prisma PostgreSQL transactions.
 */

const { prisma } = require('../config/prisma');
const { v4: uuidv4 } = require('uuid');
const {
  TOKENS_FORUM_ANSWER,
  TOKENS_SESSION_COMPLETE,
  TOKENS_STREAK_5,
  TOKENS_STREAK_10,
  TOKENS_STREAK_30,
} = require('../utils/constants');

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

/**
 * Awards tokens to a user using an atomic Prisma transaction.
 * Ensures an immutable TokenTransaction is always recorded with a unique idempotencyKey.
 */
async function awardTokens(uid, amount, reason, meta = {}) {
  if (!uid || typeof amount !== 'number' || amount <= 0) {
    throw Object.assign(
      new Error('Invalid token award: uid and positive amount are required'),
      { statusCode: 400 },
    );
  }

  const user = await findUser(uid);
  if (!user) {
    throw Object.assign(new Error(`User ${uid} not found`), { statusCode: 404 });
  }

  const isExplicitIdempotent = Boolean(meta.idempotencyKey || meta.sessionId || meta.questionId || meta.doubtId);
  const idempotencyKey = meta.idempotencyKey || meta.sessionId || meta.questionId || meta.doubtId || `award_${user.id}_${Date.now()}_${uuidv4()}`;

  if (isExplicitIdempotent) {
    const existing = await prisma.tokenTransaction.findFirst({
      where: {
        userId: user.id,
        reason,
        idempotencyKey,
      },
      select: { id: true },
    });

    if (existing) {
      return {
        newBalance: user.mindTokens,
        transactionId: existing.id,
        alreadyAwarded: true,
      };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.tokenTransaction.create({
        data: {
          userId: user.id,
          amount,
          type: 'CREDIT',
          reason,
          idempotencyKey,
          metadata: meta,
        },
      });

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: { mindTokens: { increment: amount } },
        select: { mindTokens: true },
      });

      const dateStr = new Date().toISOString().slice(0, 10);
      const activityDate = new Date(`${dateStr}T00:00:00.000Z`);

      const existingActivity = await tx.activityDay.findUnique({
        where: { userId_activityDate: { userId: user.id, activityDate } },
        select: { activityTypes: true },
      });

      const activityTypes = Array.from(new Set([...(existingActivity?.activityTypes || []), reason]));

      await tx.activityDay.upsert({
        where: { userId_activityDate: { userId: user.id, activityDate } },
        update: { activityTypes: { set: activityTypes } },
        create: { userId: user.id, activityDate, activityTypes },
      });

      return {
        newBalance: updatedUser.mindTokens,
        transactionId: transaction.id,
        alreadyAwarded: false,
      };
    });

    return result;
  } catch (err) {
    if (err.code === 'P2002' && isExplicitIdempotent) {
      const existing = await prisma.tokenTransaction.findFirst({
        where: {
          userId: user.id,
          reason,
          idempotencyKey,
        },
        select: { id: true },
      });
      const freshUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { mindTokens: true },
      });
      return {
        newBalance: freshUser ? freshUser.mindTokens : user.mindTokens,
        transactionId: existing ? existing.id : null,
        alreadyAwarded: true,
      };
    }
    throw err;
  }
}

/**
 * Deducts tokens from a user atomically, preventing concurrent overdrafts.
 * Checks balance >= amount via conditional update inside a single Prisma transaction.
 */
async function deductTokens(uid, amount, reason, meta = {}) {
  if (!uid || typeof amount !== 'number' || amount <= 0) {
    throw Object.assign(
      new Error('Invalid token deduction: uid and positive amount are required'),
      { statusCode: 400 },
    );
  }

  const user = await findUser(uid);
  if (!user) {
    throw Object.assign(new Error(`User ${uid} not found`), { statusCode: 404 });
  }

  const isExplicitIdempotent = Boolean(meta.idempotencyKey || meta.sessionId || meta.questionId || meta.doubtId);
  const idempotencyKey = meta.idempotencyKey || meta.sessionId || meta.questionId || meta.doubtId || `deduct_${user.id}_${Date.now()}_${uuidv4()}`;

  if (isExplicitIdempotent) {
    const existing = await prisma.tokenTransaction.findFirst({
      where: {
        userId: user.id,
        reason,
        idempotencyKey,
      },
      select: { id: true },
    });

    if (existing) {
      return {
        newBalance: user.mindTokens,
        transactionId: existing.id,
        alreadyProcessed: true,
      };
    }
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Atomic conditional update preventing overdrafts: user must have mindTokens >= amount
      const updateResult = await tx.user.updateMany({
        where: {
          id: user.id,
          mindTokens: { gte: amount },
        },
        data: {
          mindTokens: { decrement: amount },
        },
      });

      if (updateResult.count === 0) {
        throw Object.assign(
          new Error('Insufficient token balance'),
          { statusCode: 400 },
        );
      }

      const updatedUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { mindTokens: true },
      });

      const transaction = await tx.tokenTransaction.create({
        data: {
          userId: user.id,
          amount,
          type: 'DEBIT',
          reason,
          idempotencyKey,
          metadata: meta,
        },
      });

      return {
        newBalance: updatedUser.mindTokens,
        transactionId: transaction.id,
        alreadyProcessed: false,
      };
    });

    return result;
  } catch (err) {
    if (err.code === 'P2002' && isExplicitIdempotent) {
      const existing = await prisma.tokenTransaction.findFirst({
        where: {
          userId: user.id,
          reason,
          idempotencyKey,
        },
        select: { id: true },
      });
      const freshUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { mindTokens: true },
      });
      return {
        newBalance: freshUser ? freshUser.mindTokens : user.mindTokens,
        transactionId: existing ? existing.id : null,
        alreadyProcessed: true,
      };
    }
    throw err;
  }
}

async function awardForumAnswer(uid, questionId = '', idempotencyKey = null) {
  const key = idempotencyKey || (questionId ? `forum_${questionId}` : null);
  return awardTokens(uid, TOKENS_FORUM_ANSWER, 'forum_answer', {
    questionId,
    doubtId: questionId,
    idempotencyKey: key,
  });
}

async function awardSessionComplete(teacherUid, learnerUid, sessionId) {
  const [teacherResult, learnerResult] = await Promise.all([
    awardTokens(teacherUid, TOKENS_SESSION_COMPLETE, 'session_complete_teacher', {
      sessionId,
      idempotencyKey: `session_${sessionId}_teacher`,
    }),
    awardTokens(learnerUid, TOKENS_SESSION_COMPLETE, 'session_complete_learner', {
      sessionId,
      idempotencyKey: `session_${sessionId}_learner`,
    }),
  ]);
  return { teacherResult, learnerResult };
}

async function awardStreakBonus(uid, streakDays, key = null) {
  const milestones = [
    { days: 30, tokens: TOKENS_STREAK_30, label: '30_day_streak' },
    { days: 10, tokens: TOKENS_STREAK_10, label: '10_day_streak' },
    { days: 5,  tokens: TOKENS_STREAK_5,  label: '5_day_streak' },
  ];

  const milestone = milestones.find((m) => streakDays === m.days);
  if (!milestone) return null;

  const todayUTC = new Date().toISOString().slice(0, 10);
  const idempotencyKey = key || `streak_${streakDays}_${todayUTC}`;

  return awardTokens(uid, milestone.tokens, milestone.label, {
    streakDays,
    idempotencyKey,
  });
}

async function getBalance(uid) {
  const user = await findUser(uid);
  if (!user) {
    throw Object.assign(new Error(`User ${uid} not found`), { statusCode: 404 });
  }
  return user.mindTokens;
}

async function getTransactionHistory(uid, limit = 20, startAfterTimestamp = null) {
  const user = await findUser(uid);
  if (!user) {
    throw Object.assign(new Error(`User ${uid} not found`), { statusCode: 404 });
  }

  const transactions = await prisma.tokenTransaction.findMany({
    where: {
      userId: user.id,
      ...(startAfterTimestamp ? { createdAt: { lt: new Date(startAfterTimestamp) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 20, 100),
  });

  return transactions.map((t) => ({
    id: t.id,
    amount: t.amount,
    reason: t.reason,
    type: t.type.toLowerCase(),
    timestamp: t.createdAt.toISOString(),
    meta: t.metadata || {},
  }));
}

async function getLeaderboard(uid) {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      mindTokens: { gt: 0 },
    },
    orderBy: { mindTokens: 'desc' },
    take: 100,
    select: {
      id: true,
      clerkUserId: true,
      name: true,
      mindTokens: true,
      photoUrl: true,
    },
  });

  const allUsers = users.map((u, index) => ({
    uid: u.clerkUserId,
    name: u.name,
    tokens: u.mindTokens,
    photoUrl: u.photoUrl,
    rank: index + 1,
  }));

  const myIndex = allUsers.findIndex((u) => u.uid === uid);
  const myRank = myIndex !== -1 ? myIndex + 1 : -1;
  const myTokens = myIndex !== -1 ? allUsers[myIndex].tokens : 0;

  let tokensToNextRank = 0;
  if (myIndex > 0) {
    tokensToNextRank = allUsers[myIndex - 1].tokens - myTokens + 1;
  } else if (myIndex === -1 && allUsers.length > 0) {
    tokensToNextRank = allUsers[allUsers.length - 1].tokens - myTokens + 1;
  }

  return {
    leaderboard: allUsers,
    myRank,
    myTokens,
    tokensToNextRank,
  };
}

module.exports = {
  awardTokens,
  deductTokens,
  awardForumAnswer,
  awardSessionComplete,
  awardStreakBonus,
  getBalance,
  getTransactionHistory,
  getLeaderboard,
};
