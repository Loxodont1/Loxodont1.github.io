const CACHE_NAME = 'task-app-11v';

// Add all the files needed for the app shell
const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',    // <-- Add this
  '/icon-192.png',     // <-- Add this
  '/icon-512.png'      // <-- Add this
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Opened cache and caching files');
      return cache.addAll(FILES_TO_CACHE); // Use the new list
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return the cached response if found, otherwise fetch from network
      return response || fetch(event.request);
    })
  );
});

// 2. --- ADD THIS NEW SECTION ---
// This event activates the new service worker and cleans up old caches.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // If the cacheName is old (not our new CACHE_NAME), delete it.
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

