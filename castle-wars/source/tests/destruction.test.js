import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, createGame, tickGame } from '../shared/game.js';
import { MATERIALS, WORLD } from '../shared/content.js';

function game() {
  const g = createGame({ id: 'destruction', seed: 7, config: { countdownMs: 0, turnMs: 1000 } });
  tickGame(g, 0);
  g.state.tiles = [];
  g.state.wind.acceleration = 0;
  for (const team of g.state.teams) {
    Object.assign(team.core, { x: team.side ? 1900 : 50, y: WORLD.groundY - team.core.h });
    for (const unit of team.units) Object.assign(unit, { x: team.side ? 1950 : 10, y: WORLD.groundY - unit.h });
  }
  return g;
}
function advance(g, until) {
  for (let t = g.lastTick + 16; t < until; t += 16) tickGame(g, t);
  tickGame(g, until);
}
function tile(id, x, y, material = 'masonry', w = 28, h = 28, side = 1) {
  const hp = MATERIALS[material].hp;
  return { id, x, y, w, h, material, side, hp, maxHp: hp, falling: false };
}
function rocket(g, x, y, vx, vy) {
  const side = g.state.activeSide;
  const result = applyAction(g, side, {
    kind: 'fire', weaponId: 'basic', unitId: g.state.activeUnitId,
    angle: side ? -2.6 : -0.55, power: 1,
  }, g.state.now + 1);
  assert.equal(result.ok, true);
  Object.assign(g.state.projectiles[0], { x, y, vx, vy });
}

function floorImpact(mirrored = false) {
  const g = game(), defendingSide = mirrored ? 0 : 1;
  const reflect = box => mirrored ? { ...box, x: WORLD.width - box.x - box.w } : box;
  const floors = Array.from({ length: 7 }, (_, i) => reflect(tile(`floor-${i}`, 700 + i * 28, 498, 'masonry', 28, 28, defendingSide)));
  const columns = [700, 868].flatMap((x, column) => Array.from({ length: 8 }, (_, row) =>
    reflect(tile(`support-${column}-${row}`, x, 526 + row * 28, 'masonry', 28, 28, defendingSide))));
  g.state.tiles = [...floors, ...columns];
  const unit = g.state.teams[defendingSide].units[0];
  Object.assign(unit, reflect({ x: 784, y: 498 - unit.h, w: unit.w, h: unit.h }));
  const initialY = unit.y;
  if (mirrored) { g.state.activeSide = 1; g.state.activeUnitId = g.state.teams[1].units[0].id; }
  rocket(g, mirrored ? WORLD.width - 798 : 798, 570, 0, -1800);
  advance(g, 34);
  const removed = floors.filter(t => t.hp === 0).map(t => t.id).sort();
  assert.ok(removed.length >= 3, `one basic rocket removed only ${removed.length} adjacent floor bricks`);
  assert.equal(unit.hp, 100, 'the floor shields the shooter from the blast that opens the hole');
  advance(g, 2000);
  assert.ok(unit.alive, 'losing a floor should produce a playable fall, not an automatic death');
  assert.ok(unit.y - initialY >= 200, 'the shooter drops through the new breach');
  assert.equal(unit.y + unit.h, WORLD.groundY);
  assert.ok(unit.hp >= 80 && unit.hp < 100, 'a large fall remains survivable with the existing damage cap');
  assert.ok(g.state.events.some(e => e.type === 'damage' && e.targetId === unit.id && e.cause === 'fall'));
  return { removed, hp: unit.hp, y: unit.y };
}

test('one basic rocket opens a multi-brick floor breach and makes its shielded shooter fall', () => {
  floorImpact();
});

test('mirrored floor hits remove the same bricks and produce the same surviving fall', () => {
  assert.deepEqual(floorImpact(true), floorImpact(false));
});

test('reinforced cover survives one basic rocket and breaks under the second', () => {
  const g = game(), wall = tile('reinforced-wall', 700, 680, 'reinforced', 28, 70);
  g.state.tiles = [wall];
  rocket(g, 650, 715, 6000, 0); advance(g, 34);
  assert.ok(wall.hp > 0 && wall.hp < wall.maxHp);
  assert.ok(g.state.tiles.includes(wall));
  advance(g, 1400); // The opponent times out, returning the turn to the attacker.
  assert.equal(g.state.activeSide, 0);
  rocket(g, 650, 715, 6000, 0); advance(g, 1434);
  assert.equal(wall.hp, 0);
  assert.ok(!g.state.tiles.includes(wall));
});

test('a destroyed wall still shields crew and core for that blast while transmitting reduced terrain damage', () => {
  for (const targetKind of ['crew', 'core']) {
    const g = game(), front = tile('front', 700, 680, 'masonry', 28, 70);
    const rear = tile('rear', 735, 650);
    g.state.tiles = [front, rear];
    const target = targetKind === 'crew' ? g.state.teams[1].units[0] : g.state.teams[1].core;
    Object.assign(target, { x: 730, y: WORLD.groundY - target.h });
    const hp = target.hp;
    rocket(g, 650, 715, 6000, 0); advance(g, 34);
    assert.equal(front.hp, 0);
    assert.ok(rear.hp > 0 && rear.hp < rear.maxHp, 'the rear brick receives attenuated structural shock');
    assert.equal(target.hp, hp, `${targetKind} keeps protection from the wall present at blast start`);
    assert.ok(!g.state.events.some(e => e.type === 'damage' && e.targetId === target.id && e.cause === 'blast'));
  }
});

test('the wider structural blast does not increase the direct damage radius for an exposed shooter', () => {
  const g = game(), unit = g.state.teams[1].units[0];
  Object.assign(unit, { x: 700 - 58 - unit.w, y: WORLD.groundY - unit.h });
  const nearbyBrick = tile('nearby', 758, 722);
  // Both targets are 58 pixels from the impact: within structural shock range,
  // outside the unchanged 42-pixel basic-rocket damage radius for inhabitants.
  g.state.tiles = [nearbyBrick];
  rocket(g, 700, 700, 0, 1800); advance(g, 34);
  assert.ok(nearbyBrick.hp < nearbyBrick.maxHp, 'masonry beyond the old splash radius is damaged');
  assert.equal(unit.hp, 100, 'the exposed shooter outside normal splash takes no damage');
});
