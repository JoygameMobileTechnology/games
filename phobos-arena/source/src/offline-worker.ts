import { deploymentBasePath, offlineCachePrefix } from "./deployment-path";

/** Generate a worker whose cache is tied to the exact built bytes, including HTML. */
export function offlineWorkerSource(files: Record<string, string>, version: string, base = "/"): string {
  const directory = deploymentBasePath(base);
  if (!Object.hasOwn(files, directory) || !Object.hasOwn(files, directory + "index.html") ||
      Object.entries(files).some(([path, digest]) => !path.startsWith(directory) || path.startsWith("//") ||
        new URL(path, "https://phobos.invalid").pathname !== path || !/^[a-f0-9]{64}$/.test(digest)))
    throw new Error("Offline pack paths and hashes must belong to this deployment.");
  return `
const BASE = ${JSON.stringify(directory)};
const SCOPE = new URL(BASE, self.location.origin).href;
const INDEX = BASE + 'index.html';
const CACHE_PREFIX = ${JSON.stringify(offlineCachePrefix(directory))};
const CACHE = CACHE_PREFIX + ${JSON.stringify(version)};
const FILES = ${JSON.stringify(files)};
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
`;
}
