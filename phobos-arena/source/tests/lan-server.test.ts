import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir, type NetworkInterfaceInfo } from "node:os";
import { join } from "node:path";
import WebSocket, { type ClientOptions } from "ws";
import { createLanServer, lanAddresses, MAX_LAN_PAYLOAD } from "../server/app.ts";
import { MAX_COMMAND_QUEUE, type Authority, type CreateAuthority } from "../server/rooms.ts";
import { defaultConfig } from "../src/match.ts";
import { INPUT_TIMEOUT_MS, LAN_PROTOCOL, RECONNECT_MS, idleCommand,
  type ActorAssignment, type ClientMessage, type GameCommand, type GameEvent, type GameSnapshot,
  type Hello, type RoomSettings, type ServerMessage } from "../src/lan/types.ts";

type Welcome = Extract<ServerMessage, { type: "welcome" }>;
const hello = (name = "Operator"): Hello => ({ name, appearance: {
  character: "mordant", characterSkin: "original", weaponSkin: "original",
} });
const settings = (extra: Partial<RoomSettings> = {}): RoomSettings => ({
  mapId: "ossuary", config: { ...defaultConfig("duel"), population: 2 }, fillBots: true, replaceDisconnected: true, ...extra,
});

class TestAuthority implements Authority {
  readonly roster = new Map<number, ActorAssignment>();
  readonly steps: Map<number, GameCommand>[] = [];
  readonly changes: ActorAssignment[] = [];
  readonly events: GameEvent[] = [];
  disposed = 0;
  ended = false;
  readonly health = new Map<number, number>();
  constructor(readonly options: Parameters<CreateAuthority>[0]) {
    for (const assignment of options.roster) { this.roster.set(assignment.id, assignment); this.health.set(assignment.id, 100); }
  }
  stepAuthority(commands: Map<number, GameCommand>) {
    this.steps.push(new Map([...commands].map(([id, command]) => [id, { ...command }])));
  }
  setController(assignment: ActorAssignment) { this.roster.set(assignment.id, assignment); this.changes.push(assignment); }
  snapshot(): GameSnapshot {
    return { matchId: this.options.matchId, tick: this.steps.length, time: this.steps.length / 120,
      mapId: this.options.mapId, config: this.options.config, actors: [], pickups: [], projectiles: [], flags: [], mechanisms: [],
      juggernautId: null, captureScores: [0, 0], ended: this.ended,
      result: this.ended ? { winnerId: 0, winnerTeam: null, draw: false, reason: "score" } : null, events: this.events.splice(0) };
  }
  disposeAuthority() { this.disposed++; }
}

async function server(t: TestContext, extra: Parameters<typeof createLanServer>[0] = {}) {
  let now = 10_000;
  const authorities: TestAuthority[] = [];
  const lan = await createLanServer({ host: "127.0.0.1", port: 0, manualTick: true, now: () => now,
    createAuthority: async options => { const authority = new TestAuthority(options); authorities.push(authority); return authority; }, ...extra });
  const url = await lan.start();
  t.after(() => lan.stop());
  return { lan, url, authorities, advance(ms: number, steps = 1) { now += ms; for (let i = 0; i < steps; i++) lan.manager.step(now); } };
}

