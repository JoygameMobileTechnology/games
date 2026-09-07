import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { createServer } from '../server/index.js';
import { snapBuild, getBuildBounds, validateBuild, predictShot } from '../shared/game.js';
import { WORLD } from '../shared/content.js';

const FAST_GAME = {
  countdownMs: 30,
  turnMs: 500,
  regulationMs: 30_000,
  transitionMs: 200,
  resolutionMs: 200,
  waterMs: 10,
};

async function fixture(t, options = {}) {
  const host = await createServer({ port: 0, host: '127.0.0.1', gameConfig: FAST_GAME, ...options });
  const origin = `http://127.0.0.1:${host.port}`;
  const clients = [];
  t.after(async () => {
    for (const client of clients) client.close();
    await host.close();
  });
  return {
    host,
    origin,
    async connect() {
      const socket = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin });
      const messages = [];
      const waiting = new Set();
      let sequence = 0;
      socket.on('message', raw => {
        const message = JSON.parse(raw.toString());
        messages.push(message);
        for (const wake of [...waiting]) wake();
      });
      // Expected socket replacement during resume is not an uncaught test error.
      socket.on('error', () => {});
      const client = {
        socket,
        messages,
        get cursor() { return messages.length; },
        send(message) { socket.send(JSON.stringify(message)); },
        close() { socket.terminate(); },
        waitFor(predicate, { after = 0, timeout = 5_000 } = {}) {
          return new Promise((resolve, reject) => {
            let timer;
            const check = () => {
              const found = messages.slice(after).find(predicate);
              if (!found) return;
              clearTimeout(timer);
              waiting.delete(check);
              resolve(found);
            };
            timer = setTimeout(() => {
              waiting.delete(check);
              const recent = messages.slice(-5).map(m => ({ type: m.type, code: m.code, phase: m.state?.phase, turnId: m.state?.turnId }));
              reject(new Error(`Timed out waiting for server message. Recent: ${JSON.stringify(recent)}`));
            }, timeout);
            waiting.add(check);
            check();
          });
        },
        state(predicate, options) {
          return this.waitFor(message => message.type === 'state' && predicate(message.state, message), options);
        },
        command(state, action, overrides = {}) {
          return {
            type: 'action',
            protocolVersion: 1,
            matchId: state.matchId,
            turnId: state.turnId,
            commandId: randomUUID(),
            sequence: ++sequence,
            action,
            ...overrides,
          };
        },
      };
      clients.push(client);
      await new Promise((resolve, reject) => {
        socket.once('open', resolve);
        socket.once('error', reject);
      });
      return client;
    },
  };
}

async function pvp(f) {
  const host = await f.connect();
  host.send({ type: 'create', mode: 'pvp', name: 'Ember' });
  const joinedHost = await host.waitFor(m => m.type === 'joined');
  const guest = await f.connect();
  guest.send({ type: 'join', code: joinedHost.roomCode, name: 'Tide' });
  const joinedGuest = await guest.waitFor(m => m.type === 'joined');
  return { clients: [host, guest], seats: [joinedHost, joinedGuest], code: joinedHost.roomCode };
}

async function startPvp(pair) {
  for (const client of pair.clients) client.send({ type: 'ready', ready: true });
  const update = await pair.clients[0].state(state => state?.phase === 'aim');
  return update.state;
}

function shot(state, weaponId = 'basic') {
  return {
    kind: 'fire',
    unitId: state.activeUnitId,
    weaponId,
    angle: state.activeSide === 0 ? -0.55 : -Math.PI + 0.55,
    power: 0.8,
  };
}

