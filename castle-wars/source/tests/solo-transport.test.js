import test from 'node:test';
import assert from 'node:assert/strict';
import { SoloSocket } from '../public/solo-transport.js';

class TestVisibility extends EventTarget {
  hidden = false;
  listeners = 0;
  addEventListener(type, ...args) { if (type === 'visibilitychange') this.listeners++; super.addEventListener(type, ...args); }
  removeEventListener(type, ...args) { if (type === 'visibilitychange') this.listeners--; super.removeEventListener(type, ...args); }
  setHidden(hidden) { this.hidden = hidden; this.dispatchEvent(new Event('visibilitychange')); }
}

async function fixture(t, options = {}) {
  let now = 0, seed = 314159, scheduled = 0, cancelled = 0;
  const messages = [];
  const socket = new SoloSocket({
    now: () => now,
    schedule: () => ++scheduled,
    cancel: () => ++cancelled,
    random: () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; },
    firstSide: 0,
    gameConfig: { countdownMs: 0, turnMs: 10_000, regulationMs: 60_000, transitionMs: 100, resolutionMs: 100, waterMs: 10 },
    ...options,
  });
  socket.addEventListener('message', event => messages.push(JSON.parse(event.data)));
  t.after(() => socket.close());
  assert.equal(socket.readyState, SoloSocket.CONNECTING);
  await Promise.resolve();
  assert.equal(socket.readyState, SoloSocket.OPEN);
  assert.equal(scheduled, 1);
  const f = {
    socket, messages,
    get state() { return messages.findLast(message => message.type === 'state')?.state; },
    get now() { return now; },
    get cancelled() { return cancelled; },
    elapse(ms) { now += ms; },
    async send(message) { socket.send(typeof message === 'string' ? message : JSON.stringify(message)); await Promise.resolve(); },
    async advance(ms, step = 34) {
      const end = now + ms;
      while (now < end) { now = Math.min(end, now + step); socket.tick(now); await Promise.resolve(); }
    },
    async until(predicate, limit = 20_000, step = 34) {
      const end = now + limit;
      while (!predicate(f.state) && now < end) await f.advance(step, step);
      assert.ok(predicate(f.state), `Condition not reached: ${JSON.stringify({ now, phase: f.state?.phase, turn: f.state?.turnId, result: f.state?.result })}`);
    },
    command(overrides = {}) {
      const state = f.state;
      return { type: 'action', protocolVersion: 1, commandId: 'shot-1', matchId: state.matchId, turnId: state.turnId, sequence: 1,
        action: { kind: 'fire', unitId: state.activeUnitId, weaponId: 'basic', angle: -1.3, power: 1 }, ...overrides };
    },
  };
  return f;
}

test('solo opens asynchronously and creates a real AI match without LAN room operations', async t => {
  const f = await fixture(t);
  await f.send({ type: 'create', mode: 'ai', name: '<Rocket Captain>' });
  const [joined, initial] = f.messages;
  assert.equal(joined.type, 'joined');
  assert.equal(joined.roomCode, 'SOLO');
  assert.equal(joined.side, 0);
  assert.equal(initial.room.mode, 'ai');
  assert.equal(initial.room.players[0].name, 'Rocket Captain');
  assert.ok(initial.room.players.every(player => player.ready && player.connected));
  assert.equal(initial.state.teams.length, 2);
  assert.equal(initial.state.teams[0].units.length, 3);
  assert.ok(initial.state.tiles.length > 100);
  await f.advance(34);
  assert.equal(f.state.phase, 'aim');
  assert.equal(f.state.activeSide, 0);
  for (const request of [{ type: 'join', code: 'ABCDE' }, { type: 'create', mode: 'pvp' }]) {
    await f.send(request);
    assert.equal(f.messages.at(-1).code, 'SOLO_ONLY');
    assert.equal(f.state.matchId, initial.state.matchId);
  }
});

test('player actions are validated and duplicates acknowledge one launch only', async t => {
  const f = await fixture(t);
  await f.send({ type: 'create', mode: 'ai' });
  await f.advance(34);
  await f.send(f.command({ matchId: 'old-match' }));
  assert.equal(f.messages.at(-1).code, 'WRONG_MATCH');
  await f.send(f.command({ turnId: 99 }));
  assert.equal(f.messages.findLast(message => message.type === 'error').code, 'STALE_TURN');
  await f.send(f.command({ action: { ...f.command().action, unitId: f.state.teams[1].units[0].id } }));
  assert.equal(f.messages.findLast(message => message.type === 'error').code, 'ACTION_REJECTED');
  await f.send(f.command({ commandId: 'stale' }));
  assert.equal(f.messages.at(-1).code, 'STALE_SEQUENCE');
  const command = f.command({ sequence: 2 });
  await f.send(command);
  assert.equal(f.state.phase, 'resolve');
  const initial = structuredClone(f.state);
  const published = f.messages.filter(message => message.type === 'state').length;
  await f.send(command);
  assert.equal(f.messages.filter(message => message.type === 'ack' && message.commandId === command.commandId).length, 2);
  assert.equal(f.messages.filter(message => message.type === 'state').length, published);
  assert.deepEqual(f.state.projectiles, initial.projectiles);
  assert.deepEqual(f.state.teams[0].ammo, initial.teams[0].ammo);
});

