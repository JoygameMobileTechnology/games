import { createGame, tickGame, applyAction, snapshotGame, endGame } from '../shared/game.js';
import { resultPresentationActive } from '../shared/presentation.js';
import { chooseAIAction } from '../server/ai.js';

const textField = (value, max = 128) => typeof value === 'string' && value.length <= max;
const cleanName = value => (typeof value === 'string' ? value : 'Captain').replace(/[<>\x00-\x1f]/g, '').trim().slice(0, 22) || 'Captain';
const MAX_VISIBLE_GAP_MS = 1000;

/** In-memory solo transport for the static edition. It shares all gameplay and
 * AI code with the Node host, but creates no network connection or LAN room. */
export class SoloSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 3;

  readyState = SoloSocket.CONNECTING;
  #game = null;
  #name = 'Captain';
  #firstSide;
  #startingSideOverride;
  #accepted = new Map();
  #lastSequence = 0;
  #matchNumber = 0;
  #aiTurn = null;
  #aiDue = Infinity;
  #lastPublish = -Infinity;
  #timer;
  #rawNow;
  #lastRaw;
  #virtualNow;
  #visibility;
  #hidden;
  #onVisibility;
  #cancel;
  #random;
  #config;

  constructor({ now = () => performance.now(), schedule = callback => setInterval(callback, 1000 / 30), cancel = clearInterval, random = Math.random, gameConfig = {}, firstSide, visibility = globalThis.document } = {}) {
    super();
    this.#rawNow = now;
    this.#lastRaw = this.#virtualNow = now();
    this.#visibility = visibility;
    this.#hidden = Boolean(visibility?.hidden);
    this.#onVisibility = () => {
      const raw = this.#rawNow();
      this.#readTime(raw);
      const resuming = this.#hidden && !visibility.hidden;
      this.#hidden = Boolean(visibility.hidden);
      if (resuming) {
        this.tick(raw);
        // Reset the view's interpolation anchor before its first resumed frame.
        this.#publish();
      }
    };
    visibility?.addEventListener('visibilitychange', this.#onVisibility);
    this.#cancel = cancel;
    this.#random = random;
    this.#config = gameConfig;
    this.#startingSideOverride = firstSide;
    queueMicrotask(() => {
      if (this.readyState !== SoloSocket.CONNECTING) return;
      this.readyState = SoloSocket.OPEN;
      this.#timer = schedule(() => this.tick());
      this.dispatchEvent(new Event('open'));
    });
  }

  // Solo can pause with its browser; a shared Node host must keep its own clock.
  // The fallback also handles suspension without a delivered visibility event.
  #readTime(raw = this.#rawNow()) {
    if (this.readyState === SoloSocket.CLOSED) return this.#virtualNow;
    const delta = Math.max(0, raw - this.#lastRaw);
    this.#lastRaw = raw;
    // Leave ample margin below the engine's ten-second host interruption gate:
    // UI clock reads can occur shortly after the last simulation tick.
    if (!this.#hidden && delta <= MAX_VISIBLE_GAP_MS) this.#virtualNow += delta;
    return this.#virtualNow;
  }

  get currentTime() { return this.#readTime(); }

  #emit(payload) {
    const data = JSON.stringify(payload);
    queueMicrotask(() => {
      if (this.readyState === SoloSocket.OPEN) this.dispatchEvent(new MessageEvent('message', { data }));
    });
  }

  #fail(code, message, commandId) {
    this.#emit({ type: 'error', code, message, ...(typeof commandId === 'string' ? { commandId } : {}) });
  }

  #publish(now = this.#virtualNow) {
    if (!this.#game) return;
    this.#emit({ type: 'state', you: 0, room: {
      code: 'SOLO', mode: 'ai', players: [this.#name, 'Captain Cinder'].map(name => ({ name, connected: true, ready: true })), rematch: [false, false],
    }, state: snapshotGame(this.#game) });
    this.#lastPublish = now;
  }

  #startMatch(now) {
    const previousLineup = this.#game?.state.lineup.join(',');
    const previousFormation = this.#game?.state.formation.id;
    const id = `solo-${++this.#matchNumber}-${Math.floor(this.#random() * 0x100000000).toString(16)}`;
    let attempts = 0;
    do {
      this.#game = createGame({ id, now, seed: Math.floor(this.#random() * 0x100000000), firstSide: this.#firstSide, config: this.#config, excludeFormationId: previousFormation });
    } while (previousLineup && this.#game.state.lineup.join(',') === previousLineup && ++attempts < 12);
    this.#accepted.clear();
    this.#lastSequence = 0;
    this.#aiTurn = null;
    this.#aiDue = Infinity;
    this.#publish(now);
  }

  send(raw) {
    if (this.readyState !== SoloSocket.OPEN) throw new Error('Solo transport is not open.');
    let message;
    try {
      message = JSON.parse(raw);
      if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') throw new Error();
    } catch {
      this.#fail('BAD_MESSAGE', 'That message could not be read.');
      return;
    }
    const now = this.#readTime();
    if (message.type === 'ping') { this.#emit({ type: 'pong', sentAt: message.sentAt, serverNow: now }); return; }
    if (message.type === 'leave') {
      this.#game = null;
      this.#accepted.clear();
      this.#aiTurn = null;
      this.#aiDue = Infinity;
      this.#emit({ type: 'left' });
      return;
    }
    if (message.type === 'resume') { this.#fail('RESUME_FAILED', 'Start a new solo battle after reloading this page.'); return; }
    if (message.type === 'join' || message.type === 'create' && message.mode !== 'ai') {
      this.#fail('SOLO_ONLY', 'This browser edition plays against AI. Use the Node host for LAN battles.');
      return;
    }
    if (message.type === 'create') {
      if (message.name !== undefined && !textField(message.name)) { this.#fail('BAD_MESSAGE', 'The commander name must be text.'); return; }
      this.#name = cleanName(message.name);
      this.#game = null;
      this.#firstSide = this.#startingSideOverride === 0 || this.#startingSideOverride === 1 ? this.#startingSideOverride : this.#random() < .5 ? 0 : 1;
      this.#emit({ type: 'joined', roomCode: 'SOLO', side: 0, resumeToken: 'local-solo' });
      this.#startMatch(now);
      return;
    }
    if (!this.#game) { this.#fail('NOT_JOINED', 'Start a solo battle first.', message.commandId); return; }
    if (message.type === 'rematch') {
      if (!this.#game.state.result) { this.#fail('MATCH_ACTIVE', 'Finish this match first.'); return; }
      if (resultPresentationActive(this.#game.state.result, now)) { this.#fail('FINALE_ACTIVE', 'Watch the final destruction before starting a rematch.'); return; }
      this.#firstSide = 1 - this.#firstSide;
      this.#startMatch(now);
      return;
    }
    if (message.type !== 'action') { this.#fail('BAD_MESSAGE', 'Unknown message type.', message.commandId); return; }
    const action = message.action;
    if (message.protocolVersion !== 1 || !textField(message.commandId) || !message.commandId.length || !textField(message.matchId) || !message.matchId.length || !Number.isSafeInteger(message.turnId) || message.turnId < 1 || !Number.isSafeInteger(message.sequence) || message.sequence < 1 || !action || typeof action !== 'object' || Array.isArray(action) || !textField(action.unitId) || !textField(action.weaponId) || !['fire', 'build'].includes(action.kind) || action.targetId !== undefined && !textField(action.targetId)) {
      this.#fail('BAD_MESSAGE', 'Invalid action message.', message.commandId);
      return;
    }
    const key = `${message.matchId}:${message.commandId}`;
    if (this.#accepted.has(key)) { this.#emit(this.#accepted.get(key)); return; }
    tickGame(this.#game, now);
    if (message.matchId !== this.#game.state.matchId) { this.#fail('WRONG_MATCH', 'That action belongs to an earlier match.', message.commandId); return; }
    if (message.turnId !== this.#game.state.turnId) { this.#fail('STALE_TURN', 'That turn has ended.', message.commandId); this.#publish(now); return; }
    if (message.sequence <= this.#lastSequence) { this.#fail('STALE_SEQUENCE', 'That input has already been superseded.', message.commandId); return; }
    this.#lastSequence = message.sequence;
    const result = applyAction(this.#game, 0, action, now);
    if (!result.ok) { this.#fail('ACTION_REJECTED', result.reason || 'That action is not available.', message.commandId); this.#publish(now); return; }
    const ack = { type: 'ack', commandId: message.commandId };
    this.#accepted.set(key, ack);
    if (this.#accepted.size > 128) this.#accepted.delete(this.#accepted.keys().next().value);
    this.#emit(ack);
    this.#publish(now);
  }

  /** The ordinary timer drives this method; clock/scheduler injection keeps
   * transport tests deterministic without exposing gameplay mutation routes. */
  tick(raw = this.#rawNow()) {
    const now = this.#readTime(raw);
    if (this.readyState !== SoloSocket.OPEN || this.#hidden || !this.#game) return;
    const before = `${this.#game.state.phase}:${this.#game.state.turnId}:${this.#game.state.result?.reason}`;
    try {
      tickGame(this.#game, now);
      const state = this.#game.state;
      if (!state.result && state.phase === 'aim' && state.activeSide === 1) {
        if (this.#aiTurn !== state.turnId) {
          this.#aiTurn = state.turnId;
          this.#aiDue = now + Math.min(1000, Math.max(20, (state.turnDeadline - now) * .12));
        }
        if (now >= this.#aiDue) {
          this.#aiDue = Infinity;
          const action = chooseAIAction(snapshotGame(this.#game));
          if (action) applyAction(this.#game, 1, action, now);
        }
      }
    } catch {
      endGame(this.#game, null, 'The browser could not finish the simulation', true);
    }
    const after = `${this.#game.state.phase}:${this.#game.state.turnId}:${this.#game.state.result?.reason}`;
    if (before !== after || now - this.#lastPublish >= 100) this.#publish(now);
  }

  close(code = 1000) {
    if (this.readyState === SoloSocket.CLOSED) return;
    this.readyState = SoloSocket.CLOSED;
    if (this.#timer !== undefined) this.#cancel(this.#timer);
    this.#visibility?.removeEventListener('visibilitychange', this.#onVisibility);
    this.#game = null;
    this.#accepted.clear();
    queueMicrotask(() => {
      const event = new Event('close');
      Object.defineProperty(event, 'code', { value: code });
      this.dispatchEvent(event);
    });
  }
}
