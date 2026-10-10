require('dotenv').config();

const { enqueueWeeklyAudit } = require('../queues/weeklyAuditQueue');
const { getAuditWeekDates } = require('../services/prismaStreakService');

async function enqueueAudit() {
  const weekDates = getAuditWeekDates();
  const weekKey = `${weekDates[0]}_${weekDates[6]}`;
  const job = await enqueueWeeklyAudit(weekKey, weekDates);
  console.log(`[weeklyAudit] queued ${job.id} for ${weekKey}`);
}

if (require.main === module) {
  enqueueAudit().catch(error => {
    console.error('[weeklyAudit] queueing failed:', error);
    process.exitCode = 1;
  });
}

module.exports = { enqueueAudit };
