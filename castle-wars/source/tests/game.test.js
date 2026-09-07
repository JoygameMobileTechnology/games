import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, tickGame, applyAction, predictShot, previewTrajectory, validateBuild, snapBuild, getBuildBounds, snapshotGame, endGame } from '../shared/game.js';
import { WORLD, ARENA, RULES, WEAPONS, DEFAULT_WEAPONS, MATERIALS } from '../shared/content.js';

function game(config = {}, seed = 7) {
  const g = createGame({ id: `test-${seed}`, seed, config: { countdownMs: 0, ...config } });
  tickGame(g, 0); return g;
}
function advance(g, until) { for (let t = g.lastTick + 16; t < until; t += 16) tickGame(g, t); tickGame(g, until); }
function fire(g, weaponId = 'basic', options = {}) {
  const side = g.state.activeSide;
  return applyAction(g, side, { kind: 'fire', unitId: g.state.activeUnitId, weaponId, angle: side ? -2.6 : -0.55, power: 0.75, ...options }, g.state.now + 1);
}
function emptyArena(g) {
  g.state.tiles = [];
  for (const t of g.state.teams) {
    t.core.x = t.side ? WORLD.width - 150 : 50; t.core.y = WORLD.groundY - t.core.h;
    for (const u of t.units) { u.x = t.side ? WORLD.width - 80 : 10; u.y = WORLD.groundY - u.h; }
  }
}
function tile(id, x, y, material = 'masonry', w = 28, h = 28) {
  const hp = MATERIALS[material].hp;
  return { id, side: 1, x, y, w, h, material, hp, maxHp: hp, falling: false };
}
function projectileAt(g, weaponId, x, y, vx = 1000, vy = 0) {
  g.state.teams[g.state.activeSide].ammo[weaponId] = 1;
  assert.equal(fire(g, weaponId).ok, true);
  const p = g.state.projectiles[0]; Object.assign(p, { x, y, vx, vy }); return p;
}

test('library has sixteen original weapons, six symmetric selected pools, scarce ammo', () => {
  assert.equal(Object.keys(WEAPONS).length, 16);
  assert.deepEqual(DEFAULT_WEAPONS, ['basic', 'lob']);
  const seen = new Set();
  for (let seed = 0; seed < 12; seed++) {
    const g = game({}, seed); seen.add(g.state.lineup.join(','));
    assert.equal(g.state.lineup.length, 6);
    g.state.lineup.forEach((id, i) => assert.equal(WEAPONS[id].pool, i + 1));
    assert.deepEqual(g.state.teams[0].ammo, g.state.teams[1].ammo);
    assert.equal(g.state.teams[0].ammo.basic, -1);
  }
  assert.ok(seen.size > 1);
  assert.deepEqual(game({}, 81).state.lineup, game({}, 81).state.lineup);
});

test('each shooter has a lofted opening for a large projectile at low, medium and full power', () => {
  const g = game();
  for (const team of g.state.teams) for (const unit of team.units) {
    for (const power of [0.1, 0.5, 1]) {
      let clearOpening = false;
      for (let step = 20; step <= 150 && !clearOpening; step++) {
        const angle = team.side ? -Math.PI + step * 0.01 : -step * 0.01;
        const preview = predictShot(g.state, unit.id, 'moon', angle, power, 18);
        clearOpening = preview.points.length === 19 && preview.hitId === undefined;
      }
      assert.ok(clearOpening, `${unit.id} has no opening for the moon at power ${power}`);
    }
  }
});

