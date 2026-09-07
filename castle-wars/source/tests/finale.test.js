import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tickGame, applyAction, endGame, snapshotGame } from '../shared/game.js';
import { WORLD } from '../shared/content.js';
import { CORE_DESTRUCTION_MS, COSMIC_EFFECT_MS, LAST_SHOOTER_FINISH_MS, DROWNING_FINISH_MS, createResultPresentation, resultPresentationActive } from '../shared/presentation.js';

function arena() {
  const g = createGame({ id: 'finale-test', config: { countdownMs: 0 } });
  tickGame(g, 0);
  g.state.tiles = [];
  for (const team of g.state.teams) {
    Object.assign(team.core, { x: team.side ? 1850 : 50, y: WORLD.groundY - team.core.h });
    for (const unit of team.units) Object.assign(unit, { x: team.side ? 1920 : 10, y: WORLD.groundY - unit.h });
  }
  return g;
}

function advance(g, until) {
  for (let now = g.lastTick + 16; now < until; now += 16) tickGame(g, now);
  tickGame(g, until);
}

function projectile(g, weaponId, x = 650, y = 715, vx = 6000, vy = 0) {
  g.state.teams[g.state.activeSide].ammo[weaponId] = 1;
  assert.equal(applyAction(g, g.state.activeSide, { kind: 'fire', unitId: g.state.activeUnitId, weaponId, angle: 0, power: 1 }, g.state.now + 1).ok, true);
  Object.assign(g.state.projectiles[0], { x, y, vx, vy });
}

test('lethal core hit emits once, locks the winner immediately and retains an immutable 3.2-second finale', () => {
  const g = arena(), core = g.state.teams[1].core;
  Object.assign(core, { x: 720, hp: 30 });
  projectile(g, 'basic');
  advance(g, 68);
  const events = g.state.events.filter(event => event.type === 'core-destroyed');
  assert.equal(events.length, 1);
  const [destroyed] = events;
  assert.deepEqual({ side: destroyed.side, coreId: destroyed.coreId, x: destroyed.x, y: destroyed.y }, { side: 1, coreId: core.id, x: core.x + core.w / 2, y: core.y + core.h / 2 });
  assert.equal(core.hp, 0);
  assert.equal(g.state.phase, 'ended');
  assert.equal(g.state.result.winner, 0);
  assert.equal(g.state.result.endedAt, destroyed.at);
  assert.equal(g.state.projectiles.length, 0);
  assert.deepEqual(g.state.result.presentation, { startsAt: destroyed.at, endsAt: destroyed.at + CORE_DESTRUCTION_MS, cores: [destroyed], explosions: [] });
  const frozen = structuredClone(g.state.result);
  assert.ok(resultPresentationActive(g.state.result, destroyed.at + CORE_DESTRUCTION_MS - 1));
  assert.equal(resultPresentationActive(g.state.result, destroyed.at + CORE_DESTRUCTION_MS), false);
  const previousEndedAt = g.state.result.endedAt;
  advance(g, 5000);
  endGame(g, 1, 'duplicate result');
  assert.deepEqual(g.state.result, frozen);
  assert.equal(g.state.result.endedAt, previousEndedAt);
  assert.equal(g.state.events.filter(event => event.type === 'core-destroyed').length, 1);
  const snapshot = snapshotGame(g);
  snapshot.result.presentation.cores[0].x = -100;
  destroyed.x = -200;
  assert.equal(g.state.result.presentation.cores[0].x, core.x + core.w / 2, 'stored finale is independent of event and snapshot mutations');
});

test('core fall damage emits the same destruction finale at the landing position', () => {
  const g = arena(), core = g.state.teams[1].core;
  Object.assign(core, { x: 1000, y: 300, hp: 30 });
  projectile(g, 'basic', 800, 100, 50, -50);
  advance(g, 2500);
  assert.equal(core.hp, 0);
  assert.equal(core.y + core.h, WORLD.groundY);
  assert.ok(g.state.events.some(event => event.targetId === core.id && event.cause === 'core-fall'));
  assert.equal(g.state.result.presentation.cores.length, 1);
  assert.equal(g.state.result.presentation.cores[0].y, WORLD.groundY - core.h / 2);
});

