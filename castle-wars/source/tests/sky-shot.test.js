import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tickGame, applyAction } from '../shared/game.js';
import { WEAPONS, WORLD } from '../shared/content.js';

function advance(g, until) {
  // Long trajectories use continuous ticks, never a suspended-host time jump.
  for (let now = g.lastTick + 16; now < until; now += 16) tickGame(g, now);
  tickGame(g, until);
}
function fixture(config = {}, side = 0) {
  const g = createGame({ id: `sky-${side}`, firstSide: side, config: { countdownMs: 0, ...config } });
  tickGame(g, 0);
  g.state.tiles = [];
  g.state.wind = { level: 0, acceleration: 0, changesAfterTurns: 2 };
  for (const team of g.state.teams) {
    Object.assign(team.core, { x: team.side ? 1800 : 150, y: WORLD.groundY - team.core.h });
    for (const [index, unit] of team.units.entries()) Object.assign(unit, { x: team.side ? 1870 + index * 35 : 10 + index * 35, y: WORLD.groundY - unit.h });
  }
  return g;
}
function launch(g, weaponId = 'lob', aim = {}) {
  const s = g.state, side = s.activeSide;
  if (WEAPONS[weaponId].ammo !== -1) s.teams[side].ammo[weaponId] = WEAPONS[weaponId].ammo;
  assert.equal(applyAction(g, side, { kind: 'fire', unitId: s.activeUnitId, weaponId, angle: -Math.PI / 2, power: 1, ...aim }, s.now + 1).ok, true);
  return s.projectiles[0];
}
const blasts = (g, weaponId) => g.state.events.filter(event => event.type === 'explosion' && (!weaponId || event.weaponId === weaponId));

function assertStillFlying(g, projectile, initial) {
  assert.ok(g.state.projectiles.includes(projectile), 'airborne projectile is retained');
  assert.equal(g.state.phase, 'resolve');
  assert.equal(g.state.turnId, initial.turnId, 'flight does not hand over the turn');
  assert.equal(g.state.activeSide, initial.side);
  assert.equal(g.state.activeUnitId, initial.unitId, 'the shooter does not rotate while its shot is in flight');
  assert.equal(g.state.completedTurns, initial.completedTurns);
  assert.equal(g.state.teams[initial.side].ammo[projectile.weaponId], initial.ammo);
  assert.equal(g.state.result, null);
}
function checkpoint(g, projectile) {
  return { turnId: g.state.turnId, side: g.state.activeSide, unitId: g.state.activeUnitId, completedTurns: g.state.completedTurns, ammo: g.state.teams[g.state.activeSide].ammo[projectile.weaponId] };
}

test('a legal high-power Lob rises beyond the visible sky and completes its full arc after five seconds', () => {
  const g = fixture();
  const unit = g.state.teams[0].units.find(unit => unit.id === g.state.activeUnitId);
  Object.assign(unit, { x: 950, y: 134 });
  // A valid slightly forward vertical shot clears the returning shooter's body.
  const p = launch(g, 'lob', { angle: -Math.PI / 2 + 0.05 }), initial = checkpoint(g, p);
  for (const now of [1000, 4201, 5001]) {
    advance(g, now);
    assertStillFlying(g, p, initial);
    if (now < 5000) assert.ok(p.y < -500, `shot is above the old ceiling at ${now} ms`);
    assert.equal(blasts(g).length, 0, 'flight age creates no fabricated explosion');
  }
  advance(g, 6500);
  assert.equal(g.state.projectiles.length, 0);
  assert.equal(blasts(g, 'lob').length, 1);
  const blast = blasts(g, 'lob')[0];
  assert.ok(blast.at > 5000 && blast.at < 6200);
  assert.ok(Math.abs(blast.y - (WORLD.groundY - p.r - 0.1)) < 0.02, 'the returned rocket hits the physical ground');
  assert.equal(g.state.completedTurns, 1);
  assert.equal(g.state.activeSide, 1);
  assert.equal(g.state.teams[0].ammo.lob, -1);
});

test('an uninterrupted sky flight remains alive past twelve seconds without a shot or resolution expiry', () => {
  const g = fixture({ resolutionMs: 1 });
  const p = launch(g, 'lob'), initial = checkpoint(g, p);
  Object.assign(p, { x: 1000, y: 100, vx: 0, vy: -2500 });
  for (const now of [4300, 6100, 10100, 12001]) {
    advance(g, now);
    assertStillFlying(g, p, initial);
    assert.ok(p.y < -500);
    assert.equal(blasts(g).length, 0);
  }
  advance(g, 15000);
  assert.equal(g.state.projectiles.length, 0);
  assert.equal(blasts(g, 'lob').length, 1);
  assert.ok(blasts(g, 'lob')[0].at > 12000);
  assert.equal(g.state.completedTurns, 1);
  assert.equal(g.state.activeSide, 1);
});

