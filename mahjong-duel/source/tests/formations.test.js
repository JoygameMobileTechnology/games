import test from 'node:test';
import assert from 'node:assert/strict';
import { FORMATIONS, FORMATION_IDS, getFormation, chooseFormationId } from '../src/formations.js';
import { TILES_PER_DUEL } from '../src/game-balance.js';
import { createGame, isFree, canMatch, removePair, remainingCount, getAvailablePairs, shuffleBoard, isCurrentCatalogueDeal } from '../src/engine.js';

const positions = tiles => tiles.map(({ x, y, z }) => `${x},${y},${z}`).sort();
const inventory = tiles => tiles.map(({ id, faceId, matchKey, removed }) => ({ id, faceId, matchKey, removed }));
const overlaps = (a, b) => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;

function clearDeal(tiles, solution) {
  let current = tiles;
  for (const [a, b] of solution) {
    const first = current.find(tile => tile.id === a);
    const second = current.find(tile => tile.id === b);
    assert.ok(isFree(first, current) && isFree(second, current), 'both tiles are uncovered before removal');
    assert.ok(canMatch(first, second), 'the solution uses exact-picture matching');
    const next = removePair(current, a, b);
    assert.equal(remainingCount(next), remainingCount(current) - 2);
    current = next;
  }
  assert.equal(remainingCount(current), 0);
}

test('twelve distinct compact formations have supported tiers and no duplicate or overlapping same-tier slots', () => {
  assert.equal(FORMATIONS.length, 12);
  assert.equal(new Set(FORMATION_IDS).size, 12);
  assert.equal(new Set(FORMATIONS.map(value => value.name)).size, 12);
  assert.equal(new Set(FORMATIONS.map(value => positions(value.slots).join('|'))).size, 12);
  const tierProfiles = [];
  for (const formation of FORMATIONS) {
    const { id, slots, bounds } = formation;
    assert.match(id, /^[a-z]+(?:-[a-z]+)*$/);
    assert.equal(slots.length, TILES_PER_DUEL, id);
    assert.equal(new Set(slots.map(slot => slot.id)).size, TILES_PER_DUEL, id);
    assert.equal(new Set(positions(slots)).size, TILES_PER_DUEL, id);
    assert.ok(bounds.width >= 5.5 && bounds.width <= 6, id);
    assert.ok(bounds.height >= 6.5 && bounds.height <= 7.5, id);
    assert.ok(bounds.layers >= 2 && bounds.layers <= 5, id);
    assert.equal(bounds.minX, Math.min(...slots.map(slot => slot.x)));
    assert.equal(bounds.minY, Math.min(...slots.map(slot => slot.y)));
    assert.equal(bounds.maxX, Math.max(...slots.map(slot => slot.x + 1)));
    assert.equal(bounds.maxY, Math.max(...slots.map(slot => slot.y + 1)));
    const tiers = Array.from({ length: bounds.layers }, (_, z) => slots.filter(slot => slot.z === z));
    tierProfiles.push(tiers.map(tier => tier.length).join(','));
    for (const tier of tiers) {
      assert.ok(tier.length > 0 && tier.length % 2 === 0, `${id} has an even, nonempty tier`);
      for (let index = 0; index < tier.length; index += 1) {
        assert.ok(tier.slice(index + 1).every(other => !overlaps(tier[index], other)), `${id} has no same-tier overlap`);
      }
    }
    for (const slot of slots) {
      assert.ok([slot.x, slot.y, slot.z].every(Number.isFinite));
      assert.ok(slot.x >= 0 && slot.y >= 0 && Number.isInteger(slot.z));
      if (slot.z > 0) assert.ok(slots.some(below => below.z === slot.z - 1 && overlaps(slot, below)), `${id}: no floating upper tile`);
      assert.ok(Object.isFrozen(slot));
    }
    assert.ok(Object.isFrozen(formation) && Object.isFrozen(slots) && Object.isFrozen(bounds));
    assert.strictEqual(getFormation(id), formation);
  }
  assert.equal(new Set(tierProfiles).size, 12, 'each silhouette also has a distinct distribution of stacked tiles');
});

test('720 seeded deals clear every formation under both editions without changing draw inventory', () => {
  const catalogueBefore = JSON.stringify(FORMATIONS);
  for (const ruleset of ['eastern', 'western']) {
    for (let seed = 0; seed < 30; seed += 1) {
      const reference = createGame(ruleset, seed);
      for (const formationId of FORMATION_IDS) {
        const game = createGame(ruleset, seed, 'balanced', 'ming-porcelain', { formationId });
        assert.equal(game.formationId, formationId);
        assert.deepEqual(positions(game.tiles), positions(getFormation(formationId).slots));
        assert.deepEqual(inventory(game.tiles), inventory(reference.tiles), 'formation choice leaves every draw and copy unchanged');
        assert.deepEqual(game, createGame(ruleset, seed, 'balanced', 'ming-porcelain', { formationId }));
        clearDeal(game.tiles, game.solution);
      }
    }
  }
  assert.equal(JSON.stringify(FORMATIONS), catalogueBefore, 'deals do not mutate the shared catalogue');
});

