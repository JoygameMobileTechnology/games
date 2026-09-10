import { deploymentBasePath } from "./deployment-path";

export interface OfflineCache {
  /** Recheck the pack after storage eviction; repair only when explicitly requested. */
  verify(repair?: boolean): Promise<void>;
  dispose(): void;
}

type PackStatus = { type: "PHOBOS_OFFLINE_STATUS"; scope: string; complete: boolean; missing: number; failed: boolean };

/** No page reload or worker activation is forced, including when another tab is playing. */
export function startOfflineCache(onStatus: (status: string) => void, base = "/"): OfflineCache {
  const scope = new URL(deploymentBasePath(base), location.href).href;
  const scriptURL = new URL("sw.js", scope).href;
  let registration: ServiceWorkerRegistration | undefined;
  let disposed = false, checking = false, failedUpdate = false;
  let lastStatus = "";
  const cleanups: (() => void)[] = [];
  const watchedWorkers = new Set<ServiceWorker>();
  const ownWorker = (worker: ServiceWorker | null | undefined) => !!worker && worker.scriptURL === scriptURL;
  const ownRegistration = (candidate: ServiceWorkerRegistration | undefined): candidate is ServiceWorkerRegistration =>
    !!candidate && candidate.scope === scope &&
    [candidate.active, candidate.waiting, candidate.installing].every(worker => !worker || ownWorker(worker));
  const report = (status: string) => {
    if (!disposed && status !== lastStatus) { lastStatus = status; onStatus(status); }
  };
  const request = (worker: ServiceWorker, repair: boolean) => new Promise<PackStatus>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error("Worker did not verify the pack")); }, repair ? 15000 : 5000);
    channel.port1.onmessage = event => {
      if (event.data?.type !== "PHOBOS_OFFLINE_STATUS") return;
      clearTimeout(timer); channel.port1.close();
      if (event.data.scope !== scope || typeof event.data.complete !== "boolean" ||
          typeof event.data.failed !== "boolean" || typeof event.data.missing !== "number")
        reject(new Error("Worker returned a status for another deployment"));
      else resolve(event.data as PackStatus);
    };
    try { worker.postMessage({ type: "PHOBOS_OFFLINE_VERIFY", scope, repair }, [channel.port2]); }
    catch (error) { clearTimeout(timer); channel.port1.close(); channel.port2.close(); reject(error); }
  });
  const verify = async (repair = false) => {
    if (disposed || checking || !registration?.active) return;
    if (!ownRegistration(registration) || !ownWorker(registration.active)) {
      report("Offline cache unavailable — reconnect and reload"); return;
    }
    checking = true;
    try {
      const status = await request(registration.active, repair);
      if (!status.complete) report(status.failed
        ? "Offline pack unavailable — reconnect and reload to repair"
        : "Offline pack incomplete — reconnect and reload to repair");
      else if (registration.waiting) report("Cached offline · Update ready; close all Phobos tabs to apply");
      else if (failedUpdate) report("Cached for offline play · Update failed; retry when connected");
      else report("Cached for offline play");
    } catch {
      report("Offline pack unverified — close Phobos tabs and reopen");
    } finally { checking = false; }
  };
  const listen = (target: EventTarget, type: string, listener: EventListener) => {
    target.addEventListener(type, listener);
    cleanups.push(() => target.removeEventListener(type, listener));
  };
  const start = async () => {
    if (!window.isSecureContext || !("serviceWorker" in navigator)) {
      report("Local server required · Offline install needs HTTPS");
      return;
    }
    report("Verifying offline pack");
    listen(navigator.serviceWorker, "message", ((event: MessageEvent) => {
      if (event.data?.type === "PHOBOS_OFFLINE_FAILED" && event.data.scope === scope && ownWorker(event.source as ServiceWorker | null)) {
        failedUpdate = true;
        if (registration?.active) void verify();
        else report("Offline cache unavailable — reconnect and reload");
      }
    }) as EventListener);
    try {
      try {
        const requested = await navigator.serviceWorker.register(scriptURL, { scope, updateViaCache: "none" });
        if (!ownRegistration(requested)) throw new Error("Unexpected offline worker registration");
        registration = requested;
      } catch {
        // Registration checks the worker script on the network. A cached game
        // can still cold-start with its existing worker while the server is off.
        const existing = await navigator.serviceWorker.getRegistration(scope);
        if (!ownRegistration(existing) || !ownWorker(existing.active)) {
          report("Offline cache unavailable — reconnect and reload");
          return;
        }
        registration = existing;
      }
      if (disposed) return;
      const watch = () => {
        const worker = registration?.installing;
        if (!worker || !ownWorker(worker) || watchedWorkers.has(worker)) return;
        watchedWorkers.add(worker);
        listen(worker, "statechange", () => {
          if (worker.state === "installed" || worker.state === "activated") void verify();
          if (worker.state === "redundant") {
            failedUpdate = true;
            if (registration?.active) void verify();
            else report("Offline cache unavailable — reconnect and reload");
          }
        });
      };
      listen(registration, "updatefound", watch);
      watch();
      listen(navigator.serviceWorker, "controllerchange", () => { void verify(true); });
      listen(window, "online", () => { void verify(true); });
      listen(window, "focus", () => { void verify(); });
      listen(document, "visibilitychange", () => { if (!document.hidden) void verify(); });
      if (registration.active) await verify(true);
      // First install has no old worker. Activation/controllerchange verifies it;
      // readiness is never itself presented as proof that every asset is cached.
      else void navigator.serviceWorker.ready.then(ready => {
        // An ancestor hub worker can resolve ready before this game's first
        // installation. Never replace our registration with that unrelated one.
        if (!disposed && ownRegistration(ready) && ownWorker(ready.active)) {
          registration = ready; void verify(true);
        }
      }).catch(() => report("Offline cache unavailable — reconnect and reload"));
    } catch {
      report("Offline cache unavailable — reconnect and reload");
    }
  };
  void start();
  return { verify, dispose() { disposed = true; cleanups.splice(0).forEach(cleanup => cleanup()); } };
}
