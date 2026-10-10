require('dotenv').config();
process.env.TZ = process.env.WEEKLY_AUDIT_TIMEZONE || process.env.TZ || 'UTC';

const { Worker } = require('bullmq');
const { prisma, disconnectPrisma } = require('../config/prisma');
const { getRedisClients, closeRedis } = require('../config/redis');
const { awardWeeklyReward } = require('../services/weeklyWarriorService');
const { getAuditWeekDates } = require('../services/prismaStreakService');
const { scheduleWeeklyAudit, QUEUE_NAME } = require('../queues/weeklyAuditQueue');

const BATCH_SIZE = Number(process.env.WEEKLY_AUDIT_BATCH_SIZE || 250);

function getWeekPayload(data = {}) {
  const weekDates = data.weekDates || getAuditWeekDates();
  return { weekDates, weekKey: data.weekKey || `${weekDates[0]}_${weekDates[6]}` };
}

async function processWeeklyAudit(data) {
  const { weekDates, weekKey } = getWeekPayload(data);
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
      take: BATCH_SIZE,
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

async function start() {
  const { base } = getRedisClients();
  if (!base) throw new Error('REDIS_URL is required to run the weekly audit worker');
  const worker = new Worker(QUEUE_NAME, async job => processWeeklyAudit(job.data), {
    connection: base,
    concurrency: Number(process.env.WEEKLY_AUDIT_CONCURRENCY || 1),
  });
  worker.on('completed', job => console.log(`[weeklyAudit] completed job ${job.id}`));
  worker.on('failed', (job, error) => console.error(`[weeklyAudit] failed job ${job?.id}:`, error));
  if (process.argv.includes('--scheduler')) await scheduleWeeklyAudit();

  const shutdown = async () => {
    await worker.close();
    await closeRedis();
    await disconnectPrisma();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

if (require.main === module) start().catch(error => {
  console.error('[weeklyAudit] startup failed:', error);
  process.exit(1);
});

module.exports = { processWeeklyAudit, getWeekPayload };
