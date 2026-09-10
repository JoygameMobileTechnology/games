import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { runInNewContext } from "node:vm";
import { offlineWorkerSource } from "../src/offline-worker.ts";
import { startOfflineCache } from "../src/offline.ts";
import { deploymentAssetPath, deploymentBasePath, offlineCachePrefix } from "../src/deployment-path.ts";

const digest = (body: string) => createHash("sha256").update(body).digest("hex");
function workerHarness(base = "/") {
  const scope = `https://phobos.test${base}`;
  const cacheName = `${offlineCachePrefix(base)}test`;
  const content = new Map([[base, "<html>old</html>"], [base + "index.html", "<html>old</html>"], [base + "game-old.js", "old game"], [base + "mark.svg", "mark"]]);
  const files = Object.fromEntries([...content].map(([path, body]) => [path, digest(body)]));
  const packs = new Map<string, Map<string, Response>>();
  const listeners = new Map<string, (event: any) => void>();
  const messages: unknown[] = [], requests: string[] = [];
  const clients = [{ url: scope, postMessage(message: unknown) { messages.push(message); } }];
  const registration = { scope };
  let skipWaiting = 0, claims = 0, failWrite = false, offline = false;
  const key = (request: string | Request) => new URL(typeof request === "string" ? request : request.url, "https://phobos.test").pathname;
  const caches = {
    async open(name: string) {
      if (!packs.has(name)) packs.set(name, new Map());
      const pack = packs.get(name)!;
      return {
        async match(request: string | Request) { return pack.get(key(request))?.clone(); },
        async put(request: string | Request, response: Response) {
          if (failWrite) throw new Error("Quota exceeded");
          pack.set(key(request), response.clone());
        },
      };
    },
    async keys() { return [...packs.keys()]; },
    async delete(name: string) { return packs.delete(name); },
  };
  class LocalRequest extends Request {
    constructor(input: string | Request, init?: RequestInit) {
      super(typeof input === "string" ? new URL(input, "https://phobos.test") : input, init);
    }
  }
  runInNewContext(offlineWorkerSource(files, "test", base), {
    caches, Request: LocalRequest, Response, URL, crypto: webcrypto,
    fetch: async (request: Request) => {
      requests.push(key(request));
      if (offline) throw new Error("Network unavailable");
      return new Response(content.get(key(request)) ?? "not found", { status: content.has(key(request)) ? 200 : 404 });
    },
    self: {
      location: { origin: "https://phobos.test" },
      registration,
      addEventListener(type: string, listener: (event: any) => void) { listeners.set(type, listener); },
      async skipWaiting() { skipWaiting++; },
      clients: {
        async claim() { claims++; },
        async matchAll() { return clients; },
      },
    },
  });
  const dispatch = async (type: string, extra: Record<string, unknown> = {}) => {
    const waits: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    listeners.get(type)!({
      waitUntil(promise: Promise<unknown>) { waits.push(promise); },
      respondWith(promise: Promise<Response>) { response = promise; }, ...extra,
    });
    await Promise.all(waits);
    return response ? await response : undefined;
  };
  const verify = async (repair = false) => {
    let status: any;
    await dispatch("message", { data: { type: "PHOBOS_OFFLINE_VERIFY", scope, repair }, source: { url: scope }, ports: [{ postMessage(data: unknown) { status = data; } }] });
    return status;
  };
  return { content, packs, requests, messages, dispatch, verify, clients, registration, scope, cacheName,
    cache: () => packs.get(cacheName)!,
    failWrite(value: boolean) { failWrite = value; }, offline(value: boolean) { offline = value; },
    skipWaiting: () => skipWaiting, claims: () => claims,
  };
}

test("offline install verifies every built byte and never forces an update over open game tabs", async () => {
  const h = workerHarness();
  const oldPack = `${offlineCachePrefix("/")}old`;
  h.packs.set(oldPack, new Map([["/index.html", new Response("prior game")]]));
  h.packs.set("phobos-v2-old", new Map());
  await h.dispatch("install");
  assert.equal(h.skipWaiting(), 0);
  assert.equal(h.claims(), 0);
  assert.ok(h.packs.has(oldPack), "install preserves the pack used by other tabs");
  assert.equal((await h.verify()).complete, true);
  // Browser dispatches activate only when old controlled clients are gone.
  await h.dispatch("activate");
  assert.equal(h.claims(), 1);
  assert.equal(h.packs.has(oldPack), false);
  assert.equal(h.packs.has("phobos-v2-old"), true, "ambiguous unscoped legacy caches are not ours to delete");
});

