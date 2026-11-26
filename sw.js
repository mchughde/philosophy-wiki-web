const CACHE_NAME = 'philwiki-v68';

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
  // cache: 'reload' skips the browser's own 10-minute copy (GitHub Pages sends max-age=600),
  // so a new version is picked up at once rather than the old files being stored again.
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(PRECACHE.map(u => new Request(u, { cache: 'reload' }))))
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
  const url = new URL(event.request.url);
  if (url.hostname === 'api.github.com') return;

  // The app's own files: always check with the server ('no-cache'), never the browser's
  // 10-minute copy, so a change shows up the next time the page is opened.
  const fresh = url.origin === self.location.origin
    ? fetch(event.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    : fetch(event.request);
  event.respondWith(
    fresh.then(response => {
      if (!response || response.status !== 200) return response;
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      return response;
    }).catch(() => caches.match(event.request))
  );
});
