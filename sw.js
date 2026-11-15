const CACHE_NAME = 'philwiki-v64';

const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: always try to get fresh files, fall back to cache if offline
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  // Private entries come from the GitHub API with an access key: never cache those
  // responses here (the app stores the entries itself, in IndexedDB).
  if (new URL(event.request.url).hostname === 'api.github.com') return;

  event.respondWith(
    fetch(event.request).then(response => {
      if (!response || response.status !== 200) return response;
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
