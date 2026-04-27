const CACHE_NAME = 'tikona-pwa-cache-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('[Service Worker] Installed');
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
    console.log('[Service Worker] Activated');
});

self.addEventListener('fetch', (event) => {
    // Basic network-first strategy for PWA installability
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
