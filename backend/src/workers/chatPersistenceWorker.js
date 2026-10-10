const { Worker } = require('bullmq');
const { getRedisClients } = require('../config/redis');
const { persistMessage } = require('../services/chatPersistenceService');

function startChatPersistenceWorker() {
  const { base } = getRedisClients();
  if (!base) throw new Error('Redis is required for chat persistence worker');

  const worker = new Worker(
    'chat-persistence',
    async (job) => persistMessage(job.data),
    {
      connection: base,
      concurrency: Number.parseInt(process.env.CHAT_PERSISTENCE_CONCURRENCY || '10', 10),
    },
  );

  worker.on('completed', (job) => console.log(`Chat message persisted: ${job.id}`));
  worker.on('failed', (job, error) => {
    console.error(`Chat message persistence failed: ${job?.id || 'unknown'}`, error);
  });
  return worker;
}

if (require.main === module) {
  require('dotenv').config();
  startChatPersistenceWorker();
}

module.exports = { startChatPersistenceWorker };
