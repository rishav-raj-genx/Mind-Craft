const { db } = require('./src/config/firebase');
const { COLLECTION_MATCHES, COLLECTION_MESSAGES, COLLECTION_CHATS } = require('./src/utils/constants');

async function check() {
  const matchId = "CnKHQiWFqyUYnzgAPe6g";
  const chats = await db.collection(COLLECTION_MESSAGES).doc(matchId).collection(COLLECTION_CHATS).get();
  chats.docs.forEach(doc => {
    console.log(doc.id, doc.data());
  });
  
  const ordered = await db.collection(COLLECTION_MESSAGES).doc(matchId).collection(COLLECTION_CHATS).orderBy('timestamp', 'desc').get();
  console.log("Ordered count:", ordered.size);
  process.exit(0);
}
check();
