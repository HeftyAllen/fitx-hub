importScripts(new URL('offline-worker.js', self.registration.scope).href);
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging();

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification?.data?.FCM_MSG?.data?.path || '/dashboard';
  const base = new URL(self.registration.scope).pathname;
  const target = base === '/' ? new URL(path, self.location.origin) : new URL(`${base}#/${path.replace(/^\/+/, '')}`, self.location.origin);
  if (target.origin === self.location.origin) event.waitUntil(clients.openWindow(target.href));
});
