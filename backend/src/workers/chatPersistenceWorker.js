const { Worker } = require('bullmq');
const { getRedisClients } = require('../config/redis');
const { persistMessage } = require('../services/chatPersistenceService');

let workerInstance = null;

function startChatPersistenceWorker() {
  if (workerInstance) return workerInstance;

  const { base } = getRedisClients();
  if (!base) throw new Error('Redis is required for chat persistence worker');

  workerInstance = new Worker(
    'chat-persistence',
    async (job) => persistMessage(job.data),
    {
      connection: base,
      concurrency: Number.parseInt(process.env.CHAT_PERSISTENCE_CONCURRENCY || '10', 10),
    },
  );

  workerInstance.on('completed', (job) => console.log(`Chat message persisted: ${job.id}`));
  workerInstance.on('failed', (job, error) => {
    console.error(`Chat message persistence failed: ${job?.id || 'unknown'}`, error);
  });

  return workerInstance;
}

async function closeChatPersistenceWorker() {
  if (!workerInstance) return;
  try {
    await workerInstance.close();
    console.log('Chat persistence worker closed cleanly');
  } catch (err) {
    console.error('Error closing chat persistence worker:', err);
  } finally {
    workerInstance = null;
  }
}

if (require.main === module) {
  require('dotenv').config();
  const worker = startChatPersistenceWorker();

  const handleShutdown = async (signal) => {
    console.log(`Received ${signal}, closing chat persistence worker...`);
    try {
      await worker.close();
      console.log('Chat persistence worker closed successfully.');
      process.exit(0);
    } catch (err) {
      console.error('Error during chat persistence worker shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

module.exports = { startChatPersistenceWorker, closeChatPersistenceWorker };
