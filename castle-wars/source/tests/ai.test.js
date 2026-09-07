import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseAIAction, ballisticCandidates } from '../server/ai.js';
import { createGame, tickGame, applyAction, predictShot, snapshotGame } from '../shared/game.js';
import { WORLD, RULES, MATERIALS, WEAPONS } from '../shared/content.js';
import { FORMATIONS } from '../shared/formations.js';

const center = b => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
function fresh(side = 0, acceleration = 0, seed = 9, formationId) {
  const g = createGame({ id: `ai-test-${seed}`, seed, formationId, firstSide: side, config: { countdownMs: 0 } });
  tickGame(g, 0);
  g.state.wind = { acceleration, level: acceleration / 10, changesAfterTurns: 2 };
  return g;
}

test('wind-aware arcs reach the distant opposing shooter from every perch in both wind directions', () => {
  for (const side of [0, 1]) for (const acceleration of [-70, 70]) for (const order of [0, 1, 2]) {
    const g = fresh(side, acceleration), s = g.state;
    s.tiles = [];
    const source = s.teams[side].units[order], target = s.teams[1 - side].units[order];
    for (const team of s.teams) for (const u of team.units) u.alive = u.id === source.id || u.id === target.id;
    s.activeUnitId = source.id;
    const options = [0.9, 1].flatMap(power => ballisticCandidates(s, source, WEAPONS.basic, center(target), power));
    assert.ok(options.length, `no solutions: side=${side}, wind=${acceleration}, perch=${order}`);
    assert.ok(options.some(option => predictShot(s, source.id, 'basic', option.angle, option.power).hitId === target.id), `no reachable arc: side=${side}, wind=${acceleration}, perch=${order}`);
  }
});

test('opposite winds change the computed aim and mirror consistently between castles', () => {
  const samples = new Map();
  for (const side of [0, 1]) for (const acceleration of [-70, 70]) {
    const { state: s } = fresh(side, acceleration), source = s.teams[side].units[0], target = s.teams[1 - side].units[0];
    samples.set(`${side}:${acceleration}`, ballisticCandidates(s, source, WEAPONS.basic, center(target), 0.9)[0]);
  }
  assert.ok(Math.abs(samples.get('0:-70').angle - samples.get('0:70').angle) > 0.01);
  const left = samples.get('0:-70'), right = samples.get('1:70');
  assert.ok(Math.abs(left.flightTime - right.flightTime) < 0.001);
  assert.ok(Math.abs(Math.cos(left.angle) + Math.cos(right.angle)) < 0.001);
  assert.ok(Math.abs(Math.sin(left.angle) - Math.sin(right.angle)) < 0.001);
});

test('AI produces finite legal actions on both sides in calm, headwind and tailwind', () => {
  for (const side of [0, 1]) for (const acceleration of [-70, 0, 70]) {
    const g = fresh(side, acceleration, 72 + side), before = snapshotGame(g);
    const action = chooseAIAction(before);
    assert.ok(action); assert.equal(action.unitId, g.state.activeUnitId);
    assert.ok(Number.isFinite(action.angle)); assert.ok(Number.isFinite(action.power));
    assert.ok(action.power > 0 && action.power <= 1);
    assert.equal(WEAPONS[action.weaponId].kind, 'fire');
    assert.equal(applyAction(g, side, action, 1).ok, true);
    assert.deepEqual(before.teams, snapshotGame(fresh(side, acceleration, 72 + side)).teams, 'planner must not mutate public state');
  }
});

test('AI only spends available ammo and preserves valid construction tactics', () => {
  let construction = 0;
  for (let seed = 0; seed < 12; seed++) {
    const g = fresh(seed % 2, seed % 2 ? -70 : 70, seed), own = g.state.teams[g.state.activeSide];
    own.core.hp = 90;
    own.ammo = { basic: -1, lob: -1, bridge: 1, fortress: 1, moon: 0 };
    g.state.waterY = WORLD.groundY + 20;
    const action = chooseAIAction(snapshotGame(g));
    assert.notEqual(action.weaponId, 'moon');
    assert.ok(own.ammo[action.weaponId] !== 0);
    if (action.kind === 'build') construction++;
    assert.equal(applyAction(g, g.state.activeSide, action, 1).ok, true);
  }
  assert.ok(construction > 0, 'defensive tools remain real planner choices');
});

test('impossible low-speed trajectories return no fabricated solution', () => {
  const { state: s } = fresh(0, -70), unit = s.teams[0].units[0];
  const impossible = ballisticCandidates(s, unit, { ...WEAPONS.basic, speedMin: 1, speedMax: 2 }, { x: WORLD.width - 50, y: 100 }, 0.5);
  assert.deepEqual(impossible, []);
});

test('identical public match state produces identical seeded AI plans', () => {
  for (const formation of FORMATIONS) {
    const state = snapshotGame(fresh(0, -70, 303, formation.id));
    const first = chooseAIAction(state);
    assert.deepEqual(chooseAIAction(structuredClone(state)), first, formation.id);
  }
});