test('120 partial-board shuffles retain surviving identities, removed tiles and a complete legal solution', () => {
  for (const formationId of FORMATION_IDS) {
    for (let seed = 0; seed < 10; seed += 1) {
      let { tiles } = createGame(seed % 2 ? 'eastern' : 'western', seed, 'balanced', 'ming-porcelain', { formationId });
      for (let move = 0; move < 17; move += 1) {
        const pairs = getAvailablePairs(tiles);
        if (!pairs.length) break;
        const pair = pairs[(seed * 11 + move * 7) % pairs.length];
        tiles = removePair(tiles, pair[0].id, pair[1].id);
      }
      const before = structuredClone(tiles);
      const shuffled = shuffleBoard(tiles, seed + 2000, { formationId });
      assert.deepEqual(tiles, before, 'input tiles remain immutable');
      assert.deepEqual(inventory(shuffled.tiles), inventory(tiles));
      for (const removed of tiles.filter(tile => tile.removed)) {
        assert.strictEqual(shuffled.tiles.find(tile => tile.id === removed.id), removed);
      }
      if (!shuffled.reflowed) {
        assert.deepEqual(positions(shuffled.tiles.filter(tile => !tile.removed)), positions(tiles.filter(tile => !tile.removed)));
      }
      assert.deepEqual(shuffled, shuffleBoard(tiles, seed + 2000, { formationId }));
      clearDeal(shuffled.tiles, shuffled.solution);
    }
  }
});

test('a deadlocked surviving stack can reflow into every selected formation', () => {
  const tiles = [
    { id: 'a', faceId: 'one', matchKey: 'one', x: 0, y: 0, z: 0, removed: false },
    { id: 'b', faceId: 'one', matchKey: 'one', x: 0, y: 0, z: 1, removed: false },
  ];
  for (const formationId of FORMATION_IDS) {
    const result = shuffleBoard(tiles, 42, { formationId });
    assert.equal(result.reflowed, true);
    const allowed = new Set(positions(getFormation(formationId).slots));
    assert.ok(positions(result.tiles).every(position => allowed.has(position)));
    assert.deepEqual(inventory(result.tiles), inventory(tiles));
    clearDeal(result.tiles, result.solution);
  }
});

test('seeded formation selection supports only excluding the preceding layout without a hidden history bag', () => {
  const seen = new Set();
  let last;
  for (let seed = 0; seed < 300; seed += 1) {
    const next = chooseFormationId(seed, { excludeIds: last ? [last] : [] });
    assert.ok(FORMATION_IDS.includes(next));
    assert.notEqual(next, last);
    assert.equal(next, chooseFormationId(seed, { excludeIds: last ? [last] : [] }));
    seen.add(next);
    last = next;
  }
  assert.equal(seen.size, FORMATIONS.length);
  for (const formationId of FORMATION_IDS) {
    assert.equal(chooseFormationId(12, { excludeIds: FORMATION_IDS.filter(id => id !== formationId) }), formationId);
  }
  assert.equal(createGame('eastern', 555).formationId, chooseFormationId(555));
  assert.throws(() => chooseFormationId(NaN), /finite integer/);
  assert.throws(() => chooseFormationId(1.5), /finite integer/);
  assert.throws(() => chooseFormationId(1, { excludeIds: 'crown' }), /array/);
  assert.throws(() => chooseFormationId(1, { excludeIds: FORMATION_IDS }), /remain available/);
  assert.throws(() => getFormation('toString'), /Unknown formation/);
  assert.throws(() => createGame('eastern', 1, 'balanced', 'ming-porcelain', { formationId: 'unknown' }), /Unknown formation/);
  assert.throws(() => createGame('eastern', 1, 'balanced', 'ming-porcelain', null), /options must be an object/);
  assert.throws(() => shuffleBoard([], 1, { formationId: 'unknown' }), /Unknown formation/);
});

test('custom sixty-tile geometry validates and shuffles in place without a formation ID', () => {
  const customSlots = [
    ...Array.from({ length: 36 }, (_, index) => ({ x: index % 6, y: Math.floor(index / 6), z: 0 })),
    ...Array.from({ length: 20 }, (_, index) => ({ x: 1 + index % 4, y: .5 + Math.floor(index / 4), z: 1 })),
    ...Array.from({ length: 4 }, (_, index) => ({ x: 2 + index % 2, y: 2 + Math.floor(index / 2), z: 2 })),
  ];
  const { formationId: unused, ...saved } = createGame('eastern', 14);
  assert.equal(customSlots.length, TILES_PER_DUEL);
  saved.tiles = saved.tiles.map((tile, index) => ({ ...tile, ...customSlots[index] }));
  assert.equal(isCurrentCatalogueDeal(saved), true);
  const result = shuffleBoard(saved.tiles, 56);
  assert.equal(result.reflowed, false);
  assert.deepEqual(positions(result.tiles), positions(saved.tiles));
  assert.deepEqual(inventory(result.tiles), inventory(saved.tiles));
  clearDeal(result.tiles, result.solution);
});
