/**
 * Universal Service Worker (sw.js)
 * High-reliability background notifications and incoming-call alerts
 */

const CACHE_NAME = 'universal-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

// Install Event: cache core shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching static assets failed:', err);
      });
    })
  );
});

// Activate Event: claim clients and purge outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Push Event: Handle server or cloud push messages
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const type = data.type || 'notification';
    const title = data.title || (type === 'incoming_call' ? 'Incoming Call' : 'Universal Message');
    const options = {
      body: data.body || 'You have an incoming notification on Universal.',
      icon: data.icon || '/favicon.ico',
      badge: data.badge || '/favicon.ico',
      tag: data.tag || (type === 'incoming_call' ? `call-${data.callId}` : 'universal-alert'),
      renotify: true,
      requireInteraction: type === 'incoming_call',
      vibrate: type === 'incoming_call' ? [300, 150, 300, 150, 300] : [200, 100, 200],
      data: {
        url: data.url || '/',
        callId: data.callId,
        type: type,
        ...data,
      },
      actions: type === 'incoming_call'
        ? [
            { action: 'answer', title: 'Answer' },
            { action: 'decline', title: 'Decline' }
          ]
        : [],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.warn('[SW] Push parse error, fallback to text:', e);
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('Universal Notification', {
        body: text,
        icon: '/favicon.ico',
      })
    );
  }
});

// Notification Click Event: bring window to focus or answer call
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;

  // Build target URL with parameters so reopening the app from background/closed state
  // immediately carries the incoming call action and caller details
  let targetUrl = data.url || '/';
  if (data.callId && action) {
    const sep = targetUrl.includes('?') ? '&' : '?';
    targetUrl = `${targetUrl}${sep}callId=${encodeURIComponent(data.callId)}&callAction=${encodeURIComponent(action)}&callType=${encodeURIComponent(data.callType || 'audio')}`;
  } else if (data.callId) {
    const sep = targetUrl.includes('?') ? '&' : '?';
    targetUrl = `${targetUrl}${sep}callId=${encodeURIComponent(data.callId)}&callAction=open&callType=${encodeURIComponent(data.callType || 'audio')}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and post message
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            action,
            data,
            callId: data.callId,
          });
          return;
        }
      }

      // If no window is open, reopen the application with deep link URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Notification Close Event (e.g. dismissed by user)
self.addEventListener('notificationclose', (event) => {
  const data = event.notification.data || {};
  if (data.type === 'incoming_call' && data.callId) {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        client.postMessage({
          type: 'CALL_NOTIFICATION_DISMISSED',
          callId: data.callId,
        });
      }
    });
  }
});

// Message Event: Communication between main UI thread and Service Worker
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.type === 'SHOW_CALL_NOTIFICATION') {
    const { title, callerName, callType, callId } = msg;
    const callNotificationTitle = title || `Incoming ${callType === 'video' ? 'Video' : 'Audio'} Call`;
    
    self.registration.showNotification(callNotificationTitle, {
      body: `${callerName || 'Someone'} is calling you on Universal`,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `call-${callId}`,
      renotify: true,
      requireInteraction: true,
      vibrate: [350, 150, 350, 150, 350],
      data: {
        type: 'incoming_call',
        callId,
        callType,
      },
      actions: [
        { action: 'answer', title: 'Answer' },
        { action: 'decline', title: 'Decline' },
      ],
    });
  } else if (msg.type === 'CANCEL_CALL_NOTIFICATION') {
    self.registration.getNotifications({ tag: `call-${msg.callId}` }).then((notifications) => {
      notifications.forEach((n) => n.close());
    });
  }
});
