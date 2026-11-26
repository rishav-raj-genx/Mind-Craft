const { prisma } = require('../config/prisma');
const { calculateStreak, getAuditWeekDates } = require('./prismaStreakService');

const WEEKLY_BADGE = {
  id: 'weekly_warrior',
  name: 'Weekly Warrior',
  level: 1,
  emoji: '⚡',
  description: 'Maintained a perfect 7-day study streak this week',
};
const BONUS_TOKENS = 50;
const REASON = 'weekly_warrior_bonus';

async function ensureWeeklyBadge(tx) {
  return tx.badge.upsert({
    where: { id: WEEKLY_BADGE.id },
    update: WEEKLY_BADGE,
    create: WEEKLY_BADGE,
  });
}

async function awardWeeklyReward({ userId, weekKey, weekDates, auditRunId }) {
  return prisma.$transaction(async (tx) => {
    const weekStart = new Date(`${weekDates[0]}T00:00:00.000Z`);
    const weekEnd = new Date(`${weekDates[6]}T23:59:59.999Z`);
    const cutoff = new Date(weekStart);
    cutoff.setUTCDate(cutoff.getUTCDate() - 365);
    const activity = await tx.activityDay.findMany({
      where: {
        userId,
        activityDate: {
        gte: cutoff,
        lte: weekEnd,
        },
      },
      select: { activityDate: true },
    });
    const evaluation = calculateStreak(activity.map(row => row.activityDate));
    const weeklyActivity = activity.filter(row => (
      row.activityDate >= weekStart
      && row.activityDate <= weekEnd
    ));
    const perfect = weekDates.every(date => weeklyActivity.some(row => (
      row.activityDate.toISOString().slice(0, 10) === date
    )));

    await tx.user.update({
      where: { id: userId },
      data: {
        currentStreak: evaluation.currentStreak,
        longestStreak: evaluation.longestStreak,
        totalActiveDays: evaluation.totalActiveDays,
      },
    });

    if (!perfect) return { perfect: false, newlyAwarded: false };

    await ensureWeeklyBadge(tx);
    await tx.userBadge.upsert({
      where: { userId_badgeId_auditWeek: { userId, badgeId: WEEKLY_BADGE.id, auditWeek: weekKey } },
      update: {},
      create: {
        userId,
        badgeId: WEEKLY_BADGE.id,
        auditWeek: weekKey,
        metadata: { auditRunId, weekStart: weekDates[0], weekEnd: weekDates[6] },
      },
    });

    const idempotencyKey = `${weekKey}:${userId}`;
    const existingTransaction = await tx.tokenTransaction.findUnique({
      where: { userId_reason_idempotencyKey: { userId, reason: REASON, idempotencyKey } },
      select: { id: true },
    });
    if (!existingTransaction) {
      await tx.tokenTransaction.create({
        data: {
          userId,
          amount: BONUS_TOKENS,
          type: 'CREDIT',
          reason: REASON,
          idempotencyKey,
          metadata: { auditRunId, weekStart: weekDates[0], weekEnd: weekDates[6] },
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { mindTokens: { increment: BONUS_TOKENS } },
      });
    }
    return { perfect: true, newlyAwarded: !existingTransaction };
  });
}

async function runWeeklyAudit(data = {}) {
  const weekDates = data.weekDates || getAuditWeekDates();
  const weekKey = data.weekKey || `${weekDates[0]}_${weekDates[6]}`;
  const batchSize = Number(process.env.WEEKLY_AUDIT_BATCH_SIZE || 250);

  const run = await prisma.weeklyAuditRun.upsert({
    where: { weekKey },
    update: {},
    create: {
      weekKey,
      weekStart: new Date(`${weekDates[0]}T00:00:00.000Z`),
      weekEnd: new Date(`${weekDates[6]}T00:00:00.000Z`),
    },
  });
  if (run.status === 'COMPLETED') return run;

  let cursor = run.lastUserId || undefined;
  try {
    while (true) {
      const users = await prisma.user.findMany({
        where: { deletedAt: null, ...(cursor ? { id: { gt: cursor } } : {}) },
        orderBy: { id: 'asc' },
        take: batchSize,
        select: { id: true },
      });
      if (!users.length) break;

      let evaluated = 0;
      let winners = 0;
      let newlyAwarded = 0;
      for (const user of users) {
        const result = await awardWeeklyReward({
          userId: user.id,
          weekKey,
          weekDates,
          auditRunId: run.id,
        });
        evaluated += 1;
        winners += result.perfect ? 1 : 0;
        newlyAwarded += result.newlyAwarded ? 1 : 0;
      }

      cursor = users[users.length - 1].id;
      await prisma.weeklyAuditRun.update({
        where: { id: run.id },
        data: {
          lastUserId: cursor,
          usersScanned: { increment: users.length },
          usersEvaluated: { increment: evaluated },
          winners: { increment: winners },
          newlyAwarded: { increment: newlyAwarded },
          status: 'RUNNING',
        },
      });
    }

    return prisma.weeklyAuditRun.update({
      where: { id: run.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  } catch (error) {
    await prisma.weeklyAuditRun.update({
      where: { id: run.id },
      data: { status: 'FAILED', error: error.message.slice(0, 2000) },
    });
    throw error;
  }
}

module.exports = { awardWeeklyReward, runWeeklyAudit, WEEKLY_BADGE, BONUS_TOKENS };
