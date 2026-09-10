import test from "node:test";
import assert from "node:assert/strict";
import { LanClient } from "../src/lan/client";
import { idleCommand, type RoomState, type ServerMessage } from "../src/lan/types";
import { defaultConfig } from "../src/match";

class TestSocket extends EventTarget {
  readyState = 0;
  bufferedAmount = 0;
  sent: any[] = [];
  constructor() { super(); queueMicrotask(() => { this.readyState = 1; this.dispatchEvent(new Event("open")); }); }
  send(value: string) { this.sent.push(JSON.parse(value)); }
  close() { this.readyState = 3; this.dispatchEvent(new Event("close")); }
  receive(value: ServerMessage) { this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(value) })); }
}
const hello = { name: "Operator", appearance: { character: "mordant", characterSkin: "original", weaponSkin: "original" } } as const;
const settings = { mapId: "ossuary", config: defaultConfig(), fillBots: true, replaceDisconnected: true } as const;
const room: RoomState = { code: "ABC234", ownerId: 0, phase: "lobby", settings, slots: [], matchId: null, revision: 1 };
function setup() {
  const storage = new Map<string, string>();
  const sockets: TestSocket[] = [];
  const options = { origin: "http://localhost:4175", storage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  }, socket: () => { const socket = new TestSocket(); sockets.push(socket); return socket as unknown as WebSocket; } };
  return { client: new LanClient(options), options, sockets, storage };
}

test("room code joining normalizes input and keeps reconnect secrets out of the room state", async (t) => {
  const { client, sockets, options } = setup(); t.after(() => client.dispose());
  await client.join(hello, " abc234 ");
  assert.equal(sockets[0].sent[0].code, "ABC234");
  sockets[0].receive({ type: "welcome", protocol: 1, code: room.code, token: "private-token", slotId: 3, resumed: false, room });
  assert.equal(client.slotId, 3);
  assert.equal(JSON.stringify(client.room).includes("private-token"), false);
  const reloaded = new LanClient(options); t.after(() => reloaded.dispose());
  await reloaded.join(hello, reloaded.savedCode);
  assert.equal(sockets[1].sent[0].token, "private-token");
});

test("joining a different room cannot send the old room's reconnect token", async (t) => {
  const { client, sockets } = setup(); t.after(() => client.dispose());
  await client.join(hello, room.code);
  sockets[0].receive({ type: "welcome", protocol: 1, code: room.code, token: "private-token", slotId: 0, resumed: false, room });
  await client.join(hello, "XYZ456");
  assert.equal(sockets[0].sent.at(-1).token, undefined);
});

test("input batches use server match identity and idle discards queued fire", async (t) => {
  const { client, sockets } = setup(); t.after(() => client.dispose());
  await client.join(hello, room.code);
  const playing: RoomState = { ...room, phase: "playing", matchId: "round-1", revision: 2 };
  sockets[0].receive({ type: "welcome", protocol: 1, code: room.code, token: "secret", slotId: 1, resumed: false, room: playing });
  client.queue({ ...idleCommand(1), fire: true });
  client.idle();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(sockets[0].sent.some((message) => message.type === "input"), false);
  assert.equal(sockets[0].sent.find((message) => message.type === "idle").matchId, "round-1");
  client.queue({ ...idleCommand(2), x: 1 });
  await new Promise((resolve) => setTimeout(resolve, 25));
  const input = sockets[0].sent.find((message) => message.type === "input");
  assert.equal(input.matchId, "round-1"); assert.equal(input.commands[0].seq, 2);
});

test("late room revisions and snapshots from previous rounds are ignored", async (t) => {
  const { client, sockets } = setup(); t.after(() => client.dispose());
  await client.join(hello, room.code);
  sockets[0].receive({ type: "welcome", protocol: 1, code: room.code, token: "secret", slotId: 0, resumed: false, room: { ...room, revision: 4, phase: "playing", matchId: "new" } });
  sockets[0].receive({ type: "room", room });
  assert.equal(client.room?.revision, 4);
  let snapshots = 0; client.onSnapshot = () => snapshots++;
  sockets[0].receive({ type: "snapshot", state: { matchId: "old" } as any });
  assert.equal(snapshots, 0);
});

test("leaving clears the private ticket and never schedules reconnection", async () => {
  const { client, sockets } = setup();
  await client.join(hello, room.code);
  sockets[0].receive({ type: "welcome", protocol: 1, code: room.code, token: "secret", slotId: 0, resumed: false, room });
  client.leave();
  assert.equal(client.savedCode, ""); assert.equal(client.room, null); assert.equal(client.connected, false);
  assert.equal(sockets[0].sent.at(-1).type, "leave");
  client.dispose();
});

test("closing an entry while its connection opens cannot create a room afterwards", async () => {
  const { client, sockets } = setup();
  const pending = client.create(hello, settings);
  client.leave();
  await pending;
  assert.equal(client.connected, false);
  assert.equal(client.room, null);
  assert.equal(sockets[0].sent.some((message) => message.type === "create"), false);
  client.dispose();
});

test("an expired reconnect clears membership instead of resuming a frozen replica", async (t) => {
  const { client, sockets } = setup(); t.after(() => client.dispose());
  await client.join(hello, room.code);
  assert.equal(client.connected, false, "an open socket alone is not room membership");
  sockets[0].receive({ type: "welcome", protocol: 1, code: room.code, token: "secret", slotId: 0, resumed: false, room: { ...room, phase: "playing", matchId: "round" } });
  let disconnected = false; client.onDisconnect = () => { disconnected = true; };
  sockets[0].receive({ type: "error", code: "reconnect_expired", message: "Reservation expired" });
  assert.equal(client.connected, false); assert.equal(client.room, null); assert.equal(client.savedCode, "");
  assert.equal(disconnected, true); assert.equal(client.error, "Reservation expired");
});
