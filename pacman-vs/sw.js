// Service worker: precache the app shell, cache-first with background refresh.
// Version the cache name; skipWaiting + clients.claim so updates land fast
// (§16.3). Full vs-AI play must work offline (§2).
const CACHE = 'pmvs-v2';
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'data/maze_main.txt',
  'data/match.json',
  'data/attacks.json',
  'data/ai_profiles.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE)
        // hashed bundle files aren't statically known — pull them out of index.html
        .then(() => fetch('index.html').then((r) => r.text()))
        .then((html) => {
          const assets = [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+)"/g)].map((m) => m[1]);
          return c.addAll(assets);
        })
        .catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: false }).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
