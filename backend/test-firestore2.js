const { db } = require('./src/config/firebase');
const { COLLECTION_MATCHES, COLLECTION_MESSAGES, COLLECTION_CHATS } = require('./src/utils/constants');

async function check() {
  const matches = await db.collection(COLLECTION_MATCHES).get();
  for (const doc of matches.docs) {
    const matchId = doc.id;
    const chats = await db.collection(COLLECTION_MESSAGES).doc(matchId).collection(COLLECTION_CHATS).get();
    console.log(`Match ${matchId} has ${chats.size} messages`);
  }
  process.exit(0);
}
check();
