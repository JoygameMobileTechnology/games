import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tickGame, applyAction, snapBuild, validateBuild, snapshotGame, getBuildBounds } from '../shared/game.js';
import { WORLD, WEAPONS } from '../shared/content.js';
import { FORMATIONS } from '../shared/formations.js';

const kits = Object.values(WEAPONS).filter(weapon => weapon.kind === 'build');
function game(side = 0, formationId = 'bridge-fort') {
  const g = createGame({ id: `floating-${side}-${formationId}`, seed: 7, firstSide: side, formationId, config: { countdownMs: 0 } });
  tickGame(g, 0);
  for (const kit of kits) g.state.teams[side].ammo[kit.id] = 1;
  return g;
}
function advance(g, duration) {
  const until = g.lastTick + duration;
  for (let now = g.lastTick + 16; now < until; now += 16) tickGame(g, now);
  tickGame(g, until);
}
function floatingSpot(state, side, weaponId) {
  const bounds = getBuildBounds(state, side), kit = WEAPONS[weaponId], step = WORLD.tileSize;
  for (let x = bounds.x; x + kit.footprint.w * step <= bounds.x + bounds.w; x += step) {
    const point = { x, y: bounds.y };
    if (!validateBuild(state, side, weaponId, x, point.y).ok) continue;
    const right = x + kit.footprint.w * step, bottom = point.y + kit.footprint.h * step;
    if (!state.tiles.some(tile => tile.hp > 0 && tile.x <= right && tile.x + tile.w >= x && tile.y <= bottom && tile.y + tile.h >= point.y)) return point;
  }
  throw new Error(`No detached sky placement for ${state.formation.id}, side ${side}, ${weaponId}`);
}
function build(g, point, weaponId = 'barricade') {
  const s = g.state, side = s.activeSide;
  point ??= floatingSpot(s, side, weaponId);
  const action = { kind: 'build', unitId: s.activeUnitId, weaponId, ...snapBuild(s, side, point.x, point.y) };
  assert.deepEqual(applyAction(g, side, action, s.now + 1), { ok: true });
  return s.tiles.filter(tile => tile.constructed && tile.side === side);
}
function fireAt(g, weaponId, x, y, vx = 6000, vy = 0) {
  const s = g.state, side = s.activeSide;
  if (WEAPONS[weaponId].ammo !== -1) s.teams[side].ammo[weaponId] = 1;
  assert.deepEqual(applyAction(g, side, { kind: 'fire', unitId: s.activeUnitId, weaponId, angle: -1, power: 1 }, s.now + 1), { ok: true });
  const projectile = s.projectiles[0];
  Object.assign(projectile, { x, y, vx, vy });
  return projectile;
}

test('every kit floats without support for either side in every formation and spends exactly one turn and charge', () => {
  for (const formation of FORMATIONS) for (const side of [0, 1]) for (const kit of kits) {
    const g = game(side, formation.id), initialTiles = g.state.tiles.length, turnId = g.state.turnId;
    const tiles = build(g, undefined, kit.id);
    assert.equal(tiles.length, kit.footprint.w * kit.footprint.h);
    assert.equal(g.state.tiles.length, initialTiles + tiles.length);
    assert.equal(g.state.phase, 'resolve');
    assert.equal(g.state.teams[side].ammo[kit.id], 0);
    assert.ok(tiles.every(tile => tile.side === side && tile.floating && !tile.falling && tile.hp === kit.hp));
    assert.ok(snapshotGame(g).tiles.filter(tile => tile.constructed).every(tile => tile.floating));
    const before = tiles.map(({ id, x, y }) => ({ id, x, y }));
    advance(g, 400);
    assert.deepEqual(g.state.tiles.filter(tile => tile.constructed).map(({ id, x, y }) => ({ id, x, y })), before);
    assert.equal(g.state.activeSide, 1 - side);
    assert.equal(g.state.turnId, turnId + 1);
    assert.equal(g.state.completedTurns, 1);
    assert.equal(g.chunks.length, 0);
  }
});