test('wind is seeded, bounded and changes only after both sides finish a turn, including sudden death', () => {
  const a = game({ turnMs: 100 }), b = game({ turnMs: 100 });
  const initial = a.state.wind.level;
  advance(a, 101); advance(b, 101);
  assert.equal(a.state.wind.level, initial); assert.equal(a.state.wind.changesAfterTurns, 1);
  advance(a, 202); advance(b, 202);
  assert.notEqual(a.state.wind.level, initial); assert.equal(a.state.wind.changesAfterTurns, 2);
  assert.deepEqual(a.state.wind, b.state.wind);
  a.state.suddenDeath = true;
  const suddenInitial = a.state.wind.level;
  advance(a, 303); assert.equal(a.state.suddenTurns, 1); assert.equal(a.state.wind.level, suddenInitial);
  advance(a, 1100); assert.equal(a.state.suddenTurns, 2); assert.notEqual(a.state.wind.level, suddenInitial);
  for (const event of a.state.events.filter(e => e.type === 'wind')) {
    assert.ok(event.level >= -7 && event.level <= 7);
    assert.equal(event.acceleration, event.level * 10);
  }
  assert.equal(a.state.events.filter(e => e.type === 'wind').length, Math.floor(a.state.completedTurns / 2));
});

test('wind-aware preview and authoritative flight agree at every opening-arc step', () => {
  for (const acceleration of [-70, 70]) for (const weapon of ['basic', 'lob']) {
    const g = game(); emptyArena(g); g.state.wind.acceleration = acceleration;
    Object.assign(g.state.teams[0].units[0], { x: 600, y: 400 });
    const guide = previewTrajectory(g.state, g.state.activeUnitId, weapon, -0.65, 0.65);
    assert.equal(fire(g, weapon, { angle: -0.65, power: 0.65 }).ok, true);
    for (let i = 1; i < guide.length; i++) {
      advance(g, i * 1000 / 30 + 0.001);
      const p = g.state.projectiles[0];
      assert.ok(p, `projectile disappeared on guide step ${i}`);
      assert.ok(Math.abs(p.x - guide[i].x) < 0.00001);
      assert.ok(Math.abs(p.y - guide[i].y) < 0.00001);
    }
  }
});

test('wind-aware impact prediction matches actual castle contact from either side', () => {
  for (const side of [0, 1]) for (const acceleration of [-70, 70]) {
    const g = game(); g.state.activeSide = side; g.state.activeUnitId = `s${side}:u0`; g.state.wind.acceleration = acceleration;
    // A rear courtyard battery must loft over its own gatehouse; the safe
    // elevation and power differ between headwind and tailwind.
    let shot;
    outer: for (const power of [1, 0.9, 0.8, 0.7]) for (let step = 20; step <= 150; step++) {
      const angle = side ? -Math.PI + step * 0.01 : -step * 0.01;
      const prediction = predictShot(g.state, g.state.activeUnitId, 'basic', angle, power);
      if (prediction.hitId?.startsWith(`s${1 - side}:`)) { shot = { angle, power, prediction }; break outer; }
    }
    assert.ok(shot, 'a playable enemy-reaching trajectory exists');
    const { angle, power, prediction } = shot;
    assert.ok(prediction.hitId?.startsWith(`s${1 - side}:`));
    fire(g, 'basic', { angle, power }); advance(g, (prediction.points.length - 1) * 1000 / 30 + 50);
    const blast = g.state.events.find(e => e.type === 'explosion');
    assert.ok(blast); assert.ok(Math.abs(blast.x - prediction.x) <= 0.11); assert.ok(Math.abs(blast.y - prediction.y) <= 0.11);
  }
});

test('a high headwind arc survives past three seconds and lands at its predicted contact', () => {
  const g = game(); g.state.wind.acceleration = -70;
  const prediction = predictShot(g.state, g.state.activeUnitId, 'basic', -1, 1);
  assert.ok(prediction.hitId?.startsWith('s1:'));
  assert.ok(prediction.points.length > 90);
  fire(g, 'basic', { angle: -1, power: 1 }); advance(g, 3100);
  assert.equal(g.state.phase, 'resolve'); assert.equal(g.state.projectiles.length, 1);
  advance(g, (prediction.points.length - 1) * 1000 / 30 + 100);
  const blast = g.state.events.find(e => e.type === 'explosion');
  assert.ok(blast); assert.ok(Math.abs(blast.x - prediction.x) <= 0.11);
  advance(g, 6001); assert.equal(g.state.phase, 'aim');
});

