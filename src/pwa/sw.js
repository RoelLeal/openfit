/**
 * OpenFit service worker.
 * scripts/pwa-plugin.ts replaces the two placeholders at build time.
 *
 * Strategy: precache the whole app (it is small), serve it cache-first and
 * answer every navigation with the cached app shell. New versions install in
 * the background and wait until the user accepts the update.
 */
const VERSION = self.__PRECACHE_VERSION__;
const FILES = self.__PRECACHE_FILES__;
const PREFIX = 'openfit-';
const CACHE = `${PREFIX}${VERSION}`;
const SHELL = 'index.html';

const toUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // `reload` bypasses the HTTP cache so we never precache stale files.
      cache.addAll(FILES.map((file) => new Request(toUrl(file), { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches
        .open(CACHE)
        .then((cache) => cache.match(toUrl(SHELL), { ignoreVary: true }))
        .then((response) => response ?? fetch(request)),
    );
    return;
  }

  // Module scripts are CORS requests (with an Origin header) while the precache was filled
  // without one; ignoreVary keeps a "Vary: Origin" response header from causing a miss.
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) => cache.match(request.url, { ignoreVary: true }))
      .then((response) => response ?? fetch(request)),
  );
});