test('a player flight resolves, the real AI shoots, and control returns with shared unlocks', async t => {
  const f = await fixture(t);
  await f.send({ type: 'create', mode: 'ai' });
  await f.advance(34);
  const initialTurn = f.state.turnId;
  await f.send(f.command());
  await f.until(state => state.phase === 'aim' && state.activeSide === 1);
  const aiTurn = f.state.turnId;
  assert.ok(aiTurn > initialTurn);
  await f.until(state => state.phase === 'resolve' && state.activeSide === 1, 2000);
  assert.ok(f.state.projectiles.length || f.state.events.some(event => event.type === 'shot'));
  await f.until(state => state.phase === 'aim' && state.activeSide === 0);
  assert.ok(f.state.turnId > aiTurn);
  assert.equal(f.state.unlockedCount, 1);
  assert.equal(f.state.teams[0].ammo[f.state.lineup[0]], f.state.teams[1].ammo[f.state.lineup[0]]);
});

test('sudden-death finale blocks rematch until it ends, then resets and swaps the opening side', async t => {
  const f = await fixture(t, { gameConfig: { countdownMs: 0, turnMs: 1, regulationMs: 20, transitionMs: 0, resolutionMs: 10, waterMs: 1 } });
  await f.send({ type: 'create', mode: 'ai' });
  const original = f.state;
  await f.send({ type: 'rematch' });
  assert.equal(f.messages.at(-1).code, 'MATCH_ACTIVE');
  await f.until(state => state.result, 2000, 1);
  const result = f.state.result;
  assert.equal(result.interrupted, false);
  assert.ok(result.presentation.drowning);
  assert.equal(result.presentation.endsAt - result.presentation.startsAt, 1000);
  await f.send({ type: 'rematch' });
  assert.equal(f.messages.at(-1).code, 'FINALE_ACTIVE');
  await f.advance(result.presentation.endsAt - f.now, 1);
  await f.send({ type: 'rematch' });
  assert.notEqual(f.state.matchId, original.matchId);
  assert.notEqual(f.state.formation.id, original.formation.id);
  assert.equal(f.state.result, null);
  assert.equal(f.state.waterRise, 0);
  assert.equal(f.state.unlockedCount, 0);
  assert.equal(f.state.activeSide, 1);
  assert.ok(f.state.teams.every(team => team.core.hp === team.core.maxHp && team.units.every(unit => unit.alive && unit.hp === unit.maxHp)));
});

test('leave releases the match, resume explains reload behavior, and close cancels simulation', async t => {
  const f = await fixture(t);
  await f.send({ type: 'create', mode: 'ai' });
  await f.send({ type: 'leave' });
  assert.equal(f.messages.at(-1).type, 'left');
  const count = f.messages.length;
  await f.advance(1000);
  assert.equal(f.messages.length, count);
  await f.send({ type: 'resume', code: 'SOLO', token: 'local-solo' });
  assert.equal(f.messages.at(-1).code, 'RESUME_FAILED');
  await f.send({ type: 'create', mode: 'ai' });
  f.socket.close();
  assert.equal(f.socket.readyState, SoloSocket.CLOSED);
  assert.equal(f.cancelled, 1);
  const closedCount = f.messages.length;
  await f.advance(1000);
  assert.equal(f.messages.length, closedCount);
  assert.throws(() => f.socket.send('{}'), /not open/);
});

test('malformed input leaves the transport responsive', async t => {
  const f = await fixture(t);
  await f.send('{broken');
  assert.equal(f.messages.at(-1).code, 'BAD_MESSAGE');
  await f.send({ type: 'create', mode: 'ai', name: { toString: 0 } });
  assert.equal(f.messages.at(-1).code, 'BAD_MESSAGE');
  await f.send({ type: 'create', mode: 'ai' });
  await f.advance(34);
  await f.send(f.command({ action: { ...f.command().action, targetId: {} } }));
  assert.equal(f.messages.at(-1).code, 'BAD_MESSAGE');
  await f.send({ type: 'ping', sentAt: 987 });
  assert.deepEqual(f.messages.at(-1), { type: 'pong', sentAt: 987, serverNow: f.now });
});

