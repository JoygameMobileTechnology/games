import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMATIONS } from '../shared/formations.js';
import { WORLD, RULES, WEAPONS, DEFAULT_WEAPONS } from '../shared/content.js';
import { createGame, tickGame, applyAction, predictShot, snapshotGame } from '../shared/game.js';
import { ballisticCandidates } from '../server/ai.js';

const center = body => ({ x: body.x + body.w / 2, y: body.y + body.h / 2 });
const overlap = (a, b) => a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01 && a.y < b.y + b.h - 0.01 && a.y + a.h > b.y + 0.01;
const enemyHit = (impact, side) => impact.hitId?.startsWith(`s${1 - side}:`);

function fresh(formationId, side = 0, acceleration = 0, seed = 17) {
  const game = createGame({ id: `formation-${formationId}-${seed}`, seed, formationId, firstSide: side, config: { countdownMs: 0 } });
  tickGame(game, 0);
  game.state.wind = { acceleration, level: acceleration / 10, changesAfterTurns: 2 };
  return game;
}

function reachableShot(state, unit, weaponId) {
  const enemy = state.teams[1 - unit.side];
  const targets = [...enemy.units, enemy.core, ...state.tiles.filter(tile => tile.side === enemy.side)].map(center);
  for (const power of [0.9, 1, 0.8, 0.7, 0.6]) {
    for (const target of targets) {
      for (const solution of ballisticCandidates(state, unit, WEAPONS[weaponId], target, power)) {
        const impact = predictShot(state, unit.id, weaponId, solution.angle, solution.power);
        if (enemyHit(impact, unit.side)) return { ...solution, impact };
      }
    }
  }
  return null;
}

test('pre-designed formations have different silhouettes and shooter arrangements', () => {
  assert.ok(FORMATIONS.length >= 3, 'players need several actual formation choices');
  const names = new Set(), outlines = new Set(), positions = new Set();
  for (const formation of FORMATIONS) {
    const state = fresh(formation.id).state;
    names.add(state.formation.name);
    const columns = new Map();
    for (const tile of state.tiles.filter(tile => tile.side === 0)) columns.set(tile.x, Math.min(columns.get(tile.x) ?? Infinity, tile.y));
    outlines.add(JSON.stringify([...columns].sort((a, b) => a[0] - b[0])));
    positions.add(JSON.stringify(state.teams[0].units.map(unit => [unit.x, unit.y])));
  }
  assert.equal(names.size, FORMATIONS.length);
  assert.equal(outlines.size, FORMATIONS.length, 'changing internal decoration alone is not a new silhouette');
  assert.equal(positions.size, FORMATIONS.length, 'each formation changes the actual firing positions');
});

test('formation selection is seeded, explicit fixtures work and rematches exclude the previous formation', () => {
  const seen = new Set();
  for (let seed = 0; seed < 48; seed++) {
    const options = { id: 'selection-test', seed };
    const first = createGame(options), repeated = createGame(options);
    seen.add(first.state.formation.id);
    assert.deepEqual(snapshotGame(first), snapshotGame(repeated));
    const rematchOptions = { ...options, excludeFormationId: first.state.formation.id };
    const rematch = createGame(rematchOptions);
    assert.notEqual(rematch.state.formation.id, first.state.formation.id);
    assert.deepEqual(snapshotGame(rematch), snapshotGame(createGame(rematchOptions)));
    assert.deepEqual(rematch.state.lineup, first.state.lineup, 'formation selection must not shift weapon randomness');
    assert.deepEqual(rematch.state.wind, first.state.wind, 'formation selection must not shift the wind sequence');
  }
  assert.equal(seen.size, FORMATIONS.length);
  for (const formation of FORMATIONS) assert.equal(fresh(formation.id).state.formation.id, formation.id);
});