test('one blast destroying both cores preserves both finales and the mutual-destruction draw', () => {
  const g = arena();
  for (const team of g.state.teams) Object.assign(team.core, { x: 780 + team.side * 45, hp: 10 });
  projectile(g, 'moon', 800, 640, 0, 1500);
  advance(g, 100);
  assert.equal(g.state.result.winner, null);
  assert.equal(g.state.result.reason, 'Mutual destruction');
  assert.deepEqual(g.state.result.presentation.cores.map(event => event.side), [0, 1]);
  assert.equal(g.state.result.presentation.explosions.length, 1);
  assert.equal(g.state.events.filter(event => event.type === 'result').length, 1);
  const { endsAt, cores } = g.state.result.presentation;
  assert.equal(endsAt, Math.max(...cores.map(event => event.at + CORE_DESTRUCTION_MS)));
});

for (const weaponId of ['moon', 'saturn', 'star']) {
  test(`${weaponId} killing the final shooter keeps the planetary animation visible without a core finale`, () => {
    const g = arena(), target = g.state.teams[1].units[0];
    Object.assign(target, { x: 720, hp: 1 });
    for (const unit of g.state.teams[1].units.slice(1)) Object.assign(unit, { alive: false, hp: 0 });
    projectile(g, weaponId);
    advance(g, 100);
    assert.equal(g.state.result.winner, 0);
    assert.equal(g.state.result.reason, 'Enemy crew eliminated');
    assert.equal(g.state.result.presentation.cores.length, 0);
    const finish = g.state.result.presentation.finish;
    const explosions = finish.events;
    assert.ok(explosions.length > 0);
    assert.ok(explosions.every(event => event.weaponId === weaponId));
    assert.equal(g.state.result.presentation.endsAt, finish.at + LAST_SHOOTER_FINISH_MS);
    assert.equal(finish.event.id, finish.deaths.find(event => event.lastShooter).explosionId);
    assert.equal(finish.event.weaponId, weaponId);
  });
}

test('ordinary fatal blasts get two seconds but noncombat leave/disconnect/interruption stay immediate', () => {
  const g = arena(), target = g.state.teams[1].units[0];
  Object.assign(target, { x: 720, hp: 1 });
  for (const unit of g.state.teams[1].units.slice(1)) Object.assign(unit, { alive: false, hp: 0 });
  projectile(g, 'basic');
  advance(g, 100);
  assert.equal(g.state.result.presentation.finish.event.weaponId, 'basic');
  assert.equal(g.state.result.presentation.endsAt, g.state.result.endedAt + 2000);
  const frozen = structuredClone(g.state.result);
  advance(g, 4000);
  assert.deepEqual(g.state.result, frozen);
  for (const [reason, interrupted] of [['Opponent left the match', false], ['Opponent disconnected', false], ['Host simulation interrupted', true]]) {
    const other = arena();
    other.presentationEvents.push({ id: 'recent-moon', type: 'explosion', at: 0, x: 1000, y: 700, weaponId: 'moon' });
    endGame(other, 1, reason, interrupted);
    assert.equal(other.state.result.presentation, null, reason);
  }
});

test('completed and future effects cannot restart a finale; repeated pulses and satellites use original event clocks', () => {
  const events = [
    { id: 'old', type: 'core-destroyed', at: 0 },
    { id: 'pulse', type: 'explosion', weaponId: 'star', pulse: 4, at: 3500 },
    { id: 'satellite', type: 'explosion', weaponId: 'saturn', child: true, at: 3900 },
    { id: 'future', type: 'core-destroyed', at: 5000 },
  ];
  assert.deepEqual(createResultPresentation(events, 4000), { startsAt: 3500, endsAt: 6500, cores: [], explosions: events.slice(1, 3) });
  assert.equal(createResultPresentation(events, 9000), null);
  assert.equal(resultPresentationActive(null, 0), false);
});