async function client(t: TestContext, url: string, options: ClientOptions = {}) {
  const socket = new WebSocket(url.replace(/^http/, "ws") + "/lan", options);
  const messages: ServerMessage[] = [];
  const waiting: { predicate: (message: ServerMessage) => boolean; resolve: (message: ServerMessage) => void }[] = [];
  socket.on("message", payload => {
    const message = JSON.parse(payload.toString()) as ServerMessage;
    const index = waiting.findIndex(item => item.predicate(message));
    if (index < 0) messages.push(message);
    else waiting.splice(index, 1)[0].resolve(message);
  });
  await once(socket, "open");
  t.after(() => socket.terminate());
  function wait<T extends ServerMessage>(predicate: (message: ServerMessage) => message is T): Promise<T>;
  function wait(predicate: (message: ServerMessage) => boolean): Promise<ServerMessage>;
  function wait(predicate: (message: ServerMessage) => boolean): Promise<ServerMessage> {
    const index = messages.findIndex(predicate);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { const index = waiting.indexOf(item); if (index >= 0) waiting.splice(index, 1); reject(new Error(`LAN message timed out; received ${JSON.stringify(messages)}`)); }, 2500);
      const item = { predicate, resolve: (message: ServerMessage) => { clearTimeout(timer); resolve(message); } };
      waiting.push(item);
    });
  }
  const send = (message: ClientMessage) => socket.send(JSON.stringify(message));
  return { socket, messages, send, wait,
    async create(config = settings(), name?: string) {
      send({ type: "create", protocol: LAN_PROTOCOL, hello: hello(name), settings: config });
      return wait((message): message is Welcome => message.type === "welcome");
    },
    async join(code: string, token?: string, name?: string) {
      send({ type: "join", protocol: LAN_PROTOCOL, hello: hello(name), code, token });
      return wait((message): message is Welcome => message.type === "welcome");
    },
    async barrier() {
      const at = 12345;
      send({ type: "ping", at });
      await wait(message => message.type === "pong" && message.at === at);
    },
    async error(code: string) { return wait(message => message.type === "error" && message.code === code); },
    async close() { const closed = once(socket, "close"); socket.close(); await closed; },
  };
}

async function start(host: Awaited<ReturnType<typeof client>>) {
  host.send({ type: "start" });
  const message = await host.wait((message): message is Extract<ServerMessage, { type: "room" }> => message.type === "room" && message.room.phase === "playing");
  await host.wait(message => message.type === "snapshot");
  return message.room.matchId!;
}

test("LAN address discovery advertises private interfaces, excluding loopback and public IPs", () => {
  const entry = (address: string, family: "IPv4" | "IPv6", internal = false) => ({ address, family, internal }) as NetworkInterfaceInfo;
  assert.deepEqual(lanAddresses(4175, { test: [
    entry("127.0.0.1", "IPv4", true), entry("192.168.1.25", "IPv4"), entry("10.2.0.8", "IPv4"),
    entry("172.20.1.7", "IPv4"), entry("172.32.1.7", "IPv4"), entry("8.8.8.8", "IPv4"),
    entry("fd12::1", "IPv6"), entry("fe80::1", "IPv6"),
  ] }), ["http://192.168.1.25:4175", "http://10.2.0.8:4175", "http://172.20.1.7:4175", "http://[fd12::1]:4175"]);
});

test("local HTTP server serves the built game and LAN info without external services", async (t) => {
  const distDir = await mkdtemp(join(tmpdir(), "phobos-lan-test-"));
  t.after(() => rm(distDir, { recursive: true, force: true }));
  await writeFile(join(distDir, "index.html"), "<!doctype html><title>Phobos test build</title>");
  await writeFile(join(distDir, "local.js"), "window.localAsset=true");
  const { url } = await server(t, { distDir, advertise: ["http://192.168.50.7:4175"] });
  assert.match(await (await fetch(url)).text(), /Phobos test build/);
  assert.match(await (await fetch(url + "/local.js")).text(), /localAsset/);
  assert.equal((await fetch(url + "/missing.js")).status, 404);
  const info = await (await fetch(url + "/api/lan")).json();
  assert.equal(info.protocol, LAN_PROTOCOL);
  assert.equal(info.reconnectSeconds, 60);
  assert.deepEqual(info.addresses, ["http://192.168.50.7:4175"]);
});

test("real sockets create and join fixed slots, keeping reconnect secrets private", async (t) => {
  const { url } = await server(t);
  const host = await client(t, url), guest = await client(t, url), third = await client(t, url);
  const created = await host.create(settings(), "Same name");
  const joined = await guest.join(created.code.toLowerCase(), undefined, "Same name");
  assert.match(created.code, /^[A-Z2-9]{6}$/);
  assert.equal(created.slotId, 0); assert.equal(joined.slotId, 1);
  assert.notEqual(created.token, joined.token);
  assert.equal(joined.room.slots[0].name, joined.room.slots[1].name, "names are labels, never identities");
  assert.equal(JSON.stringify(joined.room).includes(created.token), false);
  assert.equal(JSON.stringify(joined.room).includes(joined.token), false);
  third.send({ type: "join", protocol: LAN_PROTOCOL, hello: hello(), code: created.code });
  await third.error("full");
});