test('timeouts rotate in roster order, skip casualties, and unlock exactly after each pair', () => {
  const g = game({ turnMs: 100 });
  assert.equal(g.state.activeUnitId, 's0:u0');
  advance(g, 101); assert.equal(g.state.activeUnitId, 's1:u0'); assert.equal(g.state.unlockedCount, 0);
  advance(g, 202); assert.equal(g.state.activeUnitId, 's0:u1'); assert.equal(g.state.unlockedCount, 1);
  const id = g.state.lineup[0]; assert.equal(g.state.teams[0].ammo[id], WEAPONS[id].ammo);
  g.state.teams[0].units[2].alive = false; g.state.teams[0].units[2].hp = 0;
  advance(g, 410); assert.equal(g.state.activeUnitId, 's0:u0');
  advance(g, 2000); assert.equal(g.state.unlockedCount, 6);
  assert.equal(g.state.teams[0].ammo[id], WEAPONS[id].ammo);
  assert.equal(g.state.events.filter(e => e.type === 'unlock').length, 6);
});

test('illegal actions spend nothing; finite inputs, ownership, active unit and scarcity are enforced', () => {
  const g = game(), base = { kind: 'fire', unitId: 's0:u0', weaponId: 'basic', angle: -0.5, power: 0.7 };
  assert.equal(applyAction(g, 1, base, 1).reason, 'NOT_YOUR_TURN');
  assert.equal(applyAction(g, 0, { ...base, unitId: 's0:u1' }, 2).reason, 'WRONG_SHOOTER');
  assert.equal(applyAction(g, 0, { ...base, angle: NaN }, 3).reason, 'INVALID_AIM');
  assert.equal(applyAction(g, 0, { ...base, weaponId: 'moon' }, 4).reason, 'WEAPON_LOCKED');
  assert.equal(g.state.teams[0].ammo.basic, -1);
  assert.equal(applyAction(g, 0, base, 5).ok, true);
  assert.equal(applyAction(g, 0, base, 6).reason, 'NOT_AIMING');
  assert.equal(g.state.teams[0].ammo.basic, -1);
});

test('construction validates atomically, consumes the turn, remains physical and cannot heal core', () => {
  const g = game(); const s = g.state;
  s.teams[0].ammo.bridge = 1;
  const damagedCoreHp = s.teams[0].core.maxHp - 40; s.teams[0].core.hp = damagedCoreHp;
  const region = getBuildBounds(s, 0);
  const anchor = snapBuild(s, 0, region.x + 56, region.y);
  assert.equal(validateBuild(s, 0, 'bridge', anchor.x, anchor.y).ok, true);
  const before = s.tiles.length;
  const build = { kind: 'build', unitId: s.activeUnitId, weaponId: 'bridge', ...anchor };
  assert.equal(applyAction(g, 0, { ...build, y: 400 }, 1).ok, false);
  assert.equal(s.teams[0].ammo.bridge, 1); assert.equal(s.tiles.length, before);
  assert.equal(applyAction(g, 0, build, 2).ok, true);
  assert.equal(s.teams[0].ammo.bridge, 0); assert.equal(s.tiles.length, before + 3);
  assert.equal(s.teams[0].core.hp, damagedCoreHp);
  advance(g, 1000); assert.equal(s.activeSide, 1);
  assert.equal(validateBuild(s, 0, 'bridge', anchor.x, anchor.y).reason, 'OCCUPIED');
  assert.equal(validateBuild(s, 0, 'bridge', region.x + 168, region.y).ok, true);
  s.waterY = anchor.y + 28;
  assert.equal(validateBuild(s, 0, 'bridge', anchor.x, anchor.y).reason, 'UNDERWATER');
});

