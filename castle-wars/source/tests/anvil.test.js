import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tickGame, applyAction, predictShot } from '../shared/game.js';
import { WEAPONS, WORLD } from '../shared/content.js';

function advance(g, until) {
  for (let now = g.lastTick + 16; now < until; now += 16) tickGame(g, now);
  tickGame(g, until);
}

function fixture(side = 0, targetHp = 65, config = {}) {
  const g = createGame({ id: `anvil-${side}`, firstSide: side, config: { countdownMs: 0, ...config } });
  tickGame(g, 0);
  g.state.tiles = [{ id: 'target', side: 1 - side, x: 980, y: 700, w: 40, h: 50,
    hp: targetHp, maxHp: targetHp, material: 'reinforced', falling: false }];
  for (const team of g.state.teams) {
    team.core.x = team.side ? 1800 : 150;
    team.core.y = WORLD.groundY - team.core.h;
    for (const unit of team.units) {
      unit.x = team.side ? 1900 : 50;
      unit.y = WORLD.groundY - unit.h;
    }
  }
  g.state.teams[side].ammo.anvil = 2;
  assert.equal(applyAction(g, side, { kind: 'fire', unitId: g.state.activeUnitId,
    weaponId: 'anvil', angle: side ? Math.PI : 0, power: 1 }, 1).ok, true);
  const projectile = g.state.projectiles[0];
  Object.assign(projectile, { x: side ? 1070 : 930, y: 715, vx: side ? -1800 : 1800, vy: 0 });
  return { g, projectile };
}

const explosions = g => g.state.events.filter(e => e.type === 'explosion' && e.weaponId === 'anvil');

for (const side of [0, 1]) {
  test(`Anvil side ${side} makes one vertical return blast after destroying its original contact`, () => {
    const { g, projectile } = fixture(side);
    g.state.wind.acceleration = side ? -70 : 70;
    advance(g, 50);
    const first = explosions(g)[0];
    assert.ok(first);
    assert.ok(!g.state.tiles.some(tile => tile.id === 'target'), 'first explosion removes the supporting target');
    assert.equal(g.state.projectiles[0], projectile, 'the launched Anvil itself rebounds');
    assert.equal(projectile.rebound.x, first.x);
    assert.equal(projectile.rebound.y, first.y);
    assert.equal(g.state.completedTurns, 0);
    assert.equal(g.state.teams[side].ammo.anvil, 1);
    const turnId = g.state.turnId, landingAt = projectile.rebound.startedAt + projectile.rebound.durationMs;
    let highest = first.y;
    for (let now = g.lastTick + 25; now < landingAt; now += 25) {
      advance(g, now);
      assert.equal(projectile.x, first.x, 'wind never moves the vertical rebound');
      highest = Math.min(highest, projectile.y);
      assert.equal(g.state.turnId, turnId, 'the opponent waits through the entire hop');
      assert.equal(explosions(g).length, 1);
    }
    assert.ok(first.y - highest > 59 && first.y - highest <= 60, 'the hop rises only 60 world pixels');
    advance(g, landingAt + 35);
    const second = explosions(g)[1];
    assert.ok(second);
    assert.equal(second.x, first.x);
    assert.equal(second.y, first.y, 'return explodes at the original point even after the target disappears');
    assert.equal(second.radius, first.radius * WEAPONS.anvil.reboundRadiusScale);
    assert.equal(second.child, true);
    assert.ok(second.at - first.at >= 700 && second.at - first.at < 735);
    assert.equal(g.state.projectiles.length, 0);
    assert.equal(g.state.activeSide, side, 'landing blast gets its usual settle time');
    advance(g, 2000);
    assert.equal(explosions(g).length, 2, 'there is exactly one rebound explosion');
    assert.equal(g.state.events.filter(e => e.type === 'bounce').length, 1);
    assert.equal(g.state.events.filter(e => e.type === 'launch').length, 1);
    assert.equal(g.state.completedTurns, 1);
    assert.equal(g.state.activeSide, 1 - side);
    assert.equal(g.state.teams[side].ammo.anvil, 1, 'the second impact consumes no extra ammo');
  });
}

test('Anvil rebound deals less damage as well as covering a smaller radius', () => {
  const { g } = fixture(0, 1000);
  advance(g, 1500);
  const damage = g.state.events.filter(e => e.type === 'damage' && e.targetId === 'target');
  assert.equal(damage.length, 2);
  assert.ok(damage[0].value > damage[1].value && damage[1].value > 0);
  assert.ok(damage[1].value <= WEAPONS.anvil.reboundDamage);
  assert.equal(explosions(g).length, 2);
});