for (const formation of FORMATIONS) {
  test(`${formation.name}: AI can clear every firing position in either extreme wind without shooting its own roof`, () => {
    for (const side of [0, 1]) for (const acceleration of [-70, 70]) for (const order of [0, 1, 2]) {
      let enemyImpacts = 0;
      for (const seed of [301, 302, 303]) {
        const game = fresh(side, acceleration, seed, formation.id), state = game.state;
        state.activeUnitId = state.teams[side].units[order].id;
        const publicState = snapshotGame(game), before = structuredClone(publicState);
        const action = chooseAIAction(publicState);
        const label = `${formation.id}/${state.activeUnitId}, wind=${acceleration}, seed=${seed}`;
        assert.ok(action, label);
        assert.equal(action.kind, 'fire', 'initial arsenal contains only rockets');
        assert.deepEqual(publicState, before, 'AI may not mutate the public snapshot');
        const impact = predictShot(state, action.unitId, action.weaponId, action.angle, action.power);
        assert.ok(!impact.hitId?.startsWith(`s${side}:`), `${label}: own-castle contact ${impact.hitId} at (${Math.round(impact.x)}, ${Math.round(impact.y)})`);
        if (impact.hitId?.startsWith(`s${1 - side}:`)) enemyImpacts++;
        assert.equal(applyAction(game, side, action, 1).ok, true, label);
      }
      assert.ok(enemyImpacts > 0, `${formation.id}/s${side}:u${order}, wind=${acceleration}: all three plans missed the opposing castle`);
    }
  });
}


test('AI takes a long high arc over blocking cover and the authoritative rocket lands', () => {
  const game = fresh(0, 0, 72), state = game.state;
  const brick = (id, side, x, y) => ({ id, side, x, y, w: 28, h: 28,
    material: 'masonry', hp: MATERIALS.masonry.hp, maxHp: MATERIALS.masonry.hp, falling: false });
  // Grounded columns form a high firing perch and a taller courtyard wall.
  // The distant defenders stand on a real floor; no actors start unsupported.
  state.tiles = [
    ...Array.from({ length: 21 }, (_, row) => brick(`s0:perch${row}`, 0, 196, 162 + row * 28)),
    ...Array.from({ length: 22 }, (_, row) => brick(`s0:wall${row}`, 0, 420, 134 + row * 28)),
    ...Array.from({ length: 10 }, (_, col) => brick(`s1:floor${col}`, 1, 1624 + col * 28, 722)),
  ];
  const source = state.teams[0].units[0];
  Object.assign(source, { x: 194, y: 122, needsArc: true });
  for (const [index, unit] of state.teams[0].units.entries()) {
    if (index) Object.assign(unit, { x: 40 + (index - 1) * 50, y: WORLD.groundY - unit.h });
  }
  Object.assign(state.teams[0].core, { x: 280, y: WORLD.groundY - state.teams[0].core.h });
  for (const [index, unit] of state.teams[1].units.entries()) Object.assign(unit, { x: 1640 + index * 70, y: 722 - unit.h });
  Object.assign(state.teams[1].core, { x: 1830, y: 722 - state.teams[1].core.h });

  const publicState = snapshotGame(game), before = structuredClone(publicState);
  const action = chooseAIAction(publicState);
  assert.equal(action.kind, 'fire');
  assert.deepEqual(publicState, before, 'planning only reads the public battlefield');
  const forecast = predictShot(state, source.id, action.weaponId, action.angle, action.power);
  assert.ok(forecast.hitId?.startsWith('s1:'), 'the chosen high arc reaches an enemy');
  assert.ok(Math.min(...forecast.points.map(point => point.y)) < -500, 'the chosen arc clears the former sky cutoff');
  assert.ok((forecast.points.length - 1) * 1000 / 30 > 4200, 'the chosen arc needs more than the former flight limit');
  const target = [...state.teams[1].units, state.teams[1].core, ...state.tiles].find(body => body.id === forecast.hitId);
  const lowerRoute = ballisticCandidates(state, source, WEAPONS[action.weaponId], center(target), action.power)
    .sort((a, b) => a.flightTime - b.flightTime)[0];
  assert.ok(lowerRoute);
  assert.ok(predictShot(state, source.id, action.weaponId, lowerRoute.angle, lowerRoute.power).hitId?.startsWith('s0:wall'),
    'the low trajectory to the same defender is blocked by the courtyard wall');

  assert.equal(applyAction(game, 0, action, 1).ok, true);
  let minimumY = Infinity;
  for (let now = 34; now < 4200; now += 34) {
    tickGame(game, now);
    for (const projectile of state.projectiles) minimumY = Math.min(minimumY, projectile.y);
  }
  tickGame(game, 4200);
  assert.equal(state.phase, 'resolve');
  assert.equal(state.projectiles.length, 1, 'the AI rocket remains live beyond the previous lifetime');
  assert.ok(minimumY < -500, 'the authoritative projectile actually passes above the old sky boundary');
  for (let now = 4234; now <= RULES.predictionHorizonMs; now += 34) {
    tickGame(game, now);
    if (state.events.some(event => event.type === 'explosion')) break;
  }
  const blast = state.events.find(event => event.type === 'explosion');
  assert.ok(blast, 'the planned shot must actually land, not merely remain in flight');
  assert.ok(blast.at > 4200);
  assert.ok(Math.hypot(blast.x - forecast.x, blast.y - forecast.y) < .2, 'forecast and authoritative contact agree');
  assert.ok(state.events.some(event => event.type === 'damage' && event.targetId === forecast.hitId && event.cause === 'blast'));
});
