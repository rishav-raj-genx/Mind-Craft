/**
 * sessionRouter.js — Session Lifecycle & FCM Push Notifications
 *
 * Manages tutoring session state transitions and triggers Firebase
 * Cloud Messaging notifications at key lifecycle events:
 *
 *   upcoming → completed → rated
 *                ↘ cancelled
 *
 * When a session transitions to "completed", the system pushes an FCM
 * notification to the learner prompting them to rate the session.
 */

const { db, admin }  = require('../config/firebase');
const {
  COLLECTION_SESSIONS,
  COLLECTION_USERS,
  SESSION_COMPLETED,
  SESSION_CANCELLED,
} = require('../utils/constants');

/**
 * Marks a session as completed and triggers a rating notification.
 *
 * @param {string} sessionId — The session document ID
 * @returns {Promise<{ success: boolean, notificationSent: boolean }>}
 */
async function completeSession(sessionId) {
  const sessionRef = db.collection(COLLECTION_SESSIONS).doc(sessionId);
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  }

  const session = sessionDoc.data();

  if (session.status === SESSION_COMPLETED) {
    return { success: true, notificationSent: false, message: 'Session already completed' };
  }

  // ── Update session status ───────────────────────────────────────
  await sessionRef.update({
    status:      SESSION_COMPLETED,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // ── Send FCM notification to the learner ────────────────────────
  let notificationSent = false;
  try {
    notificationSent = await sendRatingNotification(session.learnerUid, session);
  } catch (err) {
    console.warn('⚠️  Rating notification failed:', err.message);
  }

  console.log(`✅ Session ${sessionId} marked as completed`);
  return { success: true, notificationSent };
}

/**
 * Cancels a session.
 *
 * @param {string} sessionId
 * @returns {Promise<{ success: boolean }>}
 */
async function cancelSession(sessionId) {
  const sessionRef = db.collection(COLLECTION_SESSIONS).doc(sessionId);
  const sessionDoc = await sessionRef.get();

  if (!sessionDoc.exists) {
    throw Object.assign(new Error('Session not found'), { statusCode: 404 });
  }

  await sessionRef.update({
    status:      SESSION_CANCELLED,
    cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`❌ Session ${sessionId} cancelled`);
  return { success: true };
}

/**
 * Sends an FCM push notification prompting the learner to rate
 * a completed session.
 *
 * @param {string} learnerUid — UID of the learner
 * @param {object} session    — Session document data
 * @returns {Promise<boolean>}
 */
async function sendRatingNotification(learnerUid, session) {
  // Look up the learner's FCM token
  const userDoc = await db.collection(COLLECTION_USERS).doc(learnerUid).get();

  if (!userDoc.exists) return false;

  const fcmToken = userDoc.data().fcmToken;
  if (!fcmToken) {
    console.warn(`⚠️  No FCM token for user ${learnerUid}`);
    return false;
  }

  // Look up the teacher's name for the notification body
  let teacherName = 'your tutor';
  try {
    const teacherDoc = await db.collection(COLLECTION_USERS).doc(session.teacherUid).get();
    if (teacherDoc.exists) {
      teacherName = teacherDoc.data().name || teacherName;
    }
  } catch (_err) {
    // Non-fatal: use default name
  }

  const message = {
    token: fcmToken,
    notification: {
      title: '⭐ Rate Your Session',
      body:  `How was your ${session.skill} session with ${teacherName}? Tap to leave a rating.`,
    },
    data: {
      type:      'rate_session',
      sessionId: session.sessionId || '',
      matchId:   session.matchId   || '',
    },
    android: {
      priority: 'high',
      notification: {
        channelId:       'mindcraft_sessions',
        clickAction:     'OPEN_SESSION',
        defaultSound:    true,
        defaultVibrateTimings: true,
      },
    },
  };

  const response = await admin.messaging().send(message);
  console.log(`📲 Rating notification sent to ${learnerUid}:`, response);
  return true;
}

/**
 * Sends a generic notification to a user.
 *
 * @param {string} uid    — Recipient's UID
 * @param {string} title  — Notification title
 * @param {string} body   — Notification body
 * @param {object} [data] — Optional data payload
 */
async function sendNotification(uid, title, body, data = {}) {
  const userDoc = await db.collection(COLLECTION_USERS).doc(uid).get();
  if (!userDoc.exists) return false;

  const fcmToken = userDoc.data().fcmToken;
  if (!fcmToken) return false;

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data,
      android: { priority: 'high' },
    });
    return true;
  } catch (err) {
    console.warn(`⚠️  Notification to ${uid} failed:`, err.message);
    return false;
  }
}

module.exports = {
  completeSession,
  cancelSession,
  sendRatingNotification,
  sendNotification,
};
