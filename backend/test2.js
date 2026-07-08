const axios = require('axios');
const admin = require('firebase-admin');

async function run() {
  const { db } = require('./src/config/firebase');
  // 1. Get a random user with matches
  const snapshot = await db.collection('matches').limit(1).get();
  const match = snapshot.docs[0].data();
  const uid = match.user1Uid;
  console.log(`Using UID: ${uid}`);

  // 2. Create custom token
  const customToken = await admin.auth().createCustomToken(uid);
  
  // 3. Exchange for ID token using Firebase REST API (requires Web API Key, maybe I can just fake the request directly to express)
  // Instead, let's just test the handler function directly!
}