test("offline verification detects evicted and corrupted assets; repair restores the exact pack", async () => {
  const h = workerHarness();
  await h.dispatch("install");
  h.cache().delete("/game-old.js");
  h.cache().set("/mark.svg", new Response("corrupt bytes"));
  const missing = await h.verify();
  assert.equal(missing.complete, false);
  assert.equal(missing.missing, 2);
  assert.equal((await h.verify(true)).complete, true);
  assert.equal(await h.cache().get("/mark.svg")!.text(), "mark");
});

test("old offline cache cannot be repaired with newer HTML or assets after deployment", async () => {
  const h = workerHarness();
  await h.dispatch("install");
  h.cache().delete("/index.html");
  h.cache().delete("/mark.svg");
  h.content.set("/index.html", "<html>new deployment</html>");
  const status = await h.verify(true);
  assert.equal(status.complete, false);
  assert.equal(status.failed, true);
  assert.equal(h.cache().has("/index.html"), false);
  assert.equal(h.cache().has("/mark.svg"), false, "all requested responses validate before writing any repair");
  assert.equal(await h.cache().get("/game-old.js")!.text(), "old game");
});

test("cache write failure during install preserves the previously playable version", async () => {
  const h = workerHarness();
  h.packs.set("phobos-v2-old", new Map([["/index.html", new Response("prior game")]]));
  h.failWrite(true);
  await assert.rejects(h.dispatch("install"), /Quota/);
  assert.equal(h.packs.has(h.cacheName), false);
  assert.ok(h.packs.has("phobos-v2-old"));
  assert.deepEqual(JSON.parse(JSON.stringify(h.messages)), [{ type: "PHOBOS_OFFLINE_FAILED", scope: h.scope }]);
  assert.equal(h.skipWaiting(), 0);
});

test("failed repairs remain explicit and incomplete activation cannot delete old packs", async () => {
  const h = workerHarness();
  await h.dispatch("install");
  h.packs.set("phobos-v2-old", new Map());
  h.cache().delete("/game-old.js");
  h.offline(true);
  assert.equal((await h.verify(true)).failed, true);
  await h.dispatch("activate");
  assert.equal(h.claims(), 0);
  assert.ok(h.packs.has("phobos-v2-old"));
});

test("cached room links launch offline while LAN endpoints always remain live", async () => {
  const h = workerHarness();
  await h.dispatch("install");
  h.offline(true);
  const request = { url: "https://phobos.test/?room=ABC123", method: "GET", mode: "navigate" };
  const response = await h.dispatch("fetch", { request });
  assert.equal(await response!.text(), "<html>old</html>");
  for (const path of ["/api/lan", "/lan"]) {
    assert.equal(await h.dispatch("fetch", { request: { ...request, url: "https://phobos.test" + path } }), undefined);
  }
});

function pageHarness(t: TestContext, secure = true, withActive = true, registrationFails = false, base = "/") {
  const scope = `https://phobos.test${base}`;
  const scriptURL = `${scope}sw.js`;
  const statuses: string[] = [];
  const worker = Object.assign(new EventTarget(), {
    scriptURL,
    state: "activated",
    calls: [] as unknown[],
    response: { type: "PHOBOS_OFFLINE_STATUS", scope, complete: true, missing: 0, failed: false },
    postMessage(message: unknown, ports: MessagePort[]) {
      this.calls.push(message); ports[0].postMessage(this.response); ports[0].close();
    },
  });
  const registration = Object.assign(new EventTarget(), {
    scope,
    active: withActive ? worker : null,
    waiting: null as typeof worker | null,
    installing: null as typeof worker | null,
  });
  let resolveReady!: (value: unknown) => void;
  const serviceWorker = Object.assign(new EventTarget(), {
    registered: [] as unknown[], lookedUp: [] as unknown[],
    register: async (url: string, options: unknown) => {
      serviceWorker.registered.push({ url, options });
      if (registrationFails) throw new Error("Worker script cannot be fetched while server is offline");
      return registration;
    },
    getRegistration: async (scope: string) => { serviceWorker.lookedUp.push(scope); return registration; },
    ready: withActive ? Promise.resolve(registration) : new Promise(resolve => { resolveReady = resolve; }),
  });
  const window = Object.assign(new EventTarget(), { isSecureContext: secure });
  const document = Object.assign(new EventTarget(), { hidden: false });
  for (const [key, value] of Object.entries({ navigator: { serviceWorker }, window, document, location: new URL(scope) })) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true });
    t.after(() => previous ? Object.defineProperty(globalThis, key, previous) : Reflect.deleteProperty(globalThis, key));
  }
  const manager = startOfflineCache(status => statuses.push(status), base);
  t.after(() => manager.dispose());
  return { manager, worker, registration, serviceWorker, window, document, statuses, scope, scriptURL,
    ready() { registration.active = worker; resolveReady(registration); },
    async flush() { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); },
  };
}

