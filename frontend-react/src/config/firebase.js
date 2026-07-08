import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ── FCM Messaging ────────────────────────────────────────────────────
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (err) {
  console.warn('FCM messaging not supported in this environment:', err.message);
}

/**
 * Request browser notification permission and retrieve the FCM registration token.
 * Returns the token string if granted, or null if denied/unavailable.
 */
export async function requestNotificationPermission() {
  if (!messaging) return null;
  if (!('Notification' in window)) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('VITE_FIREBASE_VAPID_KEY not set — FCM token retrieval skipped');
      return null;
    }

    // Register the FCM service worker
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: swRegistration,
    });

    if (token) {
      console.log('✅ FCM token retrieved');
      return token;
    }

    console.warn('No FCM token available');
    return null;
  } catch (err) {
    console.error('FCM permission/token error:', err);
    return null;
  }
}

/**
 * Subscribe to foreground FCM messages.
 * @param {function} callback - Called with the payload when a message is received.
 * @returns {function} unsubscribe
 */
export function onForegroundMessage(callback) {
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
