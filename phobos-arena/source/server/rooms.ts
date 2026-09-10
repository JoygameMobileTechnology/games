import { randomBytes, randomUUID } from "node:crypto";
import { isTeamMode } from "../src/match.ts";
import { INPUT_TIMEOUT_MS, LAN_PROTOCOL, RECONNECT_MS, SNAPSHOT_HZ, idleCommand,
  type ActorAssignment, type ClientMessage, type GameCommand, type GameEvent, type GameSnapshot,
  type Hello, type RoomSettings, type RoomSlot, type RoomState, type ServerMessage } from "../src/lan/types.ts";
import { STEP } from "../src/rules.ts";
import { parseMessage, ProtocolError } from "./validation.ts";

export interface Authority {
  /** Absent human command means controls disabled; its body remains in the match. */
  stepAuthority(commands: Map<number, GameCommand>): void;
  setController(assignment: ActorAssignment, resetHumanStats?: boolean): void;
  snapshot(): GameSnapshot;
  disposeAuthority(): void;
}
export type CreateAuthority = (options: {
  mapId: RoomSettings["mapId"]; config: RoomSettings["config"]; roster: ActorAssignment[]; matchId: string;
}) => Promise<Authority>;
export interface PeerTransport { send(message: ServerMessage): void; close(code: number, reason: string): void }
interface Peer extends PeerTransport { room?: string; slot?: number; rateAt: number; messages: number }
interface InputState { queue: GameCommand[]; held: GameCommand; highest: number; receivedAt: number }
interface Slot extends RoomSlot { token?: string; peer?: string; input: InputState }
interface Room {
  code: string; ownerId: number; phase: RoomState["phase"]; settings: RoomSettings;
  slots: Slot[]; matchId: string | null; revision: number; authority?: Authority;
  starting: boolean; ticks: number; snapshot?: GameSnapshot; pendingEvents?: GameEvent[]; emptySince: number | null;
}
export const MAX_COMMAND_QUEUE = 32;
const MAX_ROOMS = 16;
const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const freshInput = (): InputState => ({ queue: [], held: idleCommand(), highest: -1, receivedAt: -Infinity });
const assignment = (slot: Slot): ActorAssignment => ({ id: slot.id, name: slot.name, controller: slot.controller,
  ...(slot.appearance ? { appearance: { ...slot.appearance } } : {}) });
const mergeEvents = (...batches: GameEvent[][]) => [...new Map(batches.flat().map(event => [event.id, event])).values()]
  .sort((a, b) => a.id - b.id).slice(-512);