test('HTTP serves the game, shared modules, host addresses and a room QR', async t => {
  const f = await fixture(t);
  const client = await f.connect();
  client.send({ type: 'create', mode: 'pvp', name: 'QR host' });
  const joined = await client.waitFor(m => m.type === 'joined');
  const responses = await Promise.all([
    fetch(`${f.origin}/health`),
    fetch(`${f.origin}/`),
    fetch(`${f.origin}/shared/content.js`),
    fetch(`${f.origin}/api/host`),
    fetch(`${f.origin}/api/qr?code=${joined.roomCode}&origin=${encodeURIComponent(f.origin)}`),
  ]);
  for (const response of responses) assert.equal(response.status, 200, response.url);
  assert.match(await responses[1].text(), /<html/i);
  assert.match(await responses[2].text(), /WEAPONS/);
  const host = await responses[3].json();
  assert.equal(host.port, f.host.port);
  assert.ok(Array.isArray(host.urls) && host.urls.length > 0);
  assert.match(await responses[4].text(), /<svg/);
  assert.equal((await fetch(`${f.origin}/not-a-real-file`)).status, 404);
  assert.equal((await fetch(`${f.origin}/server/index.js`)).status, 404);
  assert.equal((await fetch(`${f.origin}/package.json`)).status, 404);
});

test('PvE creates exactly one AI opponent and begins without a second browser', async t => {
  const f = await fixture(t);
  const client = await f.connect();
  client.send({ type: 'create', mode: 'ai', name: 'Solo' });
  const joined = await client.waitFor(m => m.type === 'joined');
  assert.match(joined.roomCode, /^[A-Z0-9]{5}$/);
  assert.ok(joined.resumeToken);
  const message = await client.state(state => state?.phase === 'aim');
  assert.equal(message.room.mode, 'ai');
  assert.equal(message.room.players.length, 2);
  assert.equal(message.state.teams.length, 2);
  assert.equal(message.state.lineup.length, 6);
  for (const team of message.state.teams) assert.equal(team.units.length, 3);
});

test('PvP waits for both ready players, rejects a third seat and shares authoritative state', async t => {
  const f = await fixture(t);
  const pair = await pvp(f);
  assert.notEqual(pair.seats[0].side, pair.seats[1].side);
  const lobby = await pair.clients[0].state((state, message) => !state && message.room.players.filter(Boolean).length === 2);
  assert.equal(lobby.state, null);
  const third = await f.connect();
  third.send({ type: 'join', code: pair.code, name: 'Extra' });
  assert.equal((await third.waitFor(m => m.type === 'error')).type, 'error');
  const marker = pair.clients[0].cursor;
  pair.clients[0].send({ type: 'ready', ready: true });
  const oneReady = await pair.clients[0].state((state, message) => !state && message.room.players.filter(p => p?.ready).length === 1, { after: marker });
  assert.equal(oneReady.state, null);
  pair.clients[1].send({ type: 'ready', ready: true });
  const first = await pair.clients[0].state(state => state?.phase === 'countdown' || state?.phase === 'aim');
  const second = await pair.clients[1].state(state => state?.matchId === first.state.matchId);
  assert.deepEqual(second.state.lineup, first.state.lineup);
  assert.deepEqual(second.state.formation, first.state.formation);
  assert.equal(second.state.teams[0].units.length, 3);
});

test('authority rejects another seat, stale turns and invalid input; duplicate commands spend ammo once', async t => {
  const f = await fixture(t);
  const pair = await pvp(f);
  const initial = await startPvp(pair);
  const acting = pair.clients[pair.seats.findIndex(seat => seat.side === initial.activeSide)];
  const inactive = pair.clients.find(client => client !== acting);
  const defaultWeapon = Object.keys(initial.teams[initial.activeSide].ammo).find(id => initial.teams[initial.activeSide].ammo[id] === -1);
  assert.ok(defaultWeapon, 'an infinite default weapon is available');

  const wrongSeat = inactive.command(initial, shot(initial, defaultWeapon));
  inactive.send(wrongSeat);
  await inactive.waitFor(m => m.type === 'error' && m.commandId === wrongSeat.commandId);

  const stale = acting.command(initial, shot(initial, defaultWeapon), { turnId: `old-${initial.turnId}` });
  acting.send(stale);
  await acting.waitFor(m => m.type === 'error' && m.commandId === stale.commandId);

  const invalid = acting.command(initial, { ...shot(initial, defaultWeapon), power: null });
  acting.send(invalid);
  await acting.waitFor(m => m.type === 'error' && m.commandId === invalid.commandId);

  const advancedState = (await pair.clients[0].state(state => state?.phase === 'aim' && state.unlockedCount >= 1)).state;
  const activeClient = pair.clients[pair.seats.findIndex(seat => seat.side === advancedState.activeSide)];
  const weaponId = advancedState.lineup[0];
  const ammoBefore = advancedState.teams[advancedState.activeSide].ammo[weaponId];
  assert.ok(ammoBefore > 0 && ammoBefore <= 2);
  const accepted = activeClient.command(advancedState, shot(advancedState, weaponId));
  activeClient.send(accepted);
  await activeClient.waitFor(m => m.type === 'ack' && m.commandId === accepted.commandId);
  const duplicateMarker = activeClient.cursor;
  activeClient.send(accepted);
  await activeClient.waitFor(m => m.type === 'ack' && m.commandId === accepted.commandId, { after: duplicateMarker });
  const extra = activeClient.command(advancedState, shot(advancedState, weaponId));
  activeClient.send(extra);
  await activeClient.waitFor(m => m.type === 'error' && m.commandId === extra.commandId);
  const verificationMarker = activeClient.cursor;
  const after = await activeClient.state(state => state?.matchId === advancedState.matchId, { after: verificationMarker });
  assert.equal(after.state.teams[advancedState.activeSide].ammo[weaponId], ammoBefore - 1);
  assert.equal(after.state.teams[advancedState.activeSide].ammo[defaultWeapon], -1);
});