for (const side of [0, 1]) {
  test(`an offscreen high projectile still leaves through horizontal boundary ${side} without an invented impact`, () => {
    const g = fixture({}, side), p = launch(g, 'basic'), initial = checkpoint(g, p);
    Object.assign(p, { x: side ? WORLD.width : 0, y: -1400, vx: side ? 300 : -300, vy: 0 });
    advance(g, 200);
    assertStillFlying(g, p, initial);
    advance(g, 500);
    assert.equal(g.state.projectiles.length, 0);
    assert.equal(blasts(g).length, 0);
    assert.equal(g.state.events.filter(event => event.type === 'plop').length, 0);
    assert.equal(g.state.completedTurns, 1);
    assert.equal(g.state.activeSide, 1 - side);
  });
}

for (const water of [false, true]) {
  test(`Saturn satellites retain long sky trajectories and return to ${water ? 'plop at water' : 'explode on solid ground'}`, () => {
    const g = fixture(), p = launch(g, 'saturn');
    g.state.tiles = [{ id: 'saturn-contact', side: 1, x: 1000, y: 300, w: 28, h: 28, material: 'masonry', hp: 18, maxHp: 18, floating: true, falling: false }];
    Object.assign(p, { x: 950, y: 315, vx: 1800, vy: 0 });
    advance(g, 50);
    assert.equal(blasts(g, 'saturn').length, 1);
    const children = [...g.state.projectiles];
    assert.equal(children.length, 4);
    for (const [index, child] of children.entries()) {
      assert.equal(child.child, true);
      Object.assign(child, { x: 800 + index * 130, y: -600, vx: 0, vy: -1800 });
    }
    if (water) g.state.waterY = WORLD.groundY - 2;
    const initial = checkpoint(g, children[0]);
    advance(g, 6100);
    for (const child of children) { assertStillFlying(g, child, initial); assert.ok(child.y < -500); }
    assert.equal(blasts(g, 'saturn').length, 1);
    advance(g, 8500);
    assert.equal(g.state.projectiles.length, 0);
    assert.equal(g.state.completedTurns, 1);
    assert.equal(g.state.activeSide, 1);
    assert.equal(g.state.teams[0].ammo.saturn, 0, 'satellites do not spend or refill ammunition');
    const childBlasts = blasts(g, 'saturn').filter(event => event.child);
    assert.equal(childBlasts.length, water ? 0 : 4);
    assert.equal(g.state.events.filter(event => event.type === 'plop').length, water ? 4 : 0);
  });
}

test('an airborne action crossing four-minute regulation finishes before sudden death changes the active side', () => {
  const g = fixture({ turnMs: 240000 });
  advance(g, 233900);
  const p = launch(g, 'lob'), initial = checkpoint(g, p);
  Object.assign(p, { x: 1000, y: 100, vx: 0, vy: -2500 });
  advance(g, 241000);
  assertStillFlying(g, p, initial);
  assert.equal(g.state.suddenDeath, false);
  assert.equal(g.state.waterRise, 0);
  assert.equal(g.state.events.filter(event => event.type === 'water').length, 0);
  advance(g, 248500);
  assert.equal(g.state.projectiles.length, 0);
  assert.equal(blasts(g, 'lob').length, 1);
  assert.ok(blasts(g, 'lob')[0].at > g.state.regulationEndsAt);
  assert.equal(g.state.completedTurns, initial.completedTurns + 1);
  assert.equal(g.state.suddenDeath, true);
  assert.equal(g.state.phase, 'aim');
  assert.equal(g.state.activeSide, 1);
  assert.equal(g.state.suddenTurns, 0);
  assert.equal(g.state.waterRise, 0);
  assert.equal(g.state.events.filter(event => event.type === 'water' && event.announcement).length, 1);
});

test('sudden-death water waits for the entire high shot and rises exactly once after its landing', () => {
  const g = fixture();
  for (const team of g.state.teams) {
    const x = team.side ? 1860 : 0;
    g.state.tiles.push({ id: `safe-platform-${team.side}`, side: team.side, x, y: 500, w: 140, h: 28, material: 'terrain', hp: 1000, maxHp: 1000, floating: true, falling: false });
    for (const unit of team.units) unit.y = 500 - unit.h;
  }
  g.state.suddenDeath = true;
  const p = launch(g, 'lob'), initial = checkpoint(g, p), originalWater = g.state.waterY;
  Object.assign(p, { x: 1000, y: 100, vx: 0, vy: -2500 });
  advance(g, 12001);
  assertStillFlying(g, p, initial);
  assert.equal(g.state.waterY, originalWater);
  assert.equal(g.state.waterRise, 0);
  assert.equal(g.state.suddenTurns, 0);
  advance(g, 15500);
  assert.equal(g.state.projectiles.length, 0);
  assert.equal(g.state.result, null);
  assert.equal(g.state.phase, 'aim');
  assert.equal(g.state.activeSide, 1);
  assert.equal(g.state.completedTurns, 1);
  assert.equal(g.state.waterRise, 1);
  assert.equal(g.state.suddenTurns, 1);
  assert.ok(g.state.waterY < originalWater);
  assert.equal(g.state.events.filter(event => event.type === 'water').length, 1);
  assert.ok(g.state.events.find(event => event.type === 'water').at > blasts(g, 'lob')[0].at);
});