test('large non-winning blasts retain their explosion event when masonry damage overflows the bounded stream', () => {
  const g = arena();
  g.state.tiles = Array.from({ length: 120 }, (_, index) => {
    const angle = index / 120 * Math.PI * 2;
    return { id: `debris-${index}`, side: 1, x: 1000 + Math.cos(angle) * 100, y: 500 + Math.sin(angle) * 100, w: 1, h: 1, hp: 18, maxHp: 18, material: 'masonry', falling: false };
  });
  g.state.tiles.push({ id: 'detonator', side: 1, x: 1000, y: 500, w: 1, h: 1, hp: 18, maxHp: 18, material: 'masonry', falling: false });
  projectile(g, 'moon', 1000, 470, 0, 1000);
  advance(g, 68);
  assert.equal(g.state.result, null);
  assert.ok(g.state.tiles.filter(tile => tile.hp <= 0).length > 90 || g.state.tiles.length < 30, 'more than ninety pieces of masonry were destroyed');
  assert.ok(g.state.events.some(event => event.type === 'explosion' && event.weaponId === 'moon'));
  assert.ok(g.state.events.length <= 90);
});


test('an unrelated recent planet explosion cannot replace the actual fatal basic blast', () => {
  const g = arena(), target = g.state.teams[1].units[0];
  Object.assign(target, { x: 720, hp: 1 });
  for (const unit of g.state.teams[1].units.slice(1)) Object.assign(unit, { alive: false, hp: 0 });
  g.presentationEvents.push({ id: 'unrelated-moon', type: 'explosion', weaponId: 'moon', at: 0, x: 1100, y: 300 });
  projectile(g, 'basic'); advance(g, 100);
  assert.equal(g.state.result.presentation.finish.event.weaponId, 'basic');
  assert.equal(g.state.result.presentation.finish.events.length, 1);
  assert.equal(g.state.result.presentation.endsAt, g.state.result.endedAt + 2000);
});

test('falling last shooter has no slow motion or replay of a recent planetary blast', () => {
  const g = arena(), target = g.state.teams[1].units[0];
  Object.assign(target, { x: 1500, y: 400, hp: 1 });
  for (const unit of g.state.teams[1].units.slice(1)) Object.assign(unit, { alive: false, hp: 0 });
  projectile(g, 'moon', 900, 700, 0, 2000); advance(g, 2000);
  assert.equal(g.state.result.reason, 'Enemy crew eliminated');
  assert.ok(g.state.events.some(event => event.type === 'death' && event.cause === 'fall' && event.lastShooter));
  assert.equal(g.state.result.presentation, null);
});

for (const mutual of [false, true]) {
  test(`sudden-death ${mutual ? 'mutual' : 'single-crew'} drowning has a one-second gulp finale`, () => {
    const g = arena();
    g.state.suddenDeath = true;
    // A turn timeout raises the real tide across the final surviving heads.
    for (const team of g.state.teams) {
      for (const unit of team.units.slice(1)) Object.assign(unit, { hp: 0, alive: false });
      if (!mutual && team.side === 0) team.units[0].y = 250;
    }
    advance(g, g.state.turnDeadline + 1);
    assert.equal(g.state.result.winner, mutual ? null : 0);
    const { presentation, endedAt } = g.state.result;
    assert.equal(presentation.finish, undefined);
    assert.equal(presentation.drowning.endsAt, endedAt + DROWNING_FINISH_MS);
    assert.equal(presentation.endsAt, endedAt + 1000);
    assert.equal(presentation.drowning.deaths.filter(event => event.lastShooter).length, mutual ? 2 : 1);
    assert.ok(resultPresentationActive(g.state.result, endedAt + 999));
    assert.equal(resultPresentationActive(g.state.result, endedAt + 1000), false);
  });
}

test('nonfinal shooter deaths do not finish the match or change normal shot timing', () => {
  const g = arena(); Object.assign(g.state.teams[1].units[0], { x: 720, hp: 1 });
  projectile(g, 'basic'); advance(g, 100);
  assert.equal(g.state.result, null);
  assert.equal(g.state.events.find(event => event.type === 'death').lastShooter, false);
});

test('a blast eliminating both crews preserves both final deaths and one two-second draw', () => {
  const g = arena();
  for (const team of g.state.teams) {
    for (const unit of team.units.slice(1)) Object.assign(unit, { hp: 0, alive: false });
    Object.assign(team.units[0], { x: 790 + team.side * 45, hp: 1 });
  }
  projectile(g, 'moon', 800, 640, 0, 1500); advance(g, 100);
  assert.equal(g.state.result.winner, null);
  assert.equal(g.state.result.presentation.finish.deaths.filter(event => event.lastShooter).length, 2);
  assert.equal(g.state.result.presentation.endsAt, g.state.result.endedAt + 2000);
});