test('PvP shares floating barricades and replayed build commands spend a single charge', async t => {
  const f = await fixture(t, { gameConfig: { ...FAST_GAME, turnMs: 3000, resolutionMs: 1000 } });
  const pair = await pvp(f);
  const initial = await startPvp(pair);
  const acting = pair.clients[pair.seats.findIndex(seat => seat.side === initial.activeSide)];
  const authoritative = f.host.rooms.get(pair.code).game;
  // Unlock scheduling has separate coverage; grant this scarce kit in the
  // in-process fixture without adding any client or public debug endpoint.
  authoritative.state.teams[initial.activeSide].ammo.barricade = 1;
  const bounds = getBuildBounds(initial, initial.activeSide);
  const placement = Array.from({ length: bounds.w / 28 }, (_, col) => snapBuild(initial, initial.activeSide, bounds.x + col * 28, bounds.y))
    .find(point => validateBuild(initial, initial.activeSide, 'barricade', point.x, point.y).ok);
  assert.ok(placement, 'the castle has an open floating cover position');
  const command = acting.command(initial, { kind: 'build', unitId: initial.activeUnitId, weaponId: 'barricade', ...placement });
  const markers = pair.clients.map(client => client.cursor);
  acting.send(command);
  await acting.waitFor(message => message.type === 'ack' && message.commandId === command.commandId);
  const duplicateMarker = acting.cursor;
  acting.send(command);
  await acting.waitFor(message => message.type === 'ack' && message.commandId === command.commandId, { after: duplicateMarker });
  const updates = await Promise.all(pair.clients.map((client, index) => client.state(state =>
    state?.matchId === initial.matchId && state.turnId > initial.turnId && state.phase === 'aim', { after: markers[index] })));
  const cover = updates.map(update => update.state.tiles.filter(tile => tile.constructed));
  assert.equal(cover[0].length, 3);
  assert.deepEqual(cover[0], cover[1]);
  for (const tiles of cover) {
    assert.ok(tiles.every(tile => tile.floating && !tile.falling && tile.hp === 45));
    assert.deepEqual(tiles.map(tile => ({ x: tile.x, y: tile.y })), [0, 1, 2].map(row => ({ x: placement.x, y: placement.y + row * 28 })));
  }
  for (const { state } of updates) {
    assert.equal(state.teams[initial.activeSide].ammo.barricade, 0);
    assert.equal(state.completedTurns, initial.completedTurns + 1);
    assert.equal(state.events.filter(event => event.type === 'build').length, 1);
  }
});