test('swept rockets hit thin reinforced walls and cover occludes a nearby core', () => {
  const g = game(); emptyArena(g);
  const core = g.state.teams[1].core; Object.assign(core, { x: 720, y: 698 });
  const wall = tile('wall', 700, 680, 'reinforced', 8, 70); g.state.tiles = [wall];
  projectileAt(g, 'basic', 650, 715, 6000, 0);
  advance(g, 34);
  assert.equal(g.state.projectiles.length, 0);
  assert.ok(wall.hp < MATERIALS.reinforced.hp && wall.hp > 0);
  assert.equal(core.hp, core.maxHp, 'one intact wall must block overlapping splash');
  assert.ok(g.state.events.some(e => e.type === 'explosion' && e.x < wall.x));
});

test('an exposed core receives blast damage and reaches zero through health, not wall count', () => {
  const g = game(); emptyArena(g);
  const core = g.state.teams[1].core; Object.assign(core, { x: 720, y: 698, hp: 30 });
  projectileAt(g, 'basic', 650, 715, 6000, 0); advance(g, 34);
  assert.equal(core.hp, 0); assert.equal(g.state.result.winner, 0);
  assert.equal(g.state.result.reason, 'Enemy core destroyed');
});

test('penetrators spend material resistance before continuing to deeper targets', () => {
  const g = game(); emptyArena(g);
  g.state.tiles = [tile('first', 650, 680, 'reinforced', 28, 70), tile('second', 706, 680, 'reinforced', 28, 70)];
  const p = projectileAt(g, 'drill', 610, 710, 5000, 0); advance(g, 34);
  assert.equal(p.penetration, 0);
  assert.ok(g.state.events.some(e => e.targetId === 'first' && e.cause === 'penetration'));
  assert.ok(g.state.events.some(e => e.type === 'explosion' && e.x < 706));
  assert.equal(g.state.events.filter(e => e.cause === 'penetration').length, 1);
});

test('unsupported structure falls as persistent physical rubble and minor shooter falls stay capped', () => {
  const g = game(); emptyArena(g);
  const u = g.state.teams[1].units[0]; Object.assign(u, { x: 700, y: 360 });
  g.state.tiles = [tile('ledge', 690, 400, 'masonry', 84, 28)];
  g.dirtyStructure = true; projectileAt(g, 'basic', 900, 200, 1000, -500);
  advance(g, 5000);
  const ledge = g.state.tiles.find(t => t.id === 'ledge');
  assert.ok(ledge); assert.equal(ledge.y + ledge.h, WORLD.groundY);
  assert.equal(ledge.rubble, true); assert.equal(ledge.falling, false);
  assert.ok(u.alive); assert.ok(u.hp >= 80); assert.ok(u.y > 360);
});

test('heavy falling rubble kills by impact while harmless intact overhead shelter does not', () => {
  const g = game(); emptyArena(g);
  const unit = g.state.teams[1].units[0]; Object.assign(unit, { x: 690, y: 710 });
  g.state.tiles = Array.from({ length: 6 }, (_, i) => tile(`heavy-${i}`, 672 + (i % 3) * 28, 480 + Math.floor(i / 3) * 28));
  g.dirtyStructure = true; projectileAt(g, 'basic', 900, 200, 1000, -500); advance(g, 5000);
  assert.equal(unit.alive, false);
  assert.ok(g.state.events.some(e => e.type === 'death' && ['rubble', 'crushed'].includes(e.cause)));
  const intact = game(); fire(intact); advance(intact, 5000);
  assert.ok(intact.state.teams[0].units.every(u => u.alive));
});

test('every offensive projectile drowned at water contact emits only a plop', () => {
  for (const w of Object.values(WEAPONS).filter(w => w.kind === 'fire')) {
    const g = game(); emptyArena(g); g.state.waterY = 500;
    projectileAt(g, w.id, 800, 480, 0, 1500); advance(g, 34);
    assert.equal(g.state.projectiles.length, 0, w.id);
    assert.ok(g.state.events.some(e => e.type === 'plop'), w.id);
    assert.equal(g.state.events.filter(e => ['explosion', 'split'].includes(e.type)).length, 0, w.id);
    assert.equal(g.pulses.length, 0, w.id);
  }
});

