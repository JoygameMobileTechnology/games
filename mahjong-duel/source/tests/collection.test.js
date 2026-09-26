import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTION_STORAGE_KEY, createCollection, collectionPairId, collectionCount,
  collectionStats, awardCollectedPair, normalizeCollection, loadCollection, saveCollection,
} from '../src/collection.js';

const key = 'ming-porcelain:eastern:K01';
const award = (extra = {}) => ({ gameId: 'round-1', pairId: ['tile-1', 'tile-2'], matchKey: key, actor: 'you', ...extra });
const storage = () => {
  const values = new Map([['unrelated', 'keep me']]);
  return { values, getItem: name => values.get(name) ?? null, setItem: (name, value) => values.set(name, value) };
};

test('only a successful player award adds one matched pair, without mutating the old collection', () => {
  const previous = Object.freeze({ ...createCollection(), counts: Object.freeze({}), receipts: Object.freeze({}) });
  const next = awardCollectedPair(previous, award());
  assert.notStrictEqual(next, previous);
  assert.equal(collectionCount(next, key), 1);
  assert.deepEqual(previous, createCollection());
  assert.deepEqual(collectionStats(next), { unique: 1, totalMatches: 1, totalTiles: 320 });
  assert.strictEqual(awardCollectedPair(next, award({ actor: 'ai', pairId: ['tile-3', 'tile-4'] })), next);
});

test('duplicate matches increase pair counts, but replaying a physical pair is idempotent', () => {
  let value = awardCollectedPair(createCollection(), award());
  assert.strictEqual(awardCollectedPair(value, award()), value);
  assert.strictEqual(awardCollectedPair(value, award({ pairId: ['tile-2', 'tile-1'] })), value);
  assert.strictEqual(awardCollectedPair(value, award({ matchKey: 'ming-porcelain:eastern:K02' })), value);
  value = awardCollectedPair(value, award({ pairId: ['tile-3', 'tile-4'] }));
  value = awardCollectedPair(value, award({ gameId: 'round-2' }));
  assert.equal(collectionCount(value, key), 3);
  assert.deepEqual(collectionStats(value), { unique: 1, totalMatches: 3, totalTiles: 320 });
});

test('persistence keeps the replay receipt and count atomic through reloads', () => {
  const target = storage();
  const original = awardCollectedPair(createCollection(), award());
  assert.equal(saveCollection(original, target), true);
  assert.equal(target.values.get('unrelated'), 'keep me');
  assert.equal(target.values.size, 2);
  const reloaded = loadCollection(target);
  assert.deepEqual(reloaded, original);
  assert.strictEqual(awardCollectedPair(reloaded, award()), reloaded);
  assert.equal(collectionCount(reloaded, key), 1);
});

test('theme and ruleset identities remain distinct even when local IDs are alike', () => {
  let value = createCollection();
  for (const [index, matchKey] of [key, 'dancheong:eastern:K01', 'ming-porcelain:western:W01'].entries()) {
    value = awardCollectedPair(value, award({ gameId: `round-${index}`, matchKey }));
  }
  assert.deepEqual(collectionStats(value), { unique: 3, totalMatches: 3, totalTiles: 320 });
  assert.deepEqual(collectionStats(value, { themeId: 'ming-porcelain', ruleset: 'eastern' }), { unique: 1, totalMatches: 1, totalTiles: 40 });
  assert.deepEqual(collectionStats(value, { themeId: 'ming-porcelain' }), { unique: 2, totalMatches: 2, totalTiles: 80 });
  assert.deepEqual(collectionStats(value, { ruleset: 'western' }), { unique: 1, totalMatches: 1, totalTiles: 160 });
});

test('invalid awards, unknown faces, empty identities and missing actors are exact no-ops', () => {
  const value = createCollection();
  for (const details of [undefined, {}, award({ actor: undefined }), award({ actor: 'ghost' }), award({ gameId: '' }),
    award({ pairId: null }), award({ pairId: ['tile-1', 'tile-1'] }), award({ pairId: ['tile-1'] }),
    award({ matchKey: 'ming-porcelain:eastern:F01' })]) {
    assert.strictEqual(awardCollectedPair(value, details), value);
  }
  assert.equal(collectionPairId(['b', 'a']), collectionPairId(['a', 'b']));
  assert.equal(collectionPairId(['a', 'a']), null);
  assert.equal(collectionCount(value, 'unknown'), 0);
});

test('malformed storage is recoverable and invalid inventory is not admitted', () => {
  const target = storage();
  assert.deepEqual(loadCollection(target), createCollection());
  for (const raw of ['not json', 'null', '[]', JSON.stringify({ version: 999, counts: { [key]: 1 } })]) {
    target.setItem(COLLECTION_STORAGE_KEY, raw);
    assert.deepEqual(loadCollection(target), createCollection());
  }
  const receipt = JSON.stringify(['round-1', collectionPairId(['tile-1', 'tile-2'])]);
  assert.deepEqual(normalizeCollection({ version: 1, counts: { [key]: 3, missing: 9, 'ming-porcelain:eastern:K02': -1, 'ming-porcelain:eastern:K03': 1.5 }, receipts: { [receipt]: key, invalid: key } }),
    { version: 1, counts: { [key]: 3 }, receipts: { [receipt]: key } });
  const blocked = { getItem() { throw new Error('unavailable'); }, setItem() { throw new Error('full'); } };
  assert.deepEqual(loadCollection(blocked), createCollection());
  assert.equal(saveCollection(createCollection(), blocked), false);
});


test('later-theme progress survives reload while launch binder totals hide it', () => {
  const laterKey = 'neon-shrine:western:W01';
  const value = awardCollectedPair(createCollection(), award({ matchKey: laterKey }));
  const target = storage();
  assert.equal(saveCollection(value, target), true);
  const restored = loadCollection(target);
  assert.equal(collectionCount(restored, laterKey), 1);
  assert.deepEqual(collectionStats(restored), { unique: 0, totalMatches: 0, totalTiles: 320 });
  assert.deepEqual(collectionStats(restored, { themeId: 'neon-shrine' }), { unique: 0, totalMatches: 0, totalTiles: 0 });
  assert.deepEqual(restored, value);
});
