import { LAN_PROTOCOL, type ClientMessage, type GameCommand, type GameSnapshot, type Hello, type RoomSettings, type RoomState, type ServerInfo, type ServerMessage } from "./types";

interface Ticket { code: string; token: string }
interface ClientOptions {
  origin?: string;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">;
  socket?: (url: string) => WebSocket;
}

/** One tab owns one LAN slot. Reloads preserve its private reconnect ticket. */
export class LanClient {
  info: ServerInfo | null = null;
  room: RoomState | null = null;
  slotId: number | null = null;
  status = "Connecting to the local server…";
  error: string | null = null;
  busy = false;
  connected = false;
  onChange: (() => void) | null = null;
  onSnapshot: ((snapshot: GameSnapshot) => void) | null = null;
  onDisconnect: (() => void) | null = null;
  private ws: WebSocket | null = null;
  private readonly origin: string;
  private readonly storage?: ClientOptions["storage"];
  private readonly socket: (url: string) => WebSocket;
  private hello: Hello | null = null;
  private ticket: Ticket | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private batch: ReturnType<typeof setInterval> | null = null;
  private retryUntil = 0;
  private lastReceived = 0;
  private lastPing = 0;
  private commands: GameCommand[] = [];
  private matchId: string | null = null;
  private opening: Promise<void> | null = null;
  private closed = false;
  private generation = 0;
  private readonly key = "phobos.lan.ticket.v1";

  constructor(options: ClientOptions = {}) {
    this.origin = options.origin ?? location.origin;
    try { this.storage = options.storage ?? sessionStorage; } catch { /* Storage may be disabled. */ }
    this.socket = options.socket ?? ((url) => new WebSocket(url));
    try {
      const saved = JSON.parse(this.storage?.getItem(this.key) ?? "null");
      if (typeof saved?.code === "string" && typeof saved?.token === "string") this.ticket = saved;
    } catch { /* A malformed local ticket never prevents manual joining. */ }
  }

  get savedCode() { return this.ticket?.code ?? ""; }

  async discover() {
    try {
      const response = await fetch(`${this.origin}/api/lan`, { cache: "no-store", signal: AbortSignal.timeout(4000) });
      const info = await response.json() as ServerInfo;
      if (!response.ok || info.protocol !== LAN_PROTOCOL || !Array.isArray(info.addresses)) throw new Error("Incompatible LAN server");
      this.info = info;
      this.status = "Local server available. Create a room or enter its code.";
      this.error = null;
    } catch {
      this.info = null;
      this.status = "Open the local server address to play together.";
      this.error = "The LAN server is not available at this address. On the host computer, run npm run lan, then open the address it prints on each device.";
    }
    this.changed();
  }

  async create(hello: Hello, settings: RoomSettings) {
    this.forgetTicket();
    this.hello = hello;
    await this.request({ type: "create", protocol: LAN_PROTOCOL, hello, settings });
  }

  async join(hello: Hello, code: string) {
    this.hello = hello;
    const normalized = code.trim().toUpperCase().replace(/\s/g, "");
    if (!/^[A-Z0-9]{4,8}$/.test(normalized)) { this.error = "Enter the room code shown in the invitation."; this.changed(); return; }
    if (this.ticket?.code !== normalized) this.forgetTicket();
    await this.request({ type: "join", protocol: LAN_PROTOCOL, hello, code: normalized, ...(this.ticket ? { token: this.ticket.token } : {}) });
  }

  configure(settings: RoomSettings) { void this.request({ type: "configure", settings }); }
  ready(ready: boolean) { void this.request({ type: "ready", ready }); }
  start() { void this.request({ type: "start" }); }
  lobby() { this.idle(); void this.request({ type: "lobby" }); }

  queue(command: GameCommand) {
    if (!this.connected || this.room?.phase !== "playing" || !this.matchId) return;
    this.commands.push(command);
    // A suspended browser must not replay seconds of stale movement or attacks.
    if (this.commands.length > 32) this.commands.splice(0, this.commands.length - 8);
  }

  idle() {
    this.commands.length = 0;
    if (this.matchId && this.room?.phase === "playing") this.send({ type: "idle", matchId: this.matchId });
  }

  leave() {
    this.idle();
    this.send({ type: "leave" });
    this.room = null; this.slotId = null; this.matchId = null;
    this.forgetTicket();
    this.shutdown();
    this.status = "Left the room."; this.busy = false; this.error = null;
    this.changed();
  }

  private changed() { this.onChange?.(); }
  private forgetTicket() {
    this.ticket = null;
    try { this.storage?.removeItem(this.key); } catch { /* Optional browser persistence. */ }
  }
  private send(message: ClientMessage) {
    if (this.ws?.readyState !== 1) return false;
    this.ws.send(JSON.stringify(message));
    return true;
  }
  private async request(message: ClientMessage) {
    const generation = this.generation;
    this.busy = true; this.error = null; this.changed();
    try { await this.open(); if (generation === this.generation) this.send(message); }
    catch { if (generation !== this.generation) return; this.busy = false; this.error = "Could not reach the local server. Check that both devices are on the same LAN and the server is running."; this.changed(); }
  }

