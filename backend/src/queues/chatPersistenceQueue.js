const { Queue } = require('bullmq');
const { getRedisClients } = require('../config/redis');

let queue;

function getChatPersistenceQueue() {
  if (queue) return queue;
  const { base } = getRedisClients();
  if (!base) throw new Error('Redis is required for chat persistence');
  queue = new Queue('chat-persistence', {
    connection: base,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 500 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });
  return queue;
}

async function enqueueChatMessage(payload) {
  const job = await getChatPersistenceQueue().add('persist-message', payload, {
    jobId: payload.messageId,
  });
  return job.id;
}

module.exports = { getChatPersistenceQueue, enqueueChatMessage };