test('closing before the queued open prevents timer creation and open delivery', async () => {
  let scheduled = 0, opened = 0;
  const socket = new SoloSocket({ schedule: () => ++scheduled });
  socket.addEventListener('open', () => ++opened);
  socket.close();
  await Promise.resolve();
  assert.equal(socket.readyState, SoloSocket.CLOSED);
  assert.equal(scheduled, 0);
  assert.equal(opened, 0);
});

test('fifteen seconds in a hidden tab preserves the solo turn, health and pending AI delay', async t => {
  const visibility = new TestVisibility();
  const f = await fixture(t, { visibility, firstSide: 1 });
  await f.send({ type: 'create', mode: 'ai' });
  await f.advance(34);
  assert.equal(f.state.phase, 'aim');
  assert.equal(f.state.activeSide, 1);
  const before = structuredClone(f.state);
  visibility.setHidden(true);
  await f.advance(15_000, 1000);
  assert.equal(f.socket.currentTime, before.now);
  await f.send({ type: 'ping', sentAt: f.now });
  assert.equal(f.messages.at(-1).serverNow, before.now, 'messages use the same frozen clock');
  visibility.setHidden(false);
  await Promise.resolve();
  assert.equal(f.state.now, before.now);
  assert.equal(f.state.result, null);
  assert.equal(f.state.turnId, before.turnId);
  assert.equal(f.state.turnDeadline, before.turnDeadline);
  assert.deepEqual(f.state.teams, before.teams);
  assert.equal(f.state.projectiles.length, 0, 'the AI does not spend its paused delay in the background');
  await f.advance(500);
  assert.equal(f.state.phase, 'aim');
  assert.equal(f.state.turnId, before.turnId);
  await f.until(state => state.phase === 'resolve' && state.activeSide === 1, 1000);
  assert.equal(f.state.result, null);
  assert.ok(f.state.now > before.now, 'visible simulation resumes');
  f.socket.close();
  assert.equal(visibility.listeners, 0, 'close releases its document listener');
});

test('an unobserved suspension gap does not interrupt solo or expire the next command', async t => {
  const f = await fixture(t);
  await f.send({ type: 'create', mode: 'ai' });
  await f.advance(34);
  const before = structuredClone(f.state);
  await f.advance(15_000, 15_000);
  assert.equal(f.socket.currentTime, before.now);
  assert.equal(f.state.result, null);
  assert.equal(f.state.turnId, before.turnId);
  assert.deepEqual(f.state.teams, before.teams);
  await f.send(f.command());
  assert.equal(f.messages.findLast(message => message.type === 'ack').commandId, 'shot-1');
  assert.equal(f.state.phase, 'resolve');
  assert.equal(f.state.now, before.now);
  await f.advance(200);
  assert.ok(f.state.now > before.now);
  assert.equal(f.state.result, null);
  // A UI clock read between simulation ticks must not let a just-under-10s
  // suspension become a >10s gap at the shared engine's next tick.
  f.elapse(34);
  const peek = f.socket.currentTime;
  f.elapse(9999);
  assert.equal(f.socket.currentTime, peek);
  await f.advance(100);
  assert.equal(f.state.result, null);
});

test('backgrounding a solo finale preserves its remaining animation and rematch delay', async t => {
  const visibility = new TestVisibility();
  const f = await fixture(t, { visibility, gameConfig: { countdownMs: 0, turnMs: 1, regulationMs: 20, transitionMs: 0, resolutionMs: 10, waterMs: 1 } });
  await f.send({ type: 'create', mode: 'ai' });
  await f.until(state => state.result, 2000, 1);
  await f.advance(200, 1);
  const id = f.state.matchId;
  const pausedAt = f.socket.currentTime;
  const remaining = f.state.result.presentation.endsAt - pausedAt;
  assert.ok(remaining > 0);
  visibility.setHidden(true);
  await f.advance(15_000, 1000);
  await f.send({ type: 'rematch' });
  assert.equal(f.messages.at(-1).code, 'FINALE_ACTIVE');
  visibility.setHidden(false);
  await Promise.resolve();
  assert.equal(f.state.now, pausedAt);
  assert.equal(f.state.result.presentation.endsAt - f.state.now, remaining);
  await f.advance(remaining - 1, 1);
  await f.send({ type: 'rematch' });
  assert.equal(f.messages.at(-1).code, 'FINALE_ACTIVE');
  await f.advance(1, 1);
  await f.send({ type: 'rematch' });
  assert.notEqual(f.state.matchId, id);
  assert.equal(f.state.result, null);
});
