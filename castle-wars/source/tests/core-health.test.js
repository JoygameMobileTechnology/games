import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tickGame, applyAction, predictShot } from '../shared/game.js';
import { MATERIALS, RULES, WORLD } from '../shared/content.js';

function advance(g, until) {
  for (let now = g.lastTick + 16; now < until; now += 16) tickGame(g, now);
  tickGame(g, until);
}

function exposedCore(side, weaponId) {
  const g = createGame({ id: `core-health-${side}-${weaponId}`, seed: 0, firstSide: side, config: { countdownMs: 0, turnMs: 1000 } });
  tickGame(g, 0);
  g.state.tiles = [];
  const reflect = (x, w) => side ? WORLD.width - x - w : x;
  for (const team of g.state.teams) {
    const attacking = team.side === side;
    team.core.x = reflect(attacking ? 100 : 720, team.core.w);
    team.core.y = WORLD.groundY - team.core.h;
    for (const unit of team.units) {
      unit.x = reflect(attacking ? 600 : 1800, unit.w);
      unit.y = WORLD.groundY - unit.h;
      // A single surviving crew member keeps the fixture focused on core
      // damage while retaining real automatic roster rotation and turn rules.
      if (unit.order > 0) { unit.alive = false; unit.hp = 0; }
    }
  }
  if (weaponId === 'anvil') {
    // Seed 0 legitimately unlocks the two-shot anvil after a complete pair.
    advance(g, g.state.turnDeadline + 1);
    advance(g, g.state.turnDeadline + 1);
    assert.equal(g.state.teams[side].ammo.anvil, 2);
  }
  return { g, core: g.state.teams[1 - side].core, reflect };
}

function hit(g, side, weaponId, targetId) {
  const angle = side ? Math.PI : 0;
  assert.equal(g.state.phase, 'aim');
  assert.equal(g.state.activeSide, side);
  // Use normal muzzle placement and authoritative ballistics, rather than
  // injecting damage or moving a live projectile onto the target.
  const prediction = predictShot(g.state, g.state.activeUnitId, weaponId, angle, 1);
  assert.equal(prediction.hitId, targetId);
  assert.equal(applyAction(g, side, { kind: 'fire', unitId: g.state.activeUnitId, weaponId, angle, power: 1 }, g.state.now + 1).ok, true);
  advance(g, g.state.now + (weaponId === 'anvil' ? 1200 : 400));
  assert.equal(g.state.projectiles.length, 0);
  if (!g.state.result) {
    assert.equal(g.state.activeSide, 1 - side);
    advance(g, g.state.turnDeadline + 1); // Opponent passes through its timeout.
    assert.equal(g.state.activeSide, side);
  }
}

test('new castles start with 120 core health and an equal HUD maximum', () => {
  assert.equal(RULES.coreHp, 120);
  for (const team of createGame().state.teams) {
    assert.equal(team.core.hp, 120);
    assert.equal(team.core.maxHp, 120);
  }
});

for (const [weaponId, directHits] of [['basic', 3], ['lob', 3], ['anvil', 2]]) {
  for (const side of [0, 1]) {
    test(`${weaponId}: ${directHits} actual direct hits destroy the opposing core from side ${side}`, () => {
      const { g, core } = exposedCore(side, weaponId);
      for (let count = 1; count <= directHits; count++) {
        const before = core.hp;
        hit(g, side, weaponId, core.id);
        assert.ok(core.hp < before, 'each actual collision must damage the core');
        if (count < directHits) {
          assert.ok(core.hp > 0, 'the core must survive earlier direct hits');
          assert.equal(g.state.result, null);
        }
      }
      assert.equal(core.hp, 0);
      assert.equal(g.state.result?.winner, side);
      assert.equal(g.state.result?.reason, 'Enemy core destroyed');
      assert.equal(g.state.events.filter(event => event.type === 'result').length, 1);
      assert.equal(g.state.teams[side].ammo[weaponId], weaponId === 'anvil' ? 0 : -1);
      assert.ok(g.state.teams[1 - side].units[0].alive, 'core destruction is the winning condition');
    });
  }
}

for (const side of [0, 1]) {
  test(`weaker cores retain wall protection until cover is breached, from side ${side}`, () => {
    const { g, core, reflect } = exposedCore(side, 'basic');
    const wall = { id: 'core-cover', side: 1 - side, x: reflect(700, 8), y: 680, w: 8, h: 70, material: 'reinforced', hp: MATERIALS.reinforced.hp, maxHp: MATERIALS.reinforced.hp, falling: false };
    g.state.tiles = [wall];
    for (let count = 0; count < 2; count++) {
      hit(g, side, 'basic', wall.id);
      assert.equal(core.hp, core.maxHp, 'cover present at impact shields the core for the entire blast');
      assert.equal(g.state.result, null);
    }
    assert.equal(wall.hp, 0);
    assert.ok(!g.state.tiles.includes(wall));
    for (let count = 0; count < 3; count++) hit(g, side, 'basic', core.id);
    assert.equal(core.hp, 0);
    assert.equal(g.state.result?.winner, side);
  });
}
