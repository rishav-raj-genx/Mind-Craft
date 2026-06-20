/**
 * firebase.js — Firebase Admin SDK Initialization
 *
 * Initializes the Admin SDK using a local service account key file.
 * Exports Firestore, Auth, and Realtime Database instances for use
 * across all backend services.
 *
 * The Firebase project (mind-craft-4f16c) is shared with the existing
 * Kotlin Android app, so all Firestore collections are fully compatible.
 */

const admin = require('firebase-admin');
const path  = require('path');
const fs    = require('fs');

// ── Resolve the service account key path ──────────────────────────────
const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
  ? path.resolve(__dirname, '../../', process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
  : path.resolve(__dirname, '../../serviceAccountKey.json');

let serviceAccount = null;

if (fs.existsSync(keyPath)) {
  serviceAccount = require(keyPath);
} else {
  console.warn(
    '⚠️  Firebase service account key not found at:',
    keyPath,
    '\n   → Download from Firebase Console → Project Settings → Service Accounts',
    '\n   → The server will start but Firebase operations will fail.',
  );
}

// ── Initialize the Admin app ──────────────────────────────────────────
if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL:
      process.env.FIREBASE_DATABASE_URL ||
      'https://mind-craft-4f16c-default-rtdb.firebaseio.com',
  });
  console.log('✅ Firebase Admin SDK initialized (project: mind-craft-4f16c)');
} else {
  // Initialize without credentials so the app can still start
  // (useful for development when key is not yet set up)
  admin.initializeApp({
    projectId: 'mind-craft-4f16c',
  });
  console.warn('⚠️  Firebase initialized in limited mode (no service account)');
}

// ── Export shared instances ───────────────────────────────────────────
const db   = admin.firestore();
const auth = admin.auth();

// Realtime Database — used by the chat WebSocket fallback
let rtdb = null;
try {
  rtdb = admin.database();
} catch (_err) {
  console.warn('⚠️  Realtime Database not available (missing databaseURL)');
}

module.exports = { admin, db, auth, rtdb };
