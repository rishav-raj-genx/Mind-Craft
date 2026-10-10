const { Queue } = require('bullmq');
const { getRedisClients } = require('../config/redis');

const QUEUE_NAME = 'weekly-warrior-audit';
let queue;

function getWeeklyAuditQueue() {
  if (queue) return queue;
  const { base } = getRedisClients();
  if (!base) throw new Error('Redis is required for weekly audit');
  queue = new Queue(QUEUE_NAME, {
    connection: base,
    defaultJobOptions: {
      attempts: Number(process.env.WEEKLY_AUDIT_MAX_ATTEMPTS || 3),
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 1000 },
    },
  });
  return queue;
}

async function enqueueWeeklyAudit(weekKey, weekDates) {
  return getWeeklyAuditQueue().add('run-weekly-audit', { weekKey, weekDates }, {
    jobId: `weekly-audit:${weekKey}`,
  });
}

async function scheduleWeeklyAudit() {
  const auditQueue = getWeeklyAuditQueue();
  await auditQueue.upsertJobScheduler(
    'weekly-audit-scheduler',
    { pattern: process.env.WEEKLY_AUDIT_CRON || '0 0 * * 0' },
    { name: 'run-weekly-audit', data: {}, opts: { attempts: 3 } },
  );
}

module.exports = { getWeeklyAuditQueue, enqueueWeeklyAudit, scheduleWeeklyAudit, QUEUE_NAME };