test("page status requires successful pack verification, not service-worker readiness", async (t) => {
  const h = pageHarness(t, true, false);
  await h.flush();
  assert.equal(h.statuses.at(-1), "Verifying offline pack");
  h.worker.response = { type: "PHOBOS_OFFLINE_STATUS", scope: h.scope, complete: false, missing: 1, failed: true };
  h.ready();
  await h.flush();
  assert.match(h.statuses.at(-1)!, /unavailable/);
  assert.ok(!h.statuses.includes("Cached for offline play"));
});

test("page reports safe waiting updates and rechecks eviction without forcing activation", async (t) => {
  const h = pageHarness(t);
  await h.flush();
  assert.equal(h.statuses.at(-1), "Cached for offline play");
  h.registration.waiting = h.worker;
  await h.manager.verify();
  assert.match(h.statuses.at(-1)!, /close all Phobos tabs/);
  assert.ok(h.worker.calls.every((call: any) => call.type === "PHOBOS_OFFLINE_VERIFY"));
  h.worker.response = { type: "PHOBOS_OFFLINE_STATUS", scope: h.scope, complete: false, missing: 1, failed: false };
  h.window.dispatchEvent(new Event("focus"));
  await h.flush();
  assert.match(h.statuses.at(-1)!, /incomplete/);
  const count = h.worker.calls.length;
  h.manager.dispose();
  h.window.dispatchEvent(new Event("focus"));
  assert.equal(h.worker.calls.length, count);
});

test("plain LAN HTTP states the server requirement without claiming offline readiness", async (t) => {
  const h = pageHarness(t, false);
  await h.flush();
  assert.match(h.statuses.at(-1)!, /Local server required/);
  assert.equal(h.worker.calls.length, 0);
});

test("offline cold start verifies the existing active pack when worker registration cannot reach the server", async (t) => {
  const h = pageHarness(t, true, true, true);
  await h.flush();
  assert.equal(h.statuses.at(-1), "Cached for offline play");
  assert.equal(h.worker.calls.length, 1, "existing active worker actually verifies the cached bytes");
  assert.ok(!h.statuses.some(status => /unavailable/.test(status)));
});

test("registration failure without an existing active worker reports unavailable without waiting forever on ready", async (t) => {
  const h = pageHarness(t, true, false, true);
  await h.flush();
  assert.match(h.statuses.at(-1)!, /Offline cache unavailable/);
  assert.equal(h.worker.calls.length, 0);
});

const nestedBase = "/games/phobos-arena/";

test("deployment paths keep root and Pages assets canonical without allowing sibling traversal", () => {
  assert.equal(deploymentBasePath(), "/");
  assert.equal(deploymentBasePath("/games/phobos-arena"), nestedBase);
  assert.equal(deploymentAssetPath("/", "assets/game.js"), "/assets/game.js");
  assert.equal(deploymentAssetPath(nestedBase, "assets/game.js"), `${nestedBase}assets/game.js`);
  for (const base of ["./", "https://other.test/", "//other.test/", "/games/../", "/games/%2e%2e/", "/games/?query", "/games/#hash", "/games//phobos/"])
    assert.throws(() => deploymentBasePath(base), undefined, base);
  for (const asset of ["../pacman/sw.js", "/assets/game.js", "assets//game.js", "assets/game.js?query", ""])
    assert.throws(() => deploymentAssetPath(nestedBase, asset), undefined, asset);
});

test("nested offline pack fetches only its own deployment and launches both entry URLs offline", async () => {
  const h = workerHarness(nestedBase);
  await h.dispatch("install");
  assert.ok(h.requests.length > 0 && h.requests.every(path => path.startsWith(nestedBase)));
  assert.equal((await h.verify()).complete, true);
  h.offline(true);
  for (const path of [nestedBase, `${nestedBase}index.html?room=ABC123`]) {
    const response = await h.dispatch("fetch", { request: { method: "GET", mode: "navigate", url: `https://phobos.test${path}` } });
    assert.equal(await response!.text(), "<html>old</html>");
  }
  const asset = await h.dispatch("fetch", { request: { method: "GET", mode: "cors", url: `https://phobos.test${nestedBase}game-old.js` } });
  assert.equal(await asset!.text(), "old game");
});