test('both LAN clients watch a legal high Lob beyond four seconds, reject extra shots, and share its eventual landing', async t => {
  const f = await fixture(t, { gameConfig: { ...FAST_GAME, turnMs: 10_000, resolutionMs: 2000 } });
  const pair = await pvp(f), initial = await startPvp(pair);
  const acting = pair.clients[pair.seats.findIndex(seat => seat.side === initial.activeSide)];
  // Aim exclusively from the public snapshot. Search handles each randomly
  // selected formation and wind without changing the server's game state.
  let candidate;
  for (let index = 0; index <= 120; index++) {
    const angle = -Math.PI + 0.5 + index * (Math.PI - 1) / 120;
    const prediction = predictShot(initial, initial.activeUnitId, 'lob', angle, 1);
    if (prediction.hitType === 'ground' && prediction.x > 620 && prediction.x < 1380 && prediction.points.length > 145 &&
      (!candidate || prediction.points.length > candidate.prediction.points.length)) candidate = { angle, prediction };
  }
  assert.ok(candidate, 'the initial shooter has a long legal arc into the open battlefield');
  assert.ok(candidate.prediction.points.some(point => point.y < -500));
  const command = acting.command(initial, { ...shot(initial, 'lob'), angle: candidate.angle, power: 1 });
  const markers = pair.clients.map(client => client.cursor);
  acting.send(command);
  await acting.waitFor(message => message.type === 'ack' && message.commandId === command.commandId);
  const launchState = (await acting.state(state => state?.matchId === initial.matchId && state.phase === 'resolve' && state.projectiles.length === 1)).state;
  const projectileId = launchState.projectiles[0].id;
  const launchAt = launchState.events.find(event => event.type === 'launch' && event.weaponId === 'lob').at;

  const airborne = await pair.clients[0].state(state => state?.matchId === initial.matchId && state.now >= launchAt + 4300 &&
    state.phase === 'resolve' && state.projectiles.some(projectile => projectile.id === projectileId), { after: markers[0], timeout: 6500 });
  const sameFrame = await pair.clients[1].state(state => state?.matchId === initial.matchId && state.now === airborne.state.now, { after: markers[1] });
  assert.deepEqual(sameFrame.state.projectiles, airborne.state.projectiles, 'both clients receive the same authoritative sky projectile');
  for (const { state } of [airborne, sameFrame]) {
    assert.equal(state.turnId, initial.turnId);
    assert.equal(state.activeUnitId, initial.activeUnitId);
    assert.equal(state.activeSide, initial.activeSide);
    assert.equal(state.completedTurns, initial.completedTurns);
    assert.equal(state.teams[initial.activeSide].ammo.lob, -1);
    assert.equal(state.events.filter(event => event.type === 'explosion').length, 0);
    assert.ok(state.projectiles[0].age > 4.2);
  }
  for (const client of pair.clients) {
    const extra = client.command(airborne.state, shot(airborne.state));
    client.send(extra);
    const rejected = await client.waitFor(message => message.type === 'error' && message.commandId === extra.commandId);
    assert.equal(rejected.code, 'ACTION_REJECTED');
    assert.equal(rejected.message, 'NOT_AIMING');
  }

  const landed = await Promise.all(pair.clients.map((client, index) => client.state(state => state?.matchId === initial.matchId &&
    state.phase === 'aim' && state.turnId === initial.turnId + 1, { after: markers[index], timeout: 4000 })));
  const landingEvents = landed.map(({ state }) => state.events.filter(event => event.type === 'explosion' && event.weaponId === 'lob'));
  assert.equal(landingEvents[0].length, 1);
  assert.deepEqual(landingEvents[0], landingEvents[1]);
  assert.ok(landingEvents[0][0].at - launchAt > 4300);
  assert.ok(Math.abs(landingEvents[0][0].x - candidate.prediction.x) < 0.2);
  for (const { state } of landed) {
    assert.equal(state.projectiles.length, 0);
    assert.equal(state.activeSide, 1 - initial.activeSide);
    assert.equal(state.completedTurns, initial.completedTurns + 1);
    assert.equal(state.teams[initial.activeSide].ammo.lob, -1);
  }
});