for (const formation of FORMATIONS) {
  test(`${formation.name}: physical castles and all shooter/core coordinates mirror exactly`, () => {
    const state = fresh(formation.id).state;
    const left = state.tiles.filter(tile => tile.side === 0), right = state.tiles.filter(tile => tile.side === 1);
    assert.equal(left.length, right.length);
    assert.ok(left.length <= 160, 'formation stays within the mobile collision budget');
    assert.equal(new Set(state.tiles.map(tile => tile.id)).size, state.tiles.length);
    for (const tile of left) {
      const mirror = right.find(other => other.id === tile.id.replace('s0:', 's1:'));
      assert.ok(mirror, `missing mirrored tile ${tile.id}`);
      assert.deepEqual({ ...mirror, id: tile.id, side: 0, x: WORLD.width - mirror.x - mirror.w }, tile);
    }
    for (const body of [...state.teams[0].units, state.teams[0].core]) {
      const counterpart = [...state.teams[1].units, state.teams[1].core].find(other => other.id === body.id.replace('s0:', 's1:'));
      assert.equal(counterpart.x, WORLD.width - body.x - body.w);
      for (const key of ['y', 'w', 'h', 'hp', 'maxHp']) assert.equal(counterpart[key], body[key]);
    }
    assert.ok(Math.min(...right.map(tile => tile.x)) - Math.max(...left.map(tile => tile.x + tile.w)) >= 900, 'formations retain the long-range battlefield');
  });

  test(`${formation.name}: occupied spaces are separate, cores enclosed, and the intact structure survives gravity`, () => {
    const game = fresh(formation.id), state = game.state;
    for (const team of state.teams) {
      assert.equal(team.units.length, 3);
      const bodies = [...team.units, team.core], tiles = state.tiles.filter(tile => tile.side === team.side);
      for (const body of bodies) {
        assert.ok(!tiles.some(tile => overlap(body, tile)), `${body.id} starts inside masonry`);
        assert.ok(!bodies.some(other => other.id !== body.id && overlap(body, other)), `${body.id} overlaps another inhabitant`);
        assert.ok(tiles.some(tile => tile.y === body.y + body.h && tile.x < body.x + body.w && tile.x + tile.w > body.x), `${body.id} needs a real supporting floor`);
      }
      const core = team.core, c = center(core);
      assert.equal(core.hp, RULES.coreHp);
      const cover = {
        left: tiles.filter(tile => tile.x + tile.w <= core.x && tile.y <= c.y && tile.y + tile.h >= c.y),
        right: tiles.filter(tile => tile.x >= core.x + core.w && tile.y <= c.y && tile.y + tile.h >= c.y),
        roof: tiles.filter(tile => tile.y + tile.h <= core.y && tile.x <= c.x && tile.x + tile.w >= c.x),
      };
      for (const [direction, walls] of Object.entries(cover)) {
        assert.ok(walls.length, `core is exposed to the ${direction}`);
        assert.ok(walls.every(tile => Number.isFinite(tile.hp) && tile.hp > 0 && tile.hp <= 100), 'core cover must be destructible');
      }
    }
    const initial = JSON.stringify({ tiles: state.tiles, teams: state.teams });
    // Resolve without a blast so the same support/body code used after a shot
    // gets to discover any floating bricks or unsupported initial inhabitants.
    game.dirtyStructure = true;
    state.phase = 'resolve';
    game.settleAt = 500;
    for (let now = 34; now <= 612; now += 34) tickGame(game, now);
    const after = JSON.parse(initial);
    assert.deepEqual(state.tiles, after.tiles);
    for (const team of state.teams) {
      assert.deepEqual(team.units, after.teams[team.side].units);
      assert.deepEqual(team.core, after.teams[team.side].core);
    }
    assert.equal(game.chunks.length, 0);
    assert.equal(game.bodyMotion.size, 0);
    assert.ok(!state.events.some(event => ['collapse', 'damage', 'death'].includes(event.type)));
  });

  test(`${formation.name}: every shooter has a real enemy-reaching arc with both default weapons in either extreme wind`, () => {
    for (const side of [0, 1]) for (const acceleration of [-70, 70]) {
      const state = fresh(formation.id, side, acceleration).state;
      for (const unit of state.teams[side].units) for (const weaponId of DEFAULT_WEAPONS) {
        const shot = reachableShot(state, unit, weaponId);
        assert.ok(shot, `${formation.id}: ${unit.id} / ${weaponId} / wind ${acceleration} is trapped`);
        assert.ok(shot.impact.points.length > 18, 'a valid shot leaves its own firing space');
        assert.ok(enemyHit(shot.impact, side));
      }
    }
  });

  test(`${formation.name}: rear shooters' predicted arcs land at their forecast contact`, () => {
    for (const side of [0, 1]) for (const acceleration of [-70, 70]) for (const weaponId of DEFAULT_WEAPONS) {
      const game = fresh(formation.id, side, acceleration), state = game.state;
      const unit = state.teams[side].units[0], shot = reachableShot(state, unit, weaponId);
      assert.ok(shot, `${formation.id}/${unit.id}/${weaponId}/${acceleration}`);
      const action = { kind: 'fire', unitId: unit.id, weaponId, angle: shot.angle, power: shot.power };
      assert.equal(applyAction(game, side, action, 1).ok, true);
      const predictedContactAt = (shot.impact.points.length - 1) * 1000 / 30;
      for (let now = 34; now <= predictedContactAt + 100; now += 34) {
        tickGame(game, now);
        if (state.events.some(event => event.type === 'explosion')) break;
      }
      const blast = state.events.find(event => event.type === 'explosion');
      assert.ok(blast, `${formation.id}/${unit.id}/${weaponId}/${acceleration}: forecast shot must land at its predicted contact`);
      assert.ok(Math.hypot(blast.x - shot.impact.x, blast.y - shot.impact.y) < 0.2, 'lofted flight and collision preview must agree');
      assert.ok(state.events.some(event => event.type === 'damage' && event.targetId?.startsWith(`s${1 - side}:`)), 'the predicted enemy hit must cause enemy damage');
    }
  });
}

test('rear positions use a lofted escape route over actual intervening castle walls', () => {
  let rearPositions = 0;
  for (const formation of FORMATIONS) {
    const state = fresh(formation.id).state;
    for (const unit of state.teams[0].units) {
      const low = predictShot(state, unit.id, 'basic', -0.2, 1);
      if (!low.hitId?.startsWith('s0:t')) continue;
      const shot = reachableShot(state, unit, 'basic');
      assert.ok(shot, `${formation.id}/${unit.id} has cover but no escape route`);
      assert.ok(-shot.angle > 0.2, 'covered shooter should launch above the obstructed direct route');
      rearPositions++;
    }
  }
  assert.ok(rearPositions > 0, 'the library must actually include shooters behind castle cover');
});