test('cluster descendants have no lifetime cutoff and cannot recursively split', () => {
  const g = game(); emptyArena(g);
  projectileAt(g, 'firework', 800, 50, 120, -20);
  advance(g, 150);
  assert.equal(g.state.projectiles.length, 5);
  assert.ok(g.state.projectiles.every(p => p.child && !('deadline' in p)));
  advance(g, 4000); assert.equal(g.state.projectiles.length, 0);
  assert.equal(g.state.events.filter(e => e.type === 'split').length, 1);
});

test('accordion and pocket-star pulses use sequential geometry and remain bounded', () => {
  for (const [id, count] of [['accordion', 3], ['star', 5]]) {
    const g = game(); emptyArena(g);
    projectileAt(g, id, 800, 730, 0, 800); advance(g, 2000);
    assert.equal(g.state.events.filter(e => e.type === 'explosion' && e.weaponId === id).length, count);
    assert.equal(g.pulses.length, 0);
  }
});

test('pinball bounces twice, detonates on third solid contact, and preserves scarce ammunition', () => {
  const g = game(); emptyArena(g);
  const p = projectileAt(g, 'pinball', 800, 730, 0, 1200);
  advance(g, 34); assert.equal(p.bounces, 1); assert.equal(g.state.projectiles.length, 1);
  Object.assign(p, { x: 800, y: 730, vx: 0, vy: 1200 });
  advance(g, 68); assert.equal(p.bounces, 0); assert.equal(g.state.projectiles.length, 1);
  Object.assign(p, { x: 800, y: 730, vx: 0, vy: 1200 });
  advance(g, 102); assert.equal(g.state.projectiles.length, 0);
  assert.equal(g.state.events.filter(e => e.type === 'bounce').length, 2);
  assert.equal(g.state.events.filter(e => e.type === 'explosion').length, 1);
  assert.equal(g.state.teams[0].ammo.pinball, 0);
});

test('signal seeker begins bounded steering after delay and loses guidance when its target dies', () => {
  const g = game(); emptyArena(g);
  const target = g.state.teams[1].units[0]; Object.assign(target, { x: 900, y: 200 });
  const p = projectileAt(g, 'seeker', 700, 400, 1000, 0);
  Object.assign(p, { age: 0.5, targetId: target.id });
  advance(g, 34);
  assert.ok(p.vy < 0, 'guidance turns upward despite gravity');
  assert.ok(Math.abs(Math.atan2(p.vy, p.vx)) < Math.PI / 90, 'per-step turn remains bounded');
  target.alive = false; target.hp = 0;
  const before = p.vy; advance(g, 68);
  assert.ok(p.vy > before, 'without a living target only gravity changes vertical speed');
});

test('Saturn emits exactly four single-generation satellites without a lifetime cutoff', () => {
  const g = game(); emptyArena(g);
  projectileAt(g, 'saturn', 800, 730, 0, 1200);
  advance(g, 34);
  assert.equal(g.state.events.filter(e => e.type === 'explosion').length, 1);
  assert.equal(g.state.projectiles.length, 4);
  assert.ok(g.state.projectiles.every(c => c.child && !('deadline' in c)));
  advance(g, 4000);
  assert.ok(g.state.events.filter(e => e.type === 'explosion').length <= 5);
});

test('upper masonry breaks sooner than reinforced foundations under the identical basic hit', () => {
  const outcomes = [];
  for (const material of ['masonry', 'reinforced']) {
    const g = game(); emptyArena(g);
    const wall = tile('wall', 700, 680, material, 28, 70); g.state.tiles = [wall];
    projectileAt(g, 'basic', 650, 715, 6000, 0); advance(g, 34); outcomes.push(wall.hp);
  }
  assert.equal(outcomes[0], 0); assert.ok(outcomes[1] > 0 && outcomes[1] < MATERIALS.reinforced.hp);
});

