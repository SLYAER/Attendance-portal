/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import { precacheAndRoute } from 'workbox-precaching';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';

// Precache assets
precacheAndRoute(self.__WB_MANIFEST);

// Background Sync
const bgSyncPlugin = new BackgroundSyncPlugin('api-sync-queue', {
  maxRetentionTime: 24 * 60 // Retry for max of 24 Hours
});

registerRoute(
  /\/api\/.*/,
  new NetworkOnly({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);

registerRoute(
  /\/api\/.*/,
  new NetworkOnly({
    plugins: [bgSyncPlugin]
  }),
  'PUT'
);

// Periodic Background Sync
self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'data-sync') {
    event.waitUntil(Promise.resolve()); // Placeholder for actual sync logic
  }
});

// Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Attendance Update', body: 'Please check your attendance status.' };
  
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data.url || '/'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(urlToOpen);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