test('resume recovers the same seat and rejects an unrelated credential', async t => {
  const f = await fixture(t);
  const pair = await pvp(f);
  const [originalSeat] = pair.seats;
  pair.clients[0].close();
  const resumed = await f.connect();
  resumed.send({ type: 'resume', code: pair.code, token: originalSeat.resumeToken });
  const joined = await resumed.waitFor(m => m.type === 'joined');
  assert.equal(joined.side, originalSeat.side);
  assert.equal(joined.roomCode, pair.code);
  const current = await resumed.state((state, message) => message.room.players.filter(p => p?.connected).length === 2);
  assert.equal(current.room.players.length, 2);
  const stranger = await f.connect();
  stranger.send({ type: 'resume', code: pair.code, token: randomUUID() });
  await stranger.waitFor(m => m.type === 'error');
});

test('expired resume credentials cannot recover a seat after disconnect grace', async t => {
  const f = await fixture(t, { reconnectGraceMs: 100 });
  const pair = await pvp(f);
  await startPvp(pair);
  pair.clients[0].close();
  await pair.clients[1].state(state => state?.phase === 'ended', { timeout: 3_000 });
  const returning = await f.connect();
  returning.send({ type: 'resume', code: pair.code, token: pair.seats[0].resumeToken });
  await returning.waitFor(m => m.type === 'error');
});

test('both-player rematch resets the arsenal and water and swaps initiative', async t => {
  const f = await fixture(t, {
    gameConfig: { ...FAST_GAME, turnMs: 60, regulationMs: 450, transitionMs: 150, resolutionMs: 100, waterMs: 10 },
  });
  const pair = await pvp(f);
  const initial = await startPvp(pair);
  const ended = await pair.clients[0].state(state => state?.phase === 'ended', { timeout: 5_000 });
  assert.ok(ended.state.completedTurns > 0);
  assert.equal(ended.state.result.presentation.drowning.endsAt - ended.state.result.endedAt, 1000);
  await pair.clients[0].state(state => state?.result && state.now >= ended.state.result.presentation.endsAt);
  const marker = pair.clients[0].cursor;
  pair.clients[0].send({ type: 'rematch' });
  const oneAccepted = await pair.clients[0].state((state, message) => state?.phase === 'ended' && message.room.rematch.filter(Boolean).length === 1, { after: marker });
  assert.equal(oneAccepted.state.matchId, initial.matchId);
  pair.clients[1].send({ type: 'rematch' });
  const rematch = await pair.clients[0].state(state => state && state.matchId !== initial.matchId && state.phase === 'countdown', { after: marker });
  assert.equal(rematch.state.activeSide, 1 - initial.activeSide);
  assert.ok(initial.formation?.id);
  assert.ok(rematch.state.formation?.id);
  assert.notEqual(rematch.state.formation.id, initial.formation.id);
  assert.equal(rematch.state.completedTurns, 0);
  assert.equal(rematch.state.unlockedCount, 0);
  assert.equal(rematch.state.waterRise, 0);
  for (const team of rematch.state.teams) {
    assert.equal(team.core.hp, team.core.maxHp);
    assert.ok(team.units.every(unit => unit.alive && unit.hp === unit.maxHp));
  }
});

