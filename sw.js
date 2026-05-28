// Forma Service Worker — offline-first app shell caching
const CACHE_NAME = 'forma-v1';

// App shell assets to cache on install
const SHELL = [
  './',
  './index.html',
  './manifest.json',
];

// CDN assets cached on first use
const CDN_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'unpkg.com',
];

// Never cache these — always needs network
const BYPASS_PATTERNS = [
  'googleapis.com/drive',
  'googleapis.com/oauth2',
  'googleapis.com/upload',
  'accounts.google.com',
  'googleusercontent.com/oauth2',
];

// ── Install: cache the app shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: stale-while-revalidate for shell, network-only for APIs ────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Bypass: Google API calls always go to network
  if (BYPASS_PATTERNS.some(p => url.includes(p))) {
    return; // let browser handle normally
  }

  // CDN / fonts / local files: cache-first, update in background
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached); // if offline, fall back to cached

      // Return cached immediately if available, revalidate in background
      return cached || networkFetch;
    })
  );
});