test('every kit fits only within the original castle footprint plus exactly two roof rows, even after castle destruction', () => {
  for (const formation of FORMATIONS) for (const side of [0, 1]) for (const kit of kits) {
    const s = game(side, formation.id).state, original = s.formation.bounds[side], bounds = getBuildBounds(s, side);
    assert.deepEqual(bounds, { x: original.x, y: original.y - 56, w: original.w, h: original.h + 56 });
    s.tiles = [];
    for (const team of s.teams) { team.core.hp = 0; for (const unit of team.units) unit.alive = false; }
    assert.deepEqual(getBuildBounds(s, side), bounds, 'collapsed walls never shrink the permitted footprint');
    const right = bounds.x + bounds.w - kit.footprint.w * 28, bottom = bounds.y + bounds.h - kit.footprint.h * 28;
    for (const [x, y] of [[bounds.x, bounds.y], [right, bounds.y], [bounds.x, bottom], [right, bottom]]) {
      assert.equal(validateBuild(s, side, kit.id, x, y).ok, true, `${formation.id} ${side} ${kit.id}: inside edge`);
    }
    for (const [x, y] of [[bounds.x - 28, bounds.y], [right + 28, bounds.y], [bounds.x, bounds.y - 28], [bounds.x, bottom + 28], [1000, bounds.y], [s.formation.bounds[1-side].x, bounds.y]]) {
      const p = snapBuild(s, side, x, y);
      assert.equal(validateBuild(s, side, kit.id, p.x, p.y).reason, 'OUTSIDE_BUILD_REGION', `${formation.id} ${side} ${kit.id}: outside edge`);
    }
  }
});

test('all unsupported construction stays fixed through subsequent resolved shots', () => {
  for (const kit of kits) {
    const g = game(), tiles = build(g, undefined, kit.id), before = tiles.map(({ id, x, y }) => ({ id, x, y }));
    advance(g, 400);
    for (let shot = 0; shot < 2; shot++) {
      fireAt(g, 'basic', 700, 200, 0, -600);
      advance(g, 5000);
      assert.equal(g.state.phase, 'aim');
      assert.deepEqual(g.state.tiles.filter(tile => tile.constructed).map(({ id, x, y }) => ({ id, x, y })), before);
      assert.ok(tiles.every(tile => tile.hp === kit.hp && tile.floating && !tile.falling && !tile.rubble));
      assert.equal(g.chunks.length, 0);
    }
    assert.equal(g.state.completedTurns, 3);
  }
});

test('floating cover physically intercepts a rocket and can be destroyed', () => {
  const g = game(), tiles = build(g), middle = tiles[1];
  advance(g, 400);
  fireAt(g, 'basic', middle.x - 40, middle.y + middle.h / 2);
  advance(g, 50);
  const blast = g.state.events.find(event => event.type === 'explosion');
  assert.ok(blast && blast.x < middle.x && blast.x > middle.x - 8, 'the rocket hit the barricade face');
  assert.equal(g.state.projectiles.length, 0);
  assert.equal(middle.hp, 0);
  assert.ok(g.state.events.some(event => event.type === 'damage' && event.targetId === middle.id && event.cause === 'blast'));
  assert.equal(g.state.teams[0].ammo.barricade, 0);
  assert.equal(g.state.teams[1].ammo.basic, -1);
});

test('separated barricade bricks keep floating after a penetrator removes their middle brick', () => {
  const g = game(), tiles = build(g), middle = tiles[1], survivors = [tiles[0], tiles[2]];
  const positions = survivors.map(({ id, x, y }) => ({ id, x, y }));
  advance(g, 400);
  // Exit toward the nearby horizontal boundary after drilling the middle.
  fireAt(g, 'drill', middle.x + middle.w + 40, middle.y + middle.h / 2, -6000);
  advance(g, 400);
  assert.equal(middle.hp, 0);
  assert.ok(g.state.events.some(event => event.targetId === middle.id && event.cause === 'penetration'));
  assert.deepEqual(g.state.tiles.filter(tile => survivors.some(survivor => survivor.id === tile.id)).map(({ id, x, y }) => ({ id, x, y })), positions);
  assert.ok(survivors.every(tile => tile.hp === 45 && tile.floating && !tile.falling));
  assert.equal(g.state.teams[1].ammo.drill, 0);
  assert.equal(g.chunks.length, 0);
});