test('both LAN players and a resumed seat share the core finale; rematch waits for its authoritative end', async t => {
  const f = await fixture(t, { gameConfig: { ...FAST_GAME, turnMs: 10_000, resolutionMs: 6000 } });
  const pair = await pvp(f);
  const initial = await startPvp(pair), side = initial.activeSide;
  const game = f.host.rooms.get(pair.code).game;
  game.state.tiles = [];
  const reflect = (x, w) => side ? WORLD.width - x - w : x;
  for (const team of game.state.teams) {
    const attacking = team.side === side;
    Object.assign(team.core, { x: reflect(attacking ? 100 : 720, team.core.w), y: WORLD.groundY - team.core.h, hp: attacking ? team.core.maxHp : 1 });
    for (const unit of team.units) Object.assign(unit, { x: reflect(attacking ? 600 : 1800, unit.w), y: WORLD.groundY - unit.h, ...(unit.id === game.state.activeUnitId || unit.order === 0 ? {} : { hp: 0, alive: false }) });
  }
  const acting = pair.clients[pair.seats.findIndex(seat => seat.side === side)];
  acting.send(acting.command(initial, { ...shot(initial), angle: side ? Math.PI : 0, power: 1 }));
  const ended = await Promise.all(pair.clients.map(client => client.state(state => state?.result?.presentation?.cores.length === 1)));
  const presentation = ended[0].state.result.presentation;
  assert.deepEqual(ended[1].state.result.presentation, presentation);
  assert.equal(ended[0].state.result.winner, side);
  assert.ok(presentation.endsAt > ended[0].state.now);

  for (const client of pair.clients) client.send({ type: 'rematch' });
  await Promise.all(pair.clients.map(client => client.waitFor(message => message.type === 'error' && message.code === 'FINALE_ACTIVE')));
  assert.deepEqual(f.host.rooms.get(pair.code).rematch, [false, false]);

  pair.clients[0].close();
  const resumed = await f.connect();
  resumed.send({ type: 'resume', code: pair.code, token: pair.seats[0].resumeToken });
  const recovered = await resumed.state(state => state?.matchId === initial.matchId && state.result);
  assert.deepEqual(recovered.state.result.presentation, presentation, 'resume preserves effect IDs and clocks rather than restarting the animation');
  assert.ok(recovered.state.now < presentation.endsAt);
  await resumed.state(state => state?.matchId === initial.matchId && state.now >= presentation.endsAt, { timeout: 5000 });
  const cursor = resumed.cursor;
  resumed.send({ type: 'rematch' });
  pair.clients[1].send({ type: 'rematch' });
  const next = await resumed.state(state => state && state.matchId !== initial.matchId, { after: cursor });
  assert.equal(next.state.result, null);
  assert.equal(next.state.events.filter(event => event.type === 'core-destroyed').length, 0);
});

test('malformed and unknown messages do not crash the host; ping still works', async t => {
  const f = await fixture(t);
  const client = await f.connect();
  client.socket.send('{this is not JSON');
  await client.waitFor(m => m.type === 'error');
  const marker = client.cursor;
  client.send({ type: 'not-a-command' });
  await client.waitFor(m => m.type === 'error', { after: marker });
  client.send({ type: 'ping', sentAt: 12345 });
  const pong = await client.waitFor(m => m.type === 'pong');
  assert.equal(pong.sentAt, 12345);
  assert.ok(Number.isFinite(pong.serverNow));
  assert.equal((await fetch(`${f.origin}/health`)).status, 200);
});

test('object-valued identifiers and names are rejected without crashing or leaving the match', async t => {
  const f = await fixture(t);
  const pair = await pvp(f);
  const state = await startPvp(pair);
  const client = pair.clients[pair.seats.findIndex(seat => seat.side === state.activeSide)];
  // JSON can shadow both primitive-conversion methods with non-functions.
  const poisoned = { toString: 0, valueOf: 0 };
  const defaultWeapon = Object.keys(state.teams[state.activeSide].ammo).find(id => state.teams[state.activeSide].ammo[id] === -1);
  const malformed = [
    { type: 'create', mode: 'pvp', name: poisoned },
    { type: 'join', code: poisoned, name: 'Valid name' },
    { type: 'join', code: pair.code, name: poisoned },
    { type: 'resume', code: poisoned, token: 'invalid' },
    { type: 'resume', code: pair.code, token: poisoned },
    client.command(state, shot(state, defaultWeapon), { matchId: poisoned }),
    client.command(state, shot(state, defaultWeapon), { turnId: poisoned }),
    client.command(state, { ...shot(state, defaultWeapon), weaponId: poisoned }),
    client.command(state, { ...shot(state, defaultWeapon), unitId: poisoned }),
    client.command(state, { ...shot(state, defaultWeapon), targetId: poisoned }),
    client.command(state, []),
  ];
  for (const message of malformed) {
    const marker = client.cursor;
    client.send(message);
    const rejection = await client.waitFor(m => m.type === 'error', { after: marker });
    assert.equal(rejection.code, 'BAD_MESSAGE');
  }
  const accepted = client.command(state, shot(state, defaultWeapon));
  client.send(accepted);
  await client.waitFor(m => m.type === 'ack' && m.commandId === accepted.commandId);
  client.send({ type: 'ping', sentAt: 67890 });
  await client.waitFor(m => m.type === 'pong' && m.sentAt === 67890);
  assert.equal((await fetch(`${f.origin}/health`)).status, 200);
});
