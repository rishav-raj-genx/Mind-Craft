const { db } = require('./src/config/firebase');
const { COLLECTION_MESSAGES, COLLECTION_CHATS } = require('./src/utils/constants');

async function check() {
  const snapshot = await db.collection(COLLECTION_MESSAGES).get();
  for (const doc of snapshot.docs) {
    const chats = await doc.ref.collection(COLLECTION_CHATS).get();
    console.log(`Match ${doc.id} has ${chats.size} messages`);
  }
  process.exit(0);
}
check();