for (const base of ["/", nestedBase]) test(`${base} worker never rewrites hub, sibling, deep-page or LAN navigation`, async () => {
  const h = workerHarness(base);
  await h.dispatch("install"); h.offline(true);
  for (const path of ["/games/", "/games/pacman-vs/", "/games/terra-bellum/index.html", `${base}unknown-page`, "/api/lan", "/lan"])
    assert.equal(await h.dispatch("fetch", { request: { method: "GET", mode: "navigate", url: `https://phobos.test${path}` } }), undefined, path);
  assert.equal(await h.dispatch("fetch", { request: { method: "GET", mode: "navigate", url: `https://other.test${base}` } }), undefined);
  assert.equal(await h.dispatch("fetch", { request: { method: "POST", mode: "cors", url: `https://phobos.test${base}index.html` } }), undefined);
});

for (const base of ["/", nestedBase]) test(`${base} activation deletes only its own retired packs, preserving sibling and legacy caches`, async () => {
  const h = workerHarness(base);
  const ownOld = `${offlineCachePrefix(base)}previous`;
  const unrelated = [["/", nestedBase, "/games/phobos-arena-preview/", "/games/phobos-arena/preview/"]
    .filter(path => path !== base).map(path => `${offlineCachePrefix(path)}current`), "phobos-v3-old", "pmvs-v2", "tb-v1-shell", "other-app"].flat();
  for (const name of [ownOld, ...unrelated]) h.packs.set(name, new Map());
  await h.dispatch("install");
  assert.equal(h.packs.has(ownOld), true, "install never retires a currently active pack");
  await h.dispatch("activate");
  assert.equal(h.packs.has(ownOld), false);
  assert.equal(h.packs.has(h.cacheName), true);
  for (const name of unrelated) assert.equal(h.packs.has(name), true, name);
});

test("verification messages cannot read or repair another deployment's cache", async () => {
  const h = workerHarness(nestedBase);
  await h.dispatch("install"); h.cache().delete(`${nestedBase}game-old.js`);
  const requestCount = h.requests.length;
  for (const [scope, source] of [
    ["https://phobos.test/games/other/", h.scope],
    [h.scope, "https://phobos.test/games/pacman-vs/"],
    [h.scope, "https://phobos.test/games/phobos-arena/preview/"],
    [h.scope, "https://other.test/games/phobos-arena/"],
  ]) {
    let answered = false;
    await h.dispatch("message", { data: { type: "PHOBOS_OFFLINE_VERIFY", scope, repair: true }, source: { url: source }, ports: [{ postMessage() { answered = true; } }] });
    assert.equal(answered, false);
  }
  assert.equal(h.requests.length, requestCount);
  assert.equal(h.cache().has(`${nestedBase}game-old.js`), false);
  assert.equal((await h.verify(true)).complete, true);
});

test("failed install notifies only this game's entry pages and includes their scope", async () => {
  const h = workerHarness(nestedBase), otherMessages: unknown[] = [], indexMessages: unknown[] = [];
  h.clients.push({ url: `${h.scope}index.html?room=CODE`, postMessage(message) { indexMessages.push(message); } });
  for (const url of ["https://phobos.test/games/", "https://phobos.test/games/pacman-vs/", `${h.scope}preview/`, "https://other.test/games/phobos-arena/"])
    h.clients.push({ url, postMessage(message) { otherMessages.push(message); } });
  h.failWrite(true); await assert.rejects(h.dispatch("install"));
  assert.equal(h.messages.length, 1); assert.equal(indexMessages.length, 1); assert.equal(otherMessages.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(h.messages[0])), { type: "PHOBOS_OFFLINE_FAILED", scope: h.scope });
});

test("a worker installed under the wrong scope does not download, claim or delete other packs", async () => {
  const h = workerHarness(nestedBase);
  h.registration.scope = `${h.scope}source/`;
  const legitimate = new Map([[`${nestedBase}index.html`, new Response("legitimate active build")]]);
  h.packs.set(h.cacheName, legitimate);
  h.packs.set("pmvs-v2", new Map());
  await assert.rejects(h.dispatch("install"), /scope does not match/);
  assert.equal(h.requests.length, 0); assert.equal(h.claims(), 0); assert.equal(h.packs.has("pmvs-v2"), true);
  assert.equal(h.packs.get(h.cacheName), legitimate, "a misregistered copy cannot delete the real scope's same-build cache");
  assert.equal(await h.cache().get(`${nestedBase}index.html`)!.text(), "legitimate active build");
});