test('a pulse that breaks cover cannot also bypass that pre-impact cover; later pulses can', () => {
  const g = game(); emptyArena(g);
  const core = g.state.teams[1].core; Object.assign(core, { x: 731, y: 698 });
  g.state.tiles = [tile('cover', 700, 680, 'masonry', 28, 70)];
  projectileAt(g, 'star', 650, 715, 6000, 0); advance(g, 34);
  assert.equal(core.hp, core.maxHp);
  advance(g, 230); assert.ok(core.hp < core.maxHp);
});

test('core collapse changes its position with capped own-fall damage, without inventing defeat', () => {
  const g = game(); emptyArena(g);
  const core = g.state.teams[1].core; Object.assign(core, { x: 800, y: 400 });
  projectileAt(g, 'basic', 400, 200, -1000, -500); advance(g, 5000);
  assert.equal(core.y + core.h, WORLD.groundY);
  assert.equal(core.hp, core.maxHp - 60); assert.equal(g.state.result, null);
});

test('same-blast final shooter deaths create exactly one mutual destruction result', () => {
  const g = game(); emptyArena(g);
  for (const t of g.state.teams) {
    t.units[1].alive = false; t.units[1].hp = 0; t.units[2].alive = false; t.units[2].hp = 0;
    Object.assign(t.units[0], { x: 780 + t.side * 40, y: 710, hp: 20 });
  }
  projectileAt(g, 'moon', 800, 660, 0, 1500); advance(g, 68);
  assert.equal(g.state.result?.winner, null); assert.equal(g.state.result?.reason, 'Mutual destruction');
  assert.equal(g.state.events.filter(e => e.type === 'result').length, 1);
});

test('regulation cutoff preserves the next entitled side, then water advances once per completed turn', () => {
  const g = game({ turnMs: 100, regulationMs: 800, transitionMs: 200, waterMs: 30 });
  advance(g, 600); assert.equal(g.state.phase, 'transition');
  const side = g.state.activeSide, completed = g.state.completedTurns;
  advance(g, 800); assert.equal(g.state.suddenDeath, true); assert.equal(g.state.activeSide, side);
  assert.equal(g.state.completedTurns, completed);
  advance(g, 3000);
  assert.equal(g.state.result.winner, null);
  assert.equal(g.state.result.reason, 'Both crews drowned together');
  assert.equal(g.state.suddenTurns, g.state.waterRise); assert.ok(g.state.suddenTurns <= 6);
});

test('same-rise last-shooter drown is a draw, with no sequential first-player bias', () => {
  const g = game({ turnMs: 100 });
  for (const t of g.state.teams) for (const u of t.units) { u.y = 700; }
  g.state.suddenDeath = true; advance(g, 101);
  assert.equal(g.state.result.winner, null);
  assert.equal(g.state.result.reason, 'Both crews drowned together');
  assert.equal(g.state.events.filter(e => e.type === 'result').length, 1);
  endGame(g, 1, 'late duplicate'); assert.equal(g.state.result.winner, null);
});

test('snapshot is isolated and stale clock calls cannot reverse authoritative time', () => {
  const g = game(); advance(g, 100);
  const s = snapshotGame(g); s.teams[0].core.hp = 0;
  assert.equal(g.state.teams[0].core.hp, RULES.coreHp);
  tickGame(g, 50); assert.equal(g.state.now, 100);
});

test('host suspension during aim interrupts without granting overtime or fresh sudden-death turns', () => {
  const g = game(); assert.equal(g.state.phase, 'aim');
  const deadline = g.state.turnDeadline;
  tickGame(g, 400000);
  assert.equal(g.state.phase, 'ended');
  assert.deepEqual(g.state.result, { winner: null, reason: 'Host simulation interrupted', interrupted: true, endedAt: 400000, presentation: null });
  assert.equal(g.state.turnDeadline, deadline);
  assert.equal(g.state.suddenTurns, 0);
});
