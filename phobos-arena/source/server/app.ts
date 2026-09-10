import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import websocket from "@fastify/websocket";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import type { WebSocket } from "ws";
import { LAN_PROTOCOL, RECONNECT_MS, type ServerInfo, type ServerMessage } from "../src/lan/types.ts";
import { STEP } from "../src/rules.ts";
import { RoomManager, type CreateAuthority } from "./rooms.ts";

export interface LanServerOptions {
  port?: number; host?: string; advertise?: string[]; distDir?: string; version?: string;
  logger?: boolean; createAuthority?: CreateAuthority; now?: () => number; manualTick?: boolean;
  heartbeatIntervalMs?: number; heartbeatTimeoutMs?: number;
}
export const MAX_LAN_PAYLOAD = 16 * 1024;
export function lanAddresses(port: number, interfaces = networkInterfaces()): string[] {
  const addresses: string[] = [];
  for (const entries of Object.values(interfaces)) for (const entry of entries ?? []) {
    if (entry.internal) continue;
    const address = entry.address;
    if (entry.family === "IPv4" && (/^10\./.test(address) || /^192\.168\./.test(address) || /^172\.(1[6-9]|2\d|3[01])\./.test(address)))
      addresses.push(`http://${address}:${port}`);
    else if (entry.family === "IPv6" && /^f[cd][0-9a-f]{2}:/i.test(address)) addresses.push(`http://[${address}]:${port}`);
  }
  return [...new Set(addresses)];
}
const defaultAuthority: CreateAuthority = async options => {
  const { Game } = await import("../src/game.ts");
  return Game.createAuthority(options);
};

export async function createLanServer(options: LanServerOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: MAX_LAN_PAYLOAD });
  const manager = new RoomManager(options.createAuthority ?? defaultAuthority, options.now);
  const heartbeatPeers = new Map<WebSocket, { id: string; seenAt: number }>();
  const distDir = options.distDir ?? fileURLToPath(new URL("../dist", import.meta.url));
  const getInfo = (): ServerInfo => {
    const address = app.server.address();
    const port = address && typeof address === "object" ? address.port : (options.port ?? 4175);
    const addresses = options.advertise?.length ? options.advertise.map(value => value.replace(/\/$/, "")) : lanAddresses(port);
    return { protocol: LAN_PROTOCOL, version: options.version ?? "0.9.2", addresses,
      reconnectSeconds: RECONNECT_MS / 1000 };
  };
  await app.register(websocket, { options: { maxPayload: MAX_LAN_PAYLOAD, perMessageDeflate: false } });
  app.get("/api/lan", async () => getInfo());
  app.get("/lan", { websocket: true }, (socket, request) => {
    // Browsers must arrive from this local server, not an unrelated web page.
    const origin = request.headers.origin;
    if (origin) {
      try { if (new URL(origin).host !== request.headers.host) throw new Error("origin"); }
      catch { socket.close(1008, "Open the game from this LAN server."); return; }
    }
    const send = (message: ServerMessage) => {
      if (socket.readyState !== 1) return;
      if (socket.bufferedAmount > 1024 * 1024) { socket.close(1008, "Connection is too slow."); return; }
      socket.send(JSON.stringify(message));
    };
    const id = manager.connect({ send, close: (code, reason) => socket.close(code, reason) });
    if (!id) return;
    const heartbeat = { id, seenAt: performance.now() };
    heartbeatPeers.set(socket, heartbeat);
    socket.on("pong", () => { heartbeat.seenAt = performance.now(); });
    socket.on("message", (payload, binary) => {
      heartbeat.seenAt = performance.now();
      if (binary) { send({ type: "error", code: "invalid", message: "Send JSON text messages." }); return; }
      let value: unknown;
      try { value = JSON.parse(payload.toString()); }
      catch { send({ type: "error", code: "invalid", message: "Malformed JSON." }); return; }
      void manager.receive(id, value);
    });
    socket.on("close", () => { heartbeatPeers.delete(socket); manager.disconnect(id); });
    socket.on("error", () => { heartbeatPeers.delete(socket); manager.disconnect(id); });
  });
  if (existsSync(distDir)) {
    await app.register(fastifyStatic, { root: distDir, index: ["index.html"] });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith("/api/") || request.url.startsWith("/lan") || /\.[a-z0-9]+(?:\?|$)/i.test(request.url))
        return reply.code(404).send({ error: "Not found" });
      return reply.sendFile("index.html");
    });
  } else app.get("/", async (_, reply) => reply.code(503).type("text/plain").send("Build the game with npm run build, then restart the LAN server."));
  let interval: ReturnType<typeof setInterval> | undefined;
  let heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  app.addHook("onClose", async () => {
    if (interval) clearInterval(interval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatPeers.clear();
    if (!closed) { closed = true; manager.close(); }
  });
  return {
    app, manager, info: getInfo,
    async start() {
      const address = await app.listen({ port: options.port ?? 4175, host: options.host ?? "0.0.0.0" });
      heartbeatInterval = setInterval(() => {
        const now = performance.now();
        for (const [socket, heartbeat] of heartbeatPeers) {
          if (now - heartbeat.seenAt >= (options.heartbeatTimeoutMs ?? 6000)) {
            heartbeatPeers.delete(socket);
            manager.disconnect(heartbeat.id);
            socket.terminate();
          } else if (socket.readyState === 1) socket.ping();
        }
      }, options.heartbeatIntervalMs ?? 2000);
      heartbeatInterval.unref();
      if (!options.manualTick) {
        let previous = performance.now(), accumulator = 0;
        interval = setInterval(() => {
          const current = performance.now();
          // Bound catch-up work after an OS stall; never create a variable physics step.
          accumulator = Math.min(accumulator + Math.max(0, current - previous) / 1000, STEP * 16);
          previous = current;
          let steps = 0;
          while (accumulator >= STEP && steps++ < 8) { manager.step(); accumulator -= STEP; }
        }, 4);
        interval.unref();
      }
      return address;
    },
    async stop() {
      if (interval) clearInterval(interval);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatPeers.clear();
      if (!closed) { closed = true; manager.close(); }
      await app.close();
    },
  };
}
