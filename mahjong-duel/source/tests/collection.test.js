import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTION_STORAGE_KEY, COLLECTION_MIGRATION_BACKUP_KEY, COLLECTION_VERSION, createCollection, collectionPairId, collectionCount,
  collectionStats, awardCollectedPair, normalizeCollection, mergeCollections, loadCollection, saveCollection,
} from '../src/collection.js';
import { themeTileSets } from '../src/tile-data.js';
import { RARITIES, rarityForTile } from '../src/rarity.js';
import { launchThemeIds, rulesetForTheme } from '../src/themes.js';

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
  assert.deepEqual(collectionStats(next), { unique: 1, totalMatches: 1, totalTiles: 160 });
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
  assert.deepEqual(collectionStats(value), { unique: 1, totalMatches: 3, totalTiles: 160 });
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

test('the live binder counts only each theme’s canonical edition; archived identities remain readable', () => {
  let value = createCollection();
  for (const [index, matchKey] of [key, 'dancheong:eastern:K01', 'ming-porcelain:western:W01'].entries()) {
    value = awardCollectedPair(value, award({ gameId: `round-${index}`, matchKey }));
  }
  assert.deepEqual(collectionStats(value), { unique: 2, totalMatches: 2, totalTiles: 160 });
  assert.equal(collectionCount(value, 'ming-porcelain:western:W01'), 1);
  assert.deepEqual(collectionStats(value, { themeId: 'ming-porcelain', ruleset: 'eastern' }), { unique: 1, totalMatches: 1, totalTiles: 40 });
  assert.deepEqual(collectionStats(value, { themeId: 'ming-porcelain' }), { unique: 1, totalMatches: 1, totalTiles: 40 });
  assert.deepEqual(collectionStats(value, { ruleset: 'western' }), { unique: 0, totalMatches: 0, totalTiles: 80 });
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
    { ...createCollection(), counts: { [key]: 3 }, receipts: { [receipt]: key } });
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
  assert.deepEqual(collectionStats(restored), { unique: 0, totalMatches: 0, totalTiles: 160 });
  assert.deepEqual(collectionStats(restored, { themeId: 'neon-shrine' }), { unique: 0, totalMatches: 0, totalTiles: 0 });
  assert.deepEqual(restored, value);
});


function rarityTiles(themeId, ruleset, rarityId) {
  return themeTileSets[themeId][ruleset]
    .filter(tile => rarityForTile(themeId, ruleset, tile.id).id === rarityId)
    .sort((a, b) => a.id.localeCompare(b.id));
}

test('old editions transfer copies once within the same theme and rarity while preserving raw history', () => {
  const counts = {}, expected = {};
  for (const themeId of launchThemeIds) {
    const canonical = rulesetForTheme(themeId), archived = canonical === 'eastern' ? 'western' : 'eastern';
    for (const { id: rarityId } of RARITIES) {
      const source = rarityTiles(themeId, archived, rarityId), target = rarityTiles(themeId, canonical, rarityId);
      assert.equal(source.length, target.length);
      source.forEach((tile, index) => {
        counts[tile.matchKey] = index + 1;
        counts[target[index].matchKey] = 2;
        expected[target[index].matchKey] = index + 3;
      });
    }
  }
  const oldKey = rarityTiles('ming-porcelain', 'western', 'gold')[0].matchKey;
  const receipt = JSON.stringify(['old-match', collectionPairId(['old-a', 'old-b'])]);
  const old = { version: 1, counts, receipts: { [receipt]: oldKey } }, before = structuredClone(old);
  const migrated = normalizeCollection(old);
  assert.equal(migrated.version, COLLECTION_VERSION);
  assert.deepEqual(old, before, 'normalizing must not mutate the old save');
  for (const [matchKey, count] of Object.entries(expected)) assert.equal(migrated.counts[matchKey], count);
  for (const [matchKey, count] of Object.entries(counts).filter(([id]) => !Object.hasOwn(expected, id))) {
    assert.equal(migrated.counts[matchKey], count, 'archived counts remain available for recovery');
  }
  assert.deepEqual(migrated.receipts, old.receipts);
  assert.strictEqual(awardCollectedPair(migrated, { gameId: 'old-match', pairId: ['old-a', 'old-b'], matchKey: oldKey, actor: 'you' }), migrated);
  assert.deepEqual(normalizeCollection(migrated), migrated, 'the version prevents repeated conversion');
  const target = storage();
  assert.equal(saveCollection(migrated, target), true);
  assert.deepEqual(loadCollection(target), migrated, 'reloading must not add archived counts a second time');
  assert.equal(collectionStats(migrated).totalMatches, Object.values(expected).reduce((sum, count) => sum + count, 0));
});