  private open(): Promise<void> {
    if (this.ws?.readyState === 1) return Promise.resolve();
    if (this.opening) return this.opening;
    this.closed = false;
    const opening = new Promise<void>((resolve, reject) => {
      const url = new URL("/lan", this.origin); url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      const ws = this.socket(url.href);
      this.ws = ws;
      const timeout = setTimeout(() => { ws.close(); reject(new Error("Connection timeout")); }, 5000);
      ws.addEventListener("open", () => {
        if (this.closed || ws !== this.ws) { clearTimeout(timeout); ws.close(); reject(new Error("Connection cancelled")); return; }
        clearTimeout(timeout); this.lastReceived = Date.now();
        this.status = "Local server connected. Joining room…";
        this.batch ??= setInterval(() => this.flush(), 1000 / 60);
        this.changed(); resolve();
      });
      ws.addEventListener("message", (event) => {
        if (ws !== this.ws) return;
        this.lastReceived = Date.now();
        let message: ServerMessage;
        try { message = JSON.parse(String(event.data)) as ServerMessage; }
        catch { this.error = "The server sent an unreadable update."; this.changed(); return; }
        this.receive(message);
      });
      ws.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Connection failed")); });
      ws.addEventListener("close", () => {
        clearTimeout(timeout); reject(new Error("Connection closed"));
        if (ws !== this.ws) return;
        this.ws = null; this.connected = false; this.commands.length = 0;
        if (this.batch) clearInterval(this.batch); this.batch = null;
        if (this.closed) return;
        this.busy = false; this.onDisconnect?.();
        if (this.ticket && this.hello) {
          this.retryUntil ||= Date.now() + 60_000;
          this.status = "Connection lost. Rejoining your reserved slot…";
          this.scheduleReconnect();
        } else this.error = "Connection lost. Check the local server and try again.";
        this.changed();
      });
    }).finally(() => { if (this.opening === opening) this.opening = null; });
    this.opening = opening;
    return opening;
  }

  private scheduleReconnect() {
    if (this.retry || this.closed) return;
    if (Date.now() >= this.retryUntil) {
      this.error = "Could not reconnect within 60 seconds. You can join the room again if a slot is available.";
      this.loseMembership(); this.changed(); return;
    }
    this.retry = setTimeout(async () => {
      this.retry = null;
      try {
        await this.open();
        if (this.ticket && this.hello) this.send({ type: "join", protocol: LAN_PROTOCOL, hello: this.hello, ...this.ticket });
      } catch { this.scheduleReconnect(); }
    }, 1000);
  }

  private flush() {
    const now = Date.now();
    if (now - this.lastReceived > 7000) { this.ws?.close(); return; }
    if (now - this.lastPing > 2000) { this.lastPing = now; this.send({ type: "ping", at: now }); }
    if (!this.commands.length || !this.matchId || !this.ws || this.ws.bufferedAmount > 64_000) return;
    this.send({ type: "input", matchId: this.matchId, commands: this.commands.splice(0, 8) });
  }

  private receive(message: ServerMessage) {
    if (message.type === "welcome") {
      if (message.protocol !== LAN_PROTOCOL) { this.error = "This server uses a different game version. Reload from its address."; this.changed(); return; }
      this.ticket = { code: message.code, token: message.token };
      try { this.storage?.setItem(this.key, JSON.stringify(this.ticket)); } catch { /* Live play still works without persistence. */ }
      this.slotId = message.slotId; this.room = message.room;
      this.connected = true;
      this.matchId = message.room.matchId;
      this.retryUntil = 0; this.busy = false; this.error = null;
      this.status = message.resumed ? "Rejoined your slot." : `Room ${message.code}`;
      this.changed();
    } else if (message.type === "room") {
      if (!this.room || message.room.code !== this.room.code || message.room.revision < this.room.revision) return;
      if (message.room.matchId !== this.matchId) this.commands.length = 0;
      this.room = message.room; this.matchId = message.room.matchId; this.busy = false;
      this.changed();
    } else if (message.type === "snapshot") {
      if (message.state.matchId !== this.matchId) return;
      this.onSnapshot?.(message.state);
    } else if (message.type === "error") {
      this.error = message.message; this.busy = false;
      if (/token|session|reserv|expired|not_joined|not_found|room_missing/i.test(message.code)) this.loseMembership();
      this.changed();
    }
  }

  private loseMembership() {
    this.connected = false; this.room = null; this.slotId = null; this.matchId = null;
    this.commands.length = 0; this.retryUntil = 0;
    this.status = "Your previous slot is no longer reserved. Join a room to continue.";
    this.forgetTicket(); this.onDisconnect?.();
  }

  private shutdown() {
    this.closed = true;
    this.generation++;
    this.opening = null;
    if (this.retry) clearTimeout(this.retry); this.retry = null;
    if (this.batch) clearInterval(this.batch); this.batch = null;
    this.ws?.close(); this.ws = null; this.connected = false; this.retryUntil = 0;
  }
  dispose() { this.idle(); this.shutdown(); this.onChange = this.onSnapshot = this.onDisconnect = null; }
}