test('a lethal second Anvil blast owns the last-shooter slow-motion finish and its two-second deadline', () => {
  const { g } = fixture();
  g.state.tiles = [];
  const crew = g.state.teams[1].units, lastShooter = crew[0];
  Object.assign(lastShooter, { x: 980, y: WORLD.groundY - lastShooter.h });
  for (const unit of crew.slice(1)) { unit.alive = false; unit.hp = 0; }
  advance(g, 50);
  assert.equal(explosions(g).length, 1);
  assert.ok(lastShooter.hp > 0 && lastShooter.hp < 45, 'the first heavy hit wounds the final shooter');
  assert.equal(g.state.result, null);
  advance(g, 1200);
  const second = explosions(g)[1], result = g.state.result;
  assert.ok(second?.child, 'the smaller returning blast kills the survivor');
  assert.equal(lastShooter.hp, 0);
  assert.equal(result?.winner, 0);
  assert.equal(result.reason, 'Enemy crew eliminated');
  assert.equal(result.presentation.finish.event.id, second.id);
  assert.equal(result.presentation.finish.event.child, true);
  assert.equal(result.presentation.finish.at, second.at);
  assert.equal(result.presentation.finish.endsAt, second.at + 2000);
  assert.equal(result.presentation.endsAt, second.at + 2000);
  assert.equal(result.presentation.finish.deaths[0].explosionId, second.id);
  assert.equal(g.state.teams[0].ammo.anvil, 1);
});

test('Anvil water contact produces only a plop and never starts a rebound', () => {
  const { g } = fixture();
  g.state.waterY = 723;
  advance(g, 1000);
  assert.equal(explosions(g).length, 0);
  assert.equal(g.state.events.filter(e => e.type === 'bounce').length, 0);
  assert.equal(g.state.events.filter(e => e.type === 'plop').length, 1);
  assert.equal(g.state.projectiles.length, 0);
});

test('a rebounding Anvil that returns into water plops without a second explosion', () => {
  const { g } = fixture();
  advance(g, 400);
  assert.equal(explosions(g).length, 1);
  assert.ok(g.state.projectiles[0].rebound);
  g.state.waterY = 723;
  advance(g, 1500);
  assert.equal(explosions(g).length, 1);
  assert.equal(g.state.events.filter(e => e.type === 'plop').length, 1);
  assert.equal(g.state.projectiles.length, 0);
});

test('an Anvil returning from an eleven-second flight still completes its full rebound', () => {
  const { g, projectile } = fixture();
  g.state.wind.acceleration = 0;
  Object.assign(projectile, { x: 1000, y: -900, vx: 0, vy: 0, gravityScale: 0.001 });
  advance(g, 11000);
  assert.equal(g.state.projectiles[0], projectile);
  assert.equal(g.state.phase, 'resolve');
  assert.equal(explosions(g).length, 0);
  Object.assign(projectile, { x: 930, y: 715, vx: 1800, vy: 0 });
  advance(g, 11050);
  assert.equal(explosions(g).length, 1);
  assert.equal(projectile.rebound.durationMs, 700);
  assert.ok(!('deadline' in projectile));
  advance(g, 11400);
  assert.equal(g.state.phase, 'resolve');
  assert.equal(g.state.projectiles[0], projectile);
  assert.equal(explosions(g).length, 1);
  advance(g, 11800);
  assert.equal(explosions(g).length, 2);
  assert.ok(explosions(g)[1].at - explosions(g)[0].at >= 700);
  assert.ok(explosions(g)[1].at - explosions(g)[0].at < 735);
  advance(g, 12100);
  assert.equal(g.state.phase, 'aim');
  assert.equal(g.state.activeSide, 1);
  assert.equal(g.state.projectiles.length, 0);
});

test('a tiny aftermath budget cannot truncate the Anvil rebound or advance the turn early', () => {
  const { g, projectile } = fixture(0, 65, { resolutionMs: 1 });
  advance(g, 150);
  assert.equal(explosions(g).length, 1);
  assert.equal(g.state.projectiles[0], projectile);
  assert.equal(projectile.rebound.durationMs, 700);
  assert.equal(g.state.phase, 'resolve');
  assert.equal(g.state.completedTurns, 0);
  advance(g, 1000);
  assert.equal(explosions(g).length, 2);
  assert.equal(g.state.projectiles.length, 0);
  assert.equal(g.state.phase, 'aim');
  assert.equal(g.state.completedTurns, 1);
});

for (const side of [0, 1]) {
  test(`Anvil's actual first impact still matches its wind-aware prediction from side ${side}`, () => {
    const g = createGame({ firstSide: side, config: { countdownMs: 0 } });
    tickGame(g, 0);
    g.state.tiles = [];
    for (const team of g.state.teams) {
      team.core.x = team.side ? 1800 : 150;
      team.core.y = WORLD.groundY - team.core.h;
      for (const unit of team.units) {
        unit.x = team.side ? 1900 : 50; unit.y = WORLD.groundY - unit.h;
      }
    }
    const unit = g.state.teams[side].units[0];
    unit.x = side ? 1100 : 868;
    g.state.teams[side].ammo.anvil = 2;
    g.state.wind.acceleration = side ? -70 : 70;
    const angle = side ? -Math.PI + 0.25 : -0.25, power = 0.25;
    const prediction = predictShot(g.state, unit.id, 'anvil', angle, power);
    assert.equal(prediction.hitType, 'ground');
    assert.equal(applyAction(g, side, { kind: 'fire', unitId: unit.id, weaponId: 'anvil', angle, power }, 1).ok, true);
    advance(g, 4000);
    const first = explosions(g)[0];
    assert.ok(Math.abs(first.x - prediction.x) < 0.11);
    assert.ok(Math.abs(first.y - prediction.y) < 0.11);
    assert.equal(explosions(g).length, 2);
  });
}
