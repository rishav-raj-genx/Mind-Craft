/* eslint-disable no-undef */
/**
 * firebase-messaging-sw.js — FCM Background Push Notification Service Worker
 *
 * This service worker handles push notifications when the Mindcraft PWA is
 * minimized or running in the background. It uses the Firebase compat SDK
 * loaded from CDN (service workers can't use ES modules).
 *
 * Notifications appear at the OS level just like native mobile push.
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ── Firebase Config (must match the main app's config) ───────────────
firebase.initializeApp({
  apiKey: 'AIzaSyCxTrD1MMH_WT8sjAfSt4WBaKkrwiycAjA',
  authDomain: 'mind-craft-5191e.firebaseapp.com',
  projectId: 'mind-craft-5191e',
  storageBucket: 'mind-craft-5191e.firebasestorage.app',
  messagingSenderId: '968921147477',
  appId: '1:968921147477:web:72b5449f75159c14aaccdc',
});

const messaging = firebase.messaging();

// ── Handle background messages ───────────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'Mindcraft';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.data?.tag || 'mindcraft-notification',
    data: {
      url: payload.data?.url || '/',
      matchId: payload.data?.matchId || null,
      type: payload.data?.type || 'general',
    },
    vibrate: [100, 50, 100],
    requireInteraction: false,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// ── Handle notification click — open or focus the Mindcraft PWA ──────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If the PWA is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: targetUrl,
          });
          return;
        }
      }
      // Otherwise, open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
