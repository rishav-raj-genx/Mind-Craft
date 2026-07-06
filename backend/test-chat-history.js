const { db } = require('./src/config/firebase');
const { COLLECTION_MESSAGES, COLLECTION_CHATS } = require('./src/utils/constants');

async function check() {
  const matchId = "CnKHQiWFqyUYnzgAPe6g";
  const limit = 50;
  try {
    let query = db
      .collection(COLLECTION_MESSAGES)
      .doc(matchId)
      .collection(COLLECTION_CHATS)
      .orderBy('timestamp', 'desc')
      .limit(limit);

    const snapshot = await query.get();
    const messages = snapshot.docs
      .map((d) => d.data())
      .reverse();
    
    console.log("Returned messages count:", messages.length);
    if(messages.length > 0) {
      console.log("First message:", messages[0]);
    }
  } catch(e) {
    console.error("Error:", e);
  }
  process.exit(0);
}
check();