test("readiness and settings are owner-controlled, mode-valid and bounded to ten fixed slots", async (t) => {
  const { url, authorities } = await server(t);
  const host = await client(t, url), guest = await client(t, url);
  const created = await host.create(); await guest.join(created.code);
  guest.send({ type: "configure", settings: settings() }); await guest.error("not_owner");
  host.send({ type: "start" }); await host.error("not_ready");
  host.send({ type: "configure", settings: settings({ mapId: "ossuary", config: defaultConfig("ctf") }) });
  await host.error("invalid");
  host.send({ type: "configure", settings: settings({ mapId: "bastion", config: { ...defaultConfig("tdm"), population: 999 } }) });
  const updated = await host.wait((message): message is Extract<ServerMessage, { type: "room" }> => message.type === "room" && message.room.settings.mapId === "bastion");
  assert.equal(updated.room.slots.length, 10);
  assert.equal(updated.room.settings.config.population, 10);
  assert.deepEqual(updated.room.slots.map(slot => slot.id), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  guest.send({ type: "ready", ready: true }); await guest.barrier();
  await start(host);
  assert.equal(authorities[0].options.config.mode, "tdm");
  assert.equal(authorities[0].options.roster.filter(slot => slot.id % 2 === 0).length, 5);
  host.send({ type: "configure", settings: settings() }); await host.error("match_active");
  guest.send({ type: "ready", ready: false }); await guest.error("match_active");
});

test("commands normalize movement, consume one edge per fixed step, and time out to idle", async (t) => {
  const { url, authorities, advance } = await server(t);
  const host = await client(t, url); await host.create();
  const matchId = await start(host), authority = authorities[0];
  host.send({ type: "input", matchId, commands: [{ ...idleCommand(1), x: 99, z: 99, yaw: 20, pitch: 20,
    jump: true, fire: true, fireHeld: true, respawn: true, switchTo: "rocket", railAuto: false }] });
  await host.barrier(); advance(0);
  const first = authority.steps.at(-1)!.get(0)!;
  assert.ok(Math.abs(Math.hypot(first.x, first.z) - 1) < 1e-9);
  assert.ok(first.yaw >= -Math.PI && first.yaw <= Math.PI); assert.equal(first.pitch, 1.5);
  assert.equal(first.jump, true); assert.equal(first.fire, true); assert.equal(first.switchTo, "rocket");
  advance(8);
  const held = authority.steps.at(-1)!.get(0)!;
  assert.equal(held.seq, 1); assert.equal(held.fireHeld, true); assert.equal(held.x, first.x);
  assert.equal(held.jump, false); assert.equal(held.fire, false); assert.equal(held.respawn, false); assert.equal(held.switchTo, null);
  advance(INPUT_TIMEOUT_MS);
  assert.equal(authority.steps.at(-1)!.has(0), false, "timed-out humans have controls disabled, including automatic attacks");
  host.send({ type: "input", matchId, commands: [idleCommand(1)] }); await host.error("sequence");
  host.send({ type: "input", matchId, commands: [{ ...idleCommand(2), x: 1 }] }); await host.barrier(); advance(0);
  assert.equal(authority.steps.at(-1)!.get(0)!.seq, 2, "fresh commands resume normal controls");
  assert.equal(authority.steps.at(-1)!.get(0)!.x, 1);
});

test("input batches and queues are bounded, stale matches rejected, and explicit idle flushes edges", async (t) => {
  const { url, authorities, advance } = await server(t);
  const host = await client(t, url); await host.create();
  const matchId = await start(host), authority = authorities[0];
  host.send({ type: "input", matchId: "old-match", commands: [idleCommand(1)] }); await host.error("match");
  host.send({ type: "input", matchId, commands: Array.from({ length: 9 }, (_, index) => idleCommand(index + 1)) }); await host.error("invalid");
  for (let start = 1; start <= 40; start += 8)
    host.send({ type: "input", matchId, commands: Array.from({ length: 8 }, (_, index) => ({ ...idleCommand(start + index), x: 1, jump: true })) });
  await host.barrier(); advance(0);
  assert.equal(authority.steps.at(-1)!.get(0)!.seq, 40 - MAX_COMMAND_QUEUE + 1, "overload discards oldest queued commands instead of speeding up time");
  assert.equal(authority.steps.length, 1);
  host.send({ type: "idle", matchId }); await host.barrier(); advance(0);
  assert.equal(authority.steps.at(-1)!.has(0), false, "explicit idle disables controls and drops queued actions");
  host.send({ type: "input", matchId, commands: [idleCommand(10)] }); await host.barrier(); advance(0);
  assert.equal(authority.steps.at(-1)!.get(0)!.seq, 10, "unconsumed input never advances the acknowledgement past nine");
  assert.equal(authority.steps.at(-1)!.get(0)!.jump, false);
});

test("disconnect reserves identity, hands ownership over, and reconnect replaces its bot without resetting state", async (t) => {
  const { url, authorities, advance } = await server(t);
  const host = await client(t, url), guest = await client(t, url);
  const created = await host.create(settings(), "Original"); await guest.join(created.code);
  guest.send({ type: "ready", ready: true }); await guest.barrier();
  const matchId = await start(host), authority = authorities[0];
  host.send({ type: "input", matchId, commands: [{ ...idleCommand(7), x: 1 }, { ...idleCommand(8), fire: true }] });
  await host.barrier(); advance(0); authority.health.set(0, 37);
  await host.close();
  const disconnected = await guest.wait((message): message is Extract<ServerMessage, { type: "room" }> =>
    message.type === "room" && !message.room.slots[0].connected);
  assert.equal(disconnected.room.ownerId, 1);
  assert.equal(disconnected.room.slots[0].controller, "bot");
  assert.equal(disconnected.room.slots[0].reservedUntil, 10_000 + RECONNECT_MS);
  advance(0); assert.equal(authority.steps.at(-1)!.has(0), false, "disconnected human input is no longer supplied");
  const intruder = await client(t, url);
  intruder.send({ type: "join", protocol: LAN_PROTOCOL, hello: hello("Original"), code: created.code }); await intruder.error("full");
  intruder.send({ type: "join", protocol: LAN_PROTOCOL, hello: hello(), code: created.code, token: "wrong-secret" }); await intruder.error("reconnect_expired");
  const restored = await intruder.join(created.code, created.token, "Different name");
  assert.equal(restored.slotId, 0); assert.equal(restored.resumed, true);
  assert.equal(restored.room.slots[0].name, "Original"); assert.equal(restored.room.ownerId, 1);
  assert.equal(authorities.length, 1); assert.equal(authority.health.get(0), 37);
  assert.equal(authority.roster.get(0)!.controller, "human");
  intruder.send({ type: "input", matchId, commands: [idleCommand(8)] }); await intruder.barrier(); advance(0);
  assert.equal(authority.steps.at(-1)!.get(0)!.seq, 8, "reconnect continues after last consumed ack, not discarded queued input");
  assert.equal(authority.steps.at(-1)!.get(0)!.fire, false);
});

test("vacancy and disconnect bot toggles are independent and explicit leave releases the slot", async (t) => {
  const { url, authorities, advance } = await server(t);
  const host = await client(t, url), guest = await client(t, url);
  const created = await host.create(settings({ fillBots: false, replaceDisconnected: false }));
  assert.equal(created.room.slots[1].controller, "empty");
  host.send({ type: "start" }); await host.error("not_enough_players");
  await guest.join(created.code); guest.send({ type: "ready", ready: true }); await guest.barrier();
  await start(host);
  guest.send({ type: "leave" }); await guest.barrier();
  const left = await host.wait((message): message is Extract<ServerMessage, { type: "room" }> =>
    message.type === "room" && message.room.phase === "playing" && !message.room.slots[1].connected);
  assert.equal(left.room.slots[1].controller, "empty"); assert.equal(left.room.slots[1].reservedUntil, null);
  assert.equal(authorities[0].roster.get(1)!.controller, "empty");
  const joined = await guest.join(created.code); assert.equal(joined.slotId, 1);
  await guest.close();
  const disconnected = await host.wait((message): message is Extract<ServerMessage, { type: "room" }> =>
    message.type === "room" && message.room.slots[1].reservedUntil !== null);
  assert.equal(disconnected.room.slots[1].controller, "empty");
  advance(RECONNECT_MS + 1);
  const replacement = await client(t, url); const newPlayer = await replacement.join(created.code);
  assert.equal(newPlayer.slotId, 1); assert.equal(newPlayer.resumed, false);
});

test("snapshots run at twenty per simulation second and results survive a reconnect", async (t) => {
  const { url, authorities, advance } = await server(t);
  const host = await client(t, url), guest = await client(t, url);
  const created = await host.create(); const joined = await guest.join(created.code);
  guest.send({ type: "ready", ready: true }); await guest.barrier();
  await start(host);
  advance(0, 5); await host.barrier();
  assert.equal(host.messages.filter(message => message.type === "snapshot").length, 0);
  advance(0, 1);
  const snapshot = await host.wait((message): message is Extract<ServerMessage, { type: "snapshot" }> => message.type === "snapshot");
  assert.equal(snapshot.state.tick, 6);
  authorities[0].ended = true; advance(0, 6);
  const result = await host.wait((message): message is Extract<ServerMessage, { type: "snapshot" }> => message.type === "snapshot" && message.state.ended);
  assert.equal(result.state.result?.winnerId, 0);
  await guest.close();
  const resumed = await client(t, url); const welcome = await resumed.join(created.code, joined.token);
  assert.equal(welcome.room.phase, "results");
  const final = await resumed.wait((message): message is Extract<ServerMessage, { type: "snapshot" }> => message.type === "snapshot" && message.state.ended);
  assert.deepEqual(final.state.result, result.state.result);
  const newcomer = await client(t, url);
  newcomer.send({ type: "join", protocol: LAN_PROTOCOL, hello: hello(), code: created.code });
  await newcomer.error("results_closed");
  advance(0, 12); assert.equal(authorities[0].steps.length, 12, "finished simulations stop stepping");
  host.send({ type: "lobby" });
  await host.wait(message => message.type === "room" && message.room.phase === "lobby" && message.room.matchId === null && message.room.revision > welcome.room.revision);
  assert.equal(authorities[0].disposed, 1);
});

test("an abandoned room expires and disposes its simulation after the reconnect window", async (t) => {
  const { url, authorities, advance } = await server(t);
  const host = await client(t, url); const created = await host.create(); await start(host);
  await host.close();
  // Client close completes before the server's close callback on some platforms.
  for (let retry = 0; retry < 20 && authorities[0].roster.get(0)!.controller === "human"; retry++)
    await new Promise(resolve => setTimeout(resolve, 2));
  assert.equal(authorities[0].roster.get(0)!.controller, "bot");
  advance(RECONNECT_MS + 1);
  assert.equal(authorities[0].disposed, 1);
  const next = await client(t, url);
  next.send({ type: "join", protocol: LAN_PROTOCOL, hello: hello(), code: created.code, token: created.token });
  await next.error("not_found");
});

test("joining at the same simulation tick preserves newly drained events for existing replicas", async (t) => {
  const { url, authorities, advance } = await server(t);
  const host = await client(t, url), guest = await client(t, url);
  const created = await host.create(); await start(host);
  authorities[0].events.push({ id: 1, type: "notice", text: "Flag returned" });
  await guest.join(created.code);
  const joined = await guest.wait((message): message is Extract<ServerMessage, { type: "snapshot" }> => message.type === "snapshot");
  assert.equal(joined.state.tick, 0);
  assert.deepEqual(joined.state.events.map(event => event.id), [1]);
  advance(0, 6);
  const next = await host.wait((message): message is Extract<ServerMessage, { type: "snapshot" }> => message.type === "snapshot" && message.state.tick === 6);
  assert.deepEqual(next.state.events.map(event => event.id), [1], "the next new tick carries events ignored in duplicate-tick snapshots");
  advance(0, 6);
  const after = await host.wait((message): message is Extract<ServerMessage, { type: "snapshot" }> => message.type === "snapshot" && message.state.tick === 12);
  assert.deepEqual(after.state.events, []);
});

test("malformed, non-finite, unauthorized and oversized WebSocket payloads cannot enter simulation", async (t) => {
  const { url, authorities, advance } = await server(t);
  const host = await client(t, url);
  host.socket.send("{broken"); await host.error("invalid");
  host.socket.send(Buffer.from("binary")); await host.error("invalid");
  host.socket.send(JSON.stringify({ type: "create", protocol: 999, hello: hello(), settings: settings() })); await host.error("protocol");
  host.send({ type: "start" }); await host.error("not_joined");
  await host.create(); const matchId = await start(host);
  host.socket.send(JSON.stringify({ type: "input", matchId, commands: [{ ...idleCommand(1), yaw: Infinity }] })); await host.error("invalid");
  host.socket.send(JSON.stringify({ type: "input", matchId, commands: [{ ...idleCommand(1), fire: "true" }] })); await host.error("invalid");
  host.socket.send(JSON.stringify({ type: "input", matchId, commands: [idleCommand(2), idleCommand(1)] })); await host.error("invalid");
  advance(0); assert.equal(authorities[0].steps.at(-1)!.has(0), false);
  const closed = once(host.socket, "close");
  host.socket.send("x".repeat(MAX_LAN_PAYLOAD + 1));
  const [code] = await closed; assert.equal(code, 1009);
});

test("missed WebSocket pongs terminate a silent peer and activate its reserved bot slot", async (t) => {
  const { url, authorities } = await server(t, { heartbeatIntervalMs: 20, heartbeatTimeoutMs: 240 });
  const host = await client(t, url), guest = await client(t, url, { autoPong: false });
  const created = await host.create(); await guest.join(created.code);
  guest.send({ type: "ready", ready: true }); await guest.barrier();
  await start(host);
  const closed = once(guest.socket, "close");
  const room = await host.wait((message): message is Extract<ServerMessage, { type: "room" }> =>
    message.type === "room" && !message.room.slots[1].connected && message.room.slots[1].reservedUntil !== null);
  const [code] = await closed;
  assert.equal(code, 1006, "a dead transport is terminated without waiting for its close handshake");
  assert.equal(room.room.slots[1].controller, "bot");
  assert.equal(authorities[0].roster.get(1)!.controller, "bot");
  assert.equal(host.socket.readyState, WebSocket.OPEN, "a peer returning native pongs stays connected");
});

test("real Game authority moves a remote human, resolves combat, and preserves its damaged slot on reconnect", async (t) => {
  const { Game } = await import("../src/game.ts");
  let authority: InstanceType<typeof Game> | undefined;
  const { url, advance } = await server(t, { createAuthority: async options => {
    authority = await Game.createAuthority(options); return authority;
  } });
  const host = await client(t, url), guest = await client(t, url);
  const created = await host.create(), joined = await guest.join(created.code);
  guest.send({ type: "ready", ready: true }); await guest.barrier();
  const matchId = await start(host);
  assert.ok(authority);
  const [first, second] = authority.actors;
  const place = (actor: typeof first, x: number, z: number) => {
    Object.assign(actor.motion, { x, y: 30, z, vx: 0, vy: 0, vz: 0, grounded: false });
    actor.body.setTranslation(actor.motion, true); actor.body.setNextKinematicTranslation(actor.motion);
  };
  place(first, 0, 0); place(second, 4, 0); authority.world.step();
  guest.send({ type: "input", matchId, commands: [{ ...idleCommand(1), x: 1 }] });
  await guest.barrier(); advance(0, 12);
  assert.ok(second.motion.x > 4, "actor one follows its remote human command");
  const moved = await guest.wait((message): message is Extract<ServerMessage, { type: "snapshot" }> => message.type === "snapshot" && message.state.tick >= 12);
  assert.equal(moved.state.actors.find(actor => actor.id === 1)!.ack, 1);

  guest.send({ type: "idle", matchId }); await guest.barrier();
  place(first, 0, 0); place(second, 0, -3);
  second.health = 100; second.armor = 0; second.kills = 3;
  second.humanKills = 2; second.humanDeaths = 4;
  first.lastShot.machinegun = -Infinity; authority.world.step();
  host.send({ type: "input", matchId, commands: [idleCommand(1)] }); await host.barrier(); advance(0, 6);
  const damaged = await host.wait((message): message is Extract<ServerMessage, { type: "snapshot" }> => message.type === "snapshot" && message.state.tick >= 18);
  const before = damaged.state.actors.find(actor => actor.id === 1)!;
  assert.equal(before.health, 93, "the existing machinegun and damage code resolve on the server");
  assert.equal(before.kills, 3);
  guest.send({ type: "input", matchId, commands: [idleCommand(2)] });
  await guest.barrier(); advance(0);
  assert.equal(second.ack, 2, "one command was consumed after the last regular snapshot");
  await guest.close();
  await host.wait(message => message.type === "room" && message.room.slots[1].reservedUntil !== null);
  const replacement = await client(t, url); const welcome = await replacement.join(created.code, joined.token);
  assert.equal(welcome.slotId, 1); assert.equal(welcome.resumed, true);
  const restored = await replacement.wait((message): message is Extract<ServerMessage, { type: "snapshot" }> => message.type === "snapshot" && message.state.tick >= 19);
  assert.equal(restored.state.actors.find(actor => actor.id === 1)!.health, 93);
  assert.equal(restored.state.actors.find(actor => actor.id === 1)!.ack, 2, "reconnect gets the latest consumed ack immediately");
  assert.equal(restored.state.actors.find(actor => actor.id === 1)!.controller, "human");
  assert.equal(second.health, 93); assert.equal(second.kills, 3);
  assert.equal(second.humanKills, 2); assert.equal(second.humanDeaths, 4, "token reconnect keeps that human's lifetime counters");
  assert.equal(second.motion.x, before.motion.x); assert.equal(second.motion.z, before.motion.z);
  replacement.send({ type: "input", matchId, commands: [{ ...idleCommand(3), x: 1 }] });
  await replacement.barrier(); advance(0, 5);
  const next = await replacement.wait((message): message is Extract<ServerMessage, { type: "snapshot" }> => message.type === "snapshot" && message.state.tick >= 24);
  assert.equal(next.state.actors.find(actor => actor.id === 1)!.ack, 3);
  assert.ok(second.motion.x > before.motion.x);
  const retainedMotion = next.state.actors.find(actor => actor.id === 1)!.motion, retainedAmmo = second.ammo.machinegun;
  replacement.send({ type: "leave" }); await replacement.barrier();
  await host.wait(message => message.type === "room" && !message.room.slots[1].connected && message.room.slots[1].reservedUntil === null);
  const newHuman = await client(t, url); const fresh = await newHuman.join(created.code, undefined, "Fresh human");
  assert.equal(fresh.slotId, 1); assert.equal(fresh.resumed, false);
  const inherited = await newHuman.wait((message): message is Extract<ServerMessage, { type: "snapshot" }> => message.type === "snapshot");
  const inheritedSlot = inherited.state.actors.find(actor => actor.id === 1)!;
  assert.equal(inheritedSlot.kills, 3, "the ongoing match keeps its existing score");
  assert.equal(inheritedSlot.health, 93, "a new human takes the existing combat state");
  assert.deepEqual(inheritedSlot.motion, retainedMotion); assert.equal(inheritedSlot.ammo.machinegun, retainedAmmo);
  assert.equal(inheritedSlot.humanKills, 0); assert.equal(inheritedSlot.humanDeaths, 0, "another person's lifetime totals cannot be claimed");
});