/** Room state owns identities and transport, while the existing Game owns all simulation. */
export class RoomManager {
  private peers = new Map<string, Peer>();
  private rooms = new Map<string, Room>();
  private closed = false;
  constructor(private createAuthority: CreateAuthority, private now: () => number = Date.now) {}
  connect(transport: PeerTransport): string {
    if (this.closed || this.peers.size >= 128) { transport.close(1013, "Server capacity reached."); return ""; }
    const id = randomUUID();
    this.peers.set(id, { ...transport, rateAt: this.now(), messages: 0 });
    return id;
  }
  async receive(id: string, value: unknown): Promise<void> {
    const peer = this.peers.get(id);
    if (!peer) return;
    try {
      const now = this.now();
      if (now - peer.rateAt >= 1000) { peer.rateAt = now; peer.messages = 0; }
      if (++peer.messages > 240) {
        peer.close(1008, "Message rate exceeded."); this.disconnect(id); return;
      }
      const message = parseMessage(value);
      if (message.type === "ping") { peer.send({ type: "pong", at: message.at }); return; }
      if (message.type === "leave") { this.leave(id, false); return; }
      if (message.type === "create" || message.type === "join") {
        if (peer.room) throw new ProtocolError("already_joined", "Leave your current room first.");
        if (message.type === "create") this.create(id, message.hello, message.settings);
        else this.join(id, message);
        return;
      }
      const room = peer.room && this.rooms.get(peer.room), slot = room && room.slots[peer.slot!];
      if (!room || !slot || slot.peer !== id) throw new ProtocolError("not_joined", "Join a room first.");
      if (message.type === "input" || message.type === "idle") {
        if (room.phase !== "playing" || room.matchId !== message.matchId) throw new ProtocolError("match", "This match is no longer active.");
        if (message.type === "idle") { this.idle(slot); return; }
        if (message.commands[0].seq <= slot.input.highest) throw new ProtocolError("sequence", "Stale input was ignored.");
        slot.input.highest = message.commands.at(-1)!.seq;
        slot.input.receivedAt = now;
        slot.input.queue.push(...message.commands);
        if (slot.input.queue.length > MAX_COMMAND_QUEUE) slot.input.queue.splice(0, slot.input.queue.length - MAX_COMMAND_QUEUE);
        return;
      }
      if (message.type === "ready") {
        this.requireLobby(room);
        slot.ready = message.ready; this.publish(room); return;
      }
      if (room.ownerId !== slot.id) throw new ProtocolError("not_owner", "Only the room owner can do that.");
      if (message.type === "configure") {
        this.requireLobby(room);
        const capacity = message.settings.config.population;
        if (room.slots.some(s => s.id >= capacity && (s.connected || s.token)))
          throw new ProtocolError("occupied", "The smaller lobby would remove a player or reserved slot.");
        room.settings = message.settings;
        room.slots = Array.from({ length: capacity }, (_, index) => room.slots[index] ?? this.emptySlot(index, room.settings));
        for (const item of room.slots) {
          item.ready = item.connected && item.id === room.ownerId;
          if (!item.connected) item.controller = (item.token ? room.settings.replaceDisconnected : room.settings.fillBots) ? "bot" : "empty";
        }
        this.publish(room); return;
      }
      if (message.type === "start") { await this.start(room); return; }
      if (message.type === "lobby") {
        if (room.starting) throw new ProtocolError("starting", "The match is starting.");
        room.authority?.disposeAuthority(); room.authority = undefined; room.snapshot = undefined; room.pendingEvents = undefined;
        room.phase = "lobby"; room.matchId = null;
        for (const item of room.slots) { item.input = freshInput(); item.ready = item.connected && item.id === room.ownerId; }
        this.publish(room);
      }
    } catch (error) {
      const failure = error instanceof ProtocolError ? error : new ProtocolError("server", "The server could not complete that request.");
      if (this.peers.has(id)) peer.send({ type: "error", code: failure.code, message: failure.message });
    }
  }
  private requireLobby(room: Room) {
    if (room.starting) throw new ProtocolError("starting", "The match is starting.");
    if (room.phase !== "lobby") throw new ProtocolError("match_active", "Return to the lobby before changing settings.");
  }
  private emptySlot(id: number, settings: RoomSettings): Slot {
    return { id, name: `Bot ${id + 1}`, controller: settings.fillBots ? "bot" : "empty", connected: false,
      ready: false, reservedUntil: null, input: freshInput() };
  }
  private create(id: string, hello: Hello, settings: RoomSettings) {
    if (this.rooms.size >= MAX_ROOMS) throw new ProtocolError("capacity", "The server has too many rooms.");
    let code: string;
    do { code = [...randomBytes(6)].map(byte => codeAlphabet[byte % codeAlphabet.length]).join(""); } while (this.rooms.has(code));
    const room: Room = { code, ownerId: 0, phase: "lobby", settings, slots: [], matchId: null, revision: 0,
      starting: false, ticks: 0, emptySince: null };
    room.slots = Array.from({ length: settings.config.population }, (_, index) => this.emptySlot(index, settings));
    this.rooms.set(code, room);
    this.attach(id, room, room.slots[0], hello, false);
  }
  private join(id: string, message: Extract<ClientMessage, { type: "join" }>) {
    const room = this.rooms.get(message.code);
    if (!room) throw new ProtocolError("not_found", "No room has that code on this server.");
    if (room.starting) throw new ProtocolError("starting", "The match is starting. Try again shortly.");
    if (room.phase === "results" && !message.token)
      throw new ProtocolError("results_closed", "This match has finished. Wait for the owner to return to the lobby, then join.");
    this.expire(room, this.now());
    let slot: Slot | undefined;
    if (message.token) {
      slot = room.slots.find(item => item.token === message.token);
      if (!slot) throw new ProtocolError("reconnect_expired", "The reconnect reservation expired. Join again without its token.");
      if (slot.connected) throw new ProtocolError("already_connected", "That player is already connected.");
    } else slot = room.slots.find(item => !item.connected && !item.token);
    if (!slot) throw new ProtocolError("full", "The room is full or its empty slots are reserved.");
    this.attach(id, room, slot, message.hello, Boolean(message.token));
  }
  private attach(id: string, room: Room, slot: Slot, hello: Hello, resumed: boolean) {
    const peer = this.peers.get(id)!;
    Object.assign(peer, { room: room.code, slot: slot.id });
    slot.peer = id; slot.connected = true; slot.reservedUntil = null; slot.controller = "human";
    // Reconnect proves slot identity with the secret, and preserves the original name/appearance.
    if (!resumed) { slot.name = hello.name; slot.appearance = hello.appearance; slot.token = randomBytes(32).toString("base64url"); }
    slot.ready = slot.id === room.ownerId;
    this.idle(slot);
    room.emptySince = null;
    if (!room.slots.some(item => item.id === room.ownerId && item.connected)) room.ownerId = slot.id;
    room.authority?.setController(assignment(slot), !resumed);
    room.revision++;
    peer.send({ type: "welcome", protocol: LAN_PROTOCOL, code: room.code, token: slot.token!, slotId: slot.id, resumed, room: this.state(room) });
    this.broadcast(room, { type: "room", room: this.state(room) });
    // Everyone receives the fresh authoritative ack; joining must not drain
    // intervening events into a private snapshot that the other players miss.
    if (room.phase === "playing" && room.authority) this.snapshot(room);
    else if (room.snapshot) peer.send({ type: "snapshot", state: room.snapshot });
  }
  private async start(room: Room) {
    this.requireLobby(room);
    if (room.slots.some(slot => slot.connected && !slot.ready && slot.id !== room.ownerId))
      throw new ProtocolError("not_ready", "Every connected player must be ready.");
    const playing = room.slots.filter(slot => slot.controller !== "empty");
    if (playing.length < 2 || (isTeamMode(room.settings.config.mode) && ![0, 1].every(team => playing.some(slot => slot.id % 2 === team))))
      throw new ProtocolError("not_enough_players", "Add players or enable bots to fill both sides.");
    room.starting = true;
    const matchId = randomUUID();
    try {
      const authority = await this.createAuthority({ mapId: room.settings.mapId, config: room.settings.config,
        roster: room.slots.map(assignment), matchId });
      if (this.closed || !this.rooms.has(room.code)) { authority.disposeAuthority(); return; }
      room.authority = authority; room.matchId = matchId; room.phase = "playing"; room.ticks = 0;
      // Disconnects may have happened while Rapier/arena initialization was pending.
      for (const slot of room.slots) { slot.input = freshInput(); authority.setController(assignment(slot)); }
      this.publish(room); this.snapshot(room);
    } finally { room.starting = false; }
  }
  private idle(slot: Slot) {
    const previous = slot.input.held;
    slot.input.queue.length = 0;
    slot.input.held = { ...previous, x: 0, z: 0, jump: false, fire: false, fireHeld: false, respawn: false, switchTo: null };
    // Drop unconsumed input without making reconnect start above an invisible ack.
    slot.input.highest = previous.seq;
    slot.input.receivedAt = -Infinity;
  }
  disconnect(id: string) { this.leave(id, true); this.peers.delete(id); }
  private leave(id: string, reserve: boolean) {
    const peer = this.peers.get(id);
    const room = peer?.room && this.rooms.get(peer.room), slot = room && room.slots[peer!.slot!];
    if (!peer || !room || !slot || slot.peer !== id) return;
    delete peer.room; delete peer.slot;
    this.idle(slot); delete slot.peer;
    slot.connected = false; slot.ready = false;
    if (reserve) {
      slot.reservedUntil = this.now() + RECONNECT_MS;
      slot.controller = room.settings.replaceDisconnected ? "bot" : "empty";
    } else {
      delete slot.token; delete slot.appearance; slot.reservedUntil = null;
      slot.name = `Bot ${slot.id + 1}`; slot.controller = room.settings.fillBots ? "bot" : "empty";
    }
    room.authority?.setController(assignment(slot));
    const remaining = room.slots.find(item => item.connected);
    if (room.ownerId === slot.id && remaining) room.ownerId = remaining.id;
    if (!remaining) room.emptySince = this.now();
    this.publish(room);
  }
  private expire(room: Room, now: number) {
    let changed = false;
    for (const slot of room.slots) if (!slot.connected && slot.reservedUntil !== null && now >= slot.reservedUntil) {
      delete slot.token; delete slot.appearance; slot.reservedUntil = null;
      slot.name = `Bot ${slot.id + 1}`; slot.controller = room.settings.fillBots ? "bot" : "empty";
      room.authority?.setController(assignment(slot)); changed = true;
    }
    if (changed) this.publish(room);
  }
  /** Exactly one existing STEP; the transport's clock schedules these calls. */
  step(now = this.now()) {
    for (const room of this.rooms.values()) {
      this.expire(room, now);
      if (room.emptySince !== null && now - room.emptySince >= RECONNECT_MS) {
        room.authority?.disposeAuthority(); this.rooms.delete(room.code); continue;
      }
      if (room.phase !== "playing" || !room.authority) continue;
      const commands = new Map<number, GameCommand>();
      for (const slot of room.slots) if (slot.connected && slot.controller === "human") {
        if (now - slot.input.receivedAt >= INPUT_TIMEOUT_MS) this.idle(slot);
        if (slot.input.receivedAt === -Infinity) continue;
        const next = slot.input.queue.shift();
        if (next) slot.input.held = next;
        const command = next ?? { ...slot.input.held, jump: false, fire: false, respawn: false, switchTo: null };
        commands.set(slot.id, command);
      }
      room.authority.stepAuthority(commands);
      if (++room.ticks % Math.round(1 / STEP / SNAPSHOT_HZ) === 0) this.snapshot(room);
    }
  }
  private snapshot(room: Room) {
    const fresh = room.authority!.snapshot();
    const events = mergeEvents(room.pendingEvents ?? [], fresh.events);
    if (room.snapshot?.tick === fresh.tick) {
      // Existing replicas ignore duplicate ticks. Keep newly drained events for
      // the next tick as well; event IDs prevent replay on the joining replica.
      room.pendingEvents = events;
      fresh.events = mergeEvents(room.snapshot.events, events);
    } else { fresh.events = events; room.pendingEvents = undefined; }
    room.snapshot = fresh;
    if (room.snapshot.ended && room.phase !== "results") { room.phase = "results"; this.publish(room); }
    this.broadcast(room, { type: "snapshot", state: room.snapshot });
  }
  private state(room: Room): RoomState {
    return { code: room.code, ownerId: room.ownerId, phase: room.phase, settings: structuredClone(room.settings),
      slots: room.slots.map(slot => ({ ...assignment(slot), connected: slot.connected, ready: slot.ready, reservedUntil: slot.reservedUntil })),
      matchId: room.matchId, revision: room.revision };
  }
  private publish(room: Room) { room.revision++; this.broadcast(room, { type: "room", room: this.state(room) }); }
  private broadcast(room: Room, message: ServerMessage) {
    for (const slot of room.slots) if (slot.peer) this.peers.get(slot.peer)?.send(message);
  }
  close() {
    this.closed = true;
    for (const room of this.rooms.values()) room.authority?.disposeAuthority();
    this.rooms.clear();
    for (const peer of this.peers.values()) peer.close(1001, "LAN server stopped.");
    this.peers.clear();
  }
}