test('loading an old collection keeps one exact backup and tolerates unavailable backup writes', () => {
  const target = storage();
  const old = { version: 1, counts: { 'ming-porcelain:western:W01': 4 }, receipts: {} };
  const raw = JSON.stringify(old);
  target.setItem(COLLECTION_STORAGE_KEY, raw);
  const migrated = loadCollection(target);
  assert.equal(target.getItem(COLLECTION_MIGRATION_BACKUP_KEY), raw);
  target.setItem(COLLECTION_STORAGE_KEY, JSON.stringify({ ...old, counts: { [key]: 5 } }));
  loadCollection(target);
  assert.equal(target.getItem(COLLECTION_MIGRATION_BACKUP_KEY), raw, 'first untouched save is never overwritten');
  const blocked = { getItem: name => name === COLLECTION_STORAGE_KEY ? raw : null, setItem() { throw new Error('full'); } };
  assert.deepEqual(loadCollection(blocked), migrated);
});

test('retained theme access survives normalization and future pair awards', () => {
  const collection = normalizeCollection({ ...createCollection(), retainedThemeIds: ['dutch-golden-age', 'invalid'] });
  assert.deepEqual(collection.retainedThemeIds, launchThemeIds, 'retained access includes its prerequisite chain');
  assert.deepEqual(awardCollectedPair(collection, award()).retainedThemeIds, launchThemeIds);
  assert.deepEqual(normalizeCollection({ ...collection, retainedThemeIds: 'invalid' }).retainedThemeIds, []);
});

test('envelope and mirror merge native and transferred copies independently without replay inflation', () => {
  const canonical = rarityTiles('ming-porcelain', 'eastern', 'gold')[0].matchKey;
  const archived = rarityTiles('ming-porcelain', 'western', 'gold')[0].matchKey;
  const native = { version: 1, counts: { [canonical]: 3 }, receipts: {} };
  const alternative = { version: 1, counts: { [archived]: 4 }, receipts: {} };
  for (const first of [native, normalizeCollection(native)]) {
    for (const second of [alternative, normalizeCollection(alternative)]) {
      const result = mergeCollections(first, second);
      assert.equal(collectionCount(result, canonical), 7, 'complementary credits survive raw and preloaded saves');
      assert.equal(collectionCount(result, archived), 4);
      assert.deepEqual(mergeCollections(result, second), result, 'replaying a stale mirror never adds copies');
      assert.deepEqual(mergeCollections(result, result), result, 'the saved mirror and envelope can be identical');
    }
  }
  const current = { version: 2, counts: { [canonical]: 10, [archived]: 5 }, receipts: {}, retainedThemeIds: [] };
  const newerOldEdition = { version: 1, counts: { [archived]: 7 }, receipts: {} };
  const result = mergeCollections(current, newerOldEdition);
  assert.equal(collectionCount(result, canonical), 12, 'five native copies combine with seven archived copies');
  assert.deepEqual(mergeCollections(result, newerOldEdition), result);
  assert.deepEqual(mergeCollections(result, current), result);
  assert.deepEqual(mergeCollections(current, null), normalizeCollection(current), 'already-persisted version2 credit remains unchanged');
});

test('merged collection ledgers preserve receipts and access while bounding malformed credit', () => {
  const canonical = rarityTiles('ming-porcelain', 'eastern', 'gold')[0].matchKey;
  const archived = rarityTiles('ming-porcelain', 'western', 'gold')[0].matchKey;
  const firstReceipt = JSON.stringify(['native-round', collectionPairId(['a', 'b'])]);
  const secondReceipt = JSON.stringify(['old-round', collectionPairId(['c', 'd'])]);
  const first = { ...createCollection(), counts: { [canonical]: 2 }, receipts: { [firstReceipt]: canonical }, retainedThemeIds: ['ming-porcelain'] };
  const second = { version: 2, counts: { [canonical]: 1, [archived]: 4 }, receipts: { [secondReceipt]: archived }, retainedThemeIds: ['stained-glass'] };
  const result = mergeCollections(first, second);
  assert.equal(collectionCount(result, canonical), 3, 'only credit already present in a version2 save is merged');
  assert.equal(collectionCount(result, archived), 4);
  assert.equal(result.editionCredits[archived], 1);
  assert.deepEqual(mergeCollections(result, first), result, 'partial credit remains stable when reloading either source');
  assert.deepEqual(mergeCollections(result, second), result);
  assert.deepEqual(mergeCollections(result, result), result);
  assert.deepEqual(result.receipts, { [secondReceipt]: archived, [firstReceipt]: canonical });
  assert.deepEqual(result.retainedThemeIds, launchThemeIds.slice(0, 3));
  const saturated = mergeCollections({ ...createCollection(), counts: { [canonical]: Number.MAX_SAFE_INTEGER } },
    { version: 1, counts: { [archived]: 5 }, receipts: {} });
  assert.equal(collectionCount(saturated, canonical), Number.MAX_SAFE_INTEGER);
});