test("generated workers reject manifests containing foreign paths or invalid hashes", () => {
  const files = { [nestedBase]: digest("entry"), [`${nestedBase}index.html`]: digest("entry") };
  for (const extra of [
    { "/games/pacman-vs/index.html": digest("other") },
    { [`${nestedBase}../index.html`]: digest("other") },
    { [`${nestedBase}game.js`]: "not-a-hash" },
  ]) assert.throws(() => offlineWorkerSource({ ...files, ...extra }, "test", nestedBase), /paths and hashes/);
});

for (const base of ["/", nestedBase]) test(`page explicitly registers and verifies the ${base} worker and scope`, async (t) => {
  const h = pageHarness(t, true, true, false, base);
  await h.flush();
  assert.deepEqual(h.serviceWorker.registered, [{ url: h.scriptURL, options: { scope: h.scope, updateViaCache: "none" } }]);
  assert.equal(h.statuses.at(-1), "Cached for offline play");
  assert.deepEqual(h.worker.calls, [{ type: "PHOBOS_OFFLINE_VERIFY", scope: h.scope, repair: true }]);
});

test("offline fallback refuses a broader hub registration even when it is active", async (t) => {
  const h = pageHarness(t, true, true, true, nestedBase);
  h.registration.scope = "https://phobos.test/games/";
  h.worker.scriptURL = "https://phobos.test/games/sw.js";
  await h.flush();
  assert.deepEqual(h.serviceWorker.lookedUp, [h.scope]);
  assert.equal(h.worker.calls.length, 0);
  assert.match(h.statuses.at(-1)!, /unavailable/);
});

test("matching scope alone cannot validate a different worker script", async (t) => {
  const h = pageHarness(t, true, true, true, nestedBase);
  h.worker.scriptURL = `${h.scope}other-app-worker.js`;
  await h.flush();
  assert.equal(h.worker.calls.length, 0);
  assert.match(h.statuses.at(-1)!, /unavailable/);
});

test("an ancestor ready promise cannot replace the new game's pending registration", async (t) => {
  const h = pageHarness(t, true, false, false, nestedBase);
  const ancestor = Object.assign(new EventTarget(), { scope: "https://phobos.test/games/", active: h.worker, waiting: null, installing: null });
  h.serviceWorker.ready = Promise.resolve(ancestor);
  h.worker.state = "installing"; h.registration.installing = h.worker;
  await h.flush();
  assert.equal(h.worker.calls.length, 0);
  assert.equal(h.statuses.at(-1), "Verifying offline pack");
  h.registration.active = h.worker; h.registration.installing = null; h.worker.state = "activated";
  h.worker.dispatchEvent(new Event("statechange"));
  await h.flush();
  assert.equal(h.statuses.at(-1), "Cached for offline play");
  assert.equal(h.worker.calls.length, 1);
});

test("page ignores failure notifications from sibling scopes and unrelated worker scripts", async (t) => {
  const h = pageHarness(t, true, true, false, nestedBase);
  await h.flush();
  for (const [scope, source] of [["https://phobos.test/games/other/", h.worker], [h.scope, { scriptURL: `${h.scope}other.js` }]] as const)
    h.serviceWorker.dispatchEvent(Object.assign(new Event("message"), { data: { type: "PHOBOS_OFFLINE_FAILED", scope }, source }));
  await h.flush();
  assert.equal(h.statuses.at(-1), "Cached for offline play");
  assert.equal(h.worker.calls.length, 1);
  h.serviceWorker.dispatchEvent(Object.assign(new Event("message"), { data: { type: "PHOBOS_OFFLINE_FAILED", scope: h.scope }, source: h.worker }));
  await h.flush();
  assert.match(h.statuses.at(-1)!, /Update failed/);
});

test("a status response for another scope never claims this pack is cached", async (t) => {
  const h = pageHarness(t, true, true, false, nestedBase);
  h.worker.response.scope = "https://phobos.test/games/other/";
  await h.flush();
  assert.match(h.statuses.at(-1)!, /unverified/);
  assert.ok(!h.statuses.includes("Cached for offline play"));
});
