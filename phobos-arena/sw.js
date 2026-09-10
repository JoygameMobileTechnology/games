
const BASE = "/games/phobos-arena/";
const SCOPE = new URL(BASE, self.location.origin).href;
const INDEX = BASE + 'index.html';
const CACHE_PREFIX = "phobos-v4-scope-%2Fgames%2Fphobos-arena%2F-";
const CACHE = CACHE_PREFIX + "efe024f928d5132fbc52cdbbb264d4ed05eeb5f10ef72b46d20d9b6d94ac790e";
const FILES = {"/games/phobos-arena/assets/index-82mWro9H.css":"5488e98d16ce73fe586d0dedafb88594d42d6b870d44cbffb24c096d32da0411","/games/phobos-arena/assets/index-Cnolm2ZH.js":"8269e686c264839db08d578129a52acd4ce38e6320850fdc922c81684ef01366","/games/phobos-arena/assets/ritual-basalt-01vFeGKI.png":"59043c91a267381ee7829e8bb0f8b62eabed8d083428e13f2a749eeaed649411","/games/phobos-arena/index.html":"b006c56d12b0e8de7e68ee6c39a93c8efbfe9dcf1a9f8a4052c744d9b0252b42","/games/phobos-arena/mark.svg":"5f58ef702d9f87ddd5a6c0ec77db59b85556151618cc3e63a524d92139035340","/games/phobos-arena/":"b006c56d12b0e8de7e68ee6c39a93c8efbfe9dcf1a9f8a4052c744d9b0252b42"};
const PATHS = Object.keys(FILES);
function ownEntry(value) {
  try {
    const url = new URL(value);
    return url.origin === self.location.origin && (url.pathname === BASE || url.pathname === INDEX);
  } catch { return false; }
}
async function valid(response, path) {
  if (!response || !response.ok) return false;
  const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('') === FILES[path];
}
async function missing(cache) {
  const checks = await Promise.all(PATHS.map(async path =>
    await valid(await cache.match(path, { ignoreVary: true }), path) ? null : path));
  return checks.filter(Boolean);
}
async function download(paths) {
  // Validate every response before writing any of them. An old worker must never
  // repair its HTML from a newer deployment and create a mixed offline version.
  return Promise.all(paths.map(async path => {
    const response = await fetch(new Request(path, { cache: 'reload' }));
    if (!await valid(response, path)) throw new Error('Offline pack version mismatch: ' + path);
    return [path, response];
  }));
}
async function notify(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.filter(client => ownEntry(client.url)).forEach(client => client.postMessage({ ...message, scope: SCOPE }));
}
self.addEventListener('install', event => event.waitUntil((async () => {
  // A misregistered copy has no ownership of this deployment's staging cache.
  // Reject it before cleanup can touch a valid same-build pack in another scope.
  if (self.registration.scope !== SCOPE) throw new Error('Offline worker scope does not match this deployment');
  try {
    const responses = await download(PATHS);
    const cache = await caches.open(CACHE);
    await Promise.all(responses.map(([path, response]) => cache.put(path, response)));
    if ((await missing(cache)).length) throw new Error('Offline pack did not persist');
    // Deliberately no skipWaiting: an update activates only after ALL existing
    // game tabs close, protecting solo, paused and LAN matches in other tabs.
  } catch (error) {
    await caches.delete(CACHE);
    await notify({ type: 'PHOBOS_OFFLINE_FAILED' });
    throw error;
  }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  if ((await missing(cache)).length) return;
  // Natural activation retires only this registration's old packs. CacheStorage
  // belongs to the origin, so sibling games and unscoped legacy caches stay intact.
  await Promise.all((await caches.keys()).filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'PHOBOS_OFFLINE_VERIFY' || event.data.scope !== SCOPE ||
      !ownEntry(event.source?.url) || !event.ports?.[0]) return;
  event.waitUntil((async () => {
    let absent = PATHS, failed = false;
    try {
      const cache = await caches.open(CACHE);
      absent = await missing(cache);
      if (absent.length && event.data.repair === true) {
        try {
          const responses = await download(absent);
          await Promise.all(responses.map(([path, response]) => cache.put(path, response)));
        } catch { failed = true; }
        absent = await missing(cache);
      }
    } catch { failed = true; }
    event.ports[0].postMessage({ type: 'PHOBOS_OFFLINE_STATUS', version: CACHE, scope: SCOPE,
      complete: absent.length === 0, missing: absent.length, failed });
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin ||
      url.pathname.startsWith('/api/') || url.pathname === '/lan') return;
  if (event.request.mode === 'navigate' && !ownEntry(url.href)) return;
  const path = url.pathname === BASE ? INDEX : url.pathname;
  if (!Object.hasOwn(FILES, path)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(path, { ignoreVary: true });
    if (cached) return cached;
    const response = await fetch(event.request);
    if (await valid(response, path)) await cache.put(path, response.clone()).catch(() => {});
    return response;
  })());
});