test('invalid placements reject every kit atomically without spending ammunition or the turn', () => {
  for (const side of [0, 1]) for (const kit of kits) for (const invalid of ['gap', 'opponent', 'left', 'right', 'high', 'low', 'water', 'tile', 'unit', 'core', 'off-grid', 'nonfinite']) {
    const g = game(side), s = g.state, bounds = getBuildBounds(s, side);
    let point = floatingSpot(s, side, kit.id), expected = 'OUTSIDE_BUILD_REGION';
    if (invalid === 'gap') point.x = snapBuild(s, side, 1000, point.y).x;
    if (invalid === 'opponent') point.x = snapBuild(s, side, s.formation.bounds[1-side].x, point.y).x;
    if (invalid === 'left') point.x = bounds.x - 28;
    if (invalid === 'right') point.x = bounds.x + bounds.w - kit.footprint.w * 28 + 28;
    if (invalid === 'high') point.y = bounds.y - 28;
    if (invalid === 'low') point.y = WORLD.groundY - kit.footprint.h * 28 + 28;
    if (invalid === 'water') { s.waterY = point.y + kit.footprint.h * 28; expected = 'UNDERWATER'; }
    if (invalid === 'tile') { const tile = s.tiles.find(tile => tile.side === side); point = { x: Math.min(tile.x, bounds.x + bounds.w - kit.footprint.w * 28), y: tile.y }; expected = 'OCCUPIED'; }
    if (invalid === 'unit' || invalid === 'core') {
      const entity = invalid === 'unit' ? s.teams[side].units[0] : s.teams[side].core;
      Object.assign(entity, { x: point.x, y: point.y }); expected = 'OCCUPIED';
    }
    if (invalid === 'off-grid') { point.x += 1; expected = 'OFF_GRID'; }
    if (invalid === 'nonfinite') { point.x = NaN; expected = 'INVALID_POSITION'; }
    const before = JSON.stringify({ tiles: s.tiles, teams: s.teams, turnId: s.turnId });
    const result = applyAction(g, side, { kind: 'build', unitId: s.activeUnitId, weaponId: kit.id, ...point }, 1);
    assert.equal(result.reason, expected, `${side} ${kit.id}: ${invalid}`);
    assert.equal(s.phase, 'aim');
    assert.equal(s.teams[side].ammo[kit.id], 1);
    assert.equal(JSON.stringify({ tiles: s.tiles, teams: s.teams, turnId: s.turnId }), before);
    assert.equal(s.events.filter(event => event.type === 'build').length, 0);
  }
});

test('shooters on the highest legal floating cover drown during sudden death', () => {
  const g = game(), platforms = [];
  for (let turn = 0; turn < 2; turn++) {
    const side = g.state.activeSide;
    g.state.teams[side].ammo.bridge = 1;
    platforms[side] = build(g, undefined, 'bridge')[0];
    advance(g, 400);
  }
  for (const side of [0, 1]) {
    const unit = g.state.teams[side].units[0], platform = platforms[side];
    Object.assign(unit, { x: platform.x + 5, y: platform.y - unit.h });
  }
  g.config.turnMs = 100; g.config.waterMs = 10;
  g.state.turnDeadline = g.state.now + 100; g.state.suddenDeath = true;
  for (let step = 0; !g.state.result && step < 200; step++) advance(g, 16);
  assert.ok(g.state.waterRise <= 6);
  assert.equal(g.state.result?.winner, null);
  assert.equal(g.state.result?.reason, 'Both crews drowned together');
  assert.ok(g.state.teams.every(team => !team.units.some(unit => unit.alive)));
  assert.ok(g.state.tiles.filter(tile => tile.constructed).every(tile => tile.floating && !tile.falling));
});
