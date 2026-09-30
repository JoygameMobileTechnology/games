import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollection, normalizeCollection, saveCollection, loadCollection } from '../src/collection.js';
import { rarityForTile } from '../src/rarity.js';
import { themeTileSets } from '../src/tile-data.js';
import { launchThemeIds } from '../src/themes.js';
import { choosePlayableTheme, getThemeUnlocks } from '../src/theme-unlocks.js';

const [ming, dancheong, stained, dutch] = launchThemeIds;
const low = ['marble', 'sapphire'];
const high = ['amethyst', 'gold'];
const states = (collection, edition = 'eastern') => getThemeUnlocks(collection, edition).map(theme => theme.unlocked);

function fill(collection, themeId, edition, rarities, count) {
  const counts = { ...collection.counts };
  for (const tile of themeTileSets[themeId][edition]) {
    if (rarities.includes(rarityForTile(themeId, edition, tile.id).id)) counts[tile.matchKey] = count;
  }
  return { ...collection, counts };
}

test('new collections start with Ming only and identify exactly one next theme', () => {
  for (const edition of ['eastern', 'western']) {
    const unlocks = getThemeUnlocks(createCollection(), edition);
    assert.deepEqual(unlocks.map(theme => theme.themeId), launchThemeIds);
    assert.deepEqual(unlocks.map(theme => theme.unlocked), [true, false, false, false]);
    assert.deepEqual(unlocks.map(theme => theme.nextToUnlock), [false, true, false, false]);
    assert.deepEqual(unlocks[0].requirements, []);
    assert.deepEqual(unlocks[1].requirements.map(({ themeId, rarityId, requiredTypes, matchesPerType }) =>
      ({ themeId, rarityId, requiredTypes, matchesPerType })), [
      { themeId: ming, rarityId: 'marble', requiredTypes: 22, matchesPerType: 3 },
      { themeId: ming, rarityId: 'sapphire', requiredTypes: 10, matchesPerType: 3 },
    ]);
    assert.equal(unlocks[2].requirements.flatMap(requirement => requirement.tiles).length, 40);
  }
});

test('each Marble and Sapphire artwork needs three player matches, not a pooled count', () => {
  for (const edition of ['eastern', 'western']) {
    const completed = fill(createCollection(), ming, edition, low, 3);
    const missingKey = getThemeUnlocks(completed, edition)[1].requirements[1].tiles[0].matchKey;
    const excessKey = getThemeUnlocks(completed, edition)[1].requirements[0].tiles[0].matchKey;
    const short = { ...completed, counts: { ...completed.counts, [missingKey]: 2, [excessKey]: 3000 } };
    assert.deepEqual(states(short, edition), [true, false, false, false]);
    assert.equal(getThemeUnlocks(short, edition)[1].requirements[1].completedTypes, 9);
    assert.deepEqual(states(completed, edition), [true, true, false, false]);
    assert.equal(getThemeUnlocks(completed, edition)[2].nextToUnlock, true);
  }
});

test('Stained Glass requires Dancheong low rarities and two matches of every Ming high rarity', () => {
  for (const edition of ['eastern', 'western']) {
    let collection = fill(createCollection(), ming, edition, low, 3);
    collection = fill(collection, dancheong, edition, low, 3);
    assert.deepEqual(states(collection, edition), [true, true, false, false]);
    collection = fill(collection, ming, edition, high, 1);
    assert.deepEqual(states(collection, edition), [true, true, false, false]);
    const completed = fill(collection, ming, edition, high, 2);
    for (const requirement of getThemeUnlocks(completed, edition)[2].requirements.slice(2)) {
      assert.equal(requirement.matchesPerType, 2);
      for (const tile of requirement.tiles) {
        const missing = { ...completed, counts: { ...completed.counts, [tile.matchKey]: 1 } };
        assert.equal(getThemeUnlocks(missing, edition)[2].unlocked, false);
      }
    }
    assert.deepEqual(states(completed, edition), [true, true, true, false]);
  }
});

test('Dutch follows the same chain and old later-theme matches cannot bypass earlier locks', () => {
  for (const edition of ['eastern', 'western']) {
    let collection = fill(createCollection(), stained, edition, low, 3);
    collection = fill(collection, dancheong, edition, high, 2);
    assert.deepEqual(states(collection, edition), [true, false, false, false]);
    collection = fill(collection, ming, edition, low, 3);
    assert.deepEqual(states(collection, edition), [true, true, false, false]);
    collection = fill(collection, dancheong, edition, low, 3);
    collection = fill(collection, ming, edition, high, 2);
    assert.deepEqual(states(collection, edition), [true, true, true, true]);
    assert.equal(getThemeUnlocks(collection, edition).some(theme => theme.nextToUnlock), false);
    assert.deepEqual(getThemeUnlocks(collection, edition)[3].requirements.map(requirement =>
      [requirement.themeId, requirement.rarityId, requirement.matchesPerType]), [
      [stained, 'marble', 3], [stained, 'sapphire', 3],
      [dancheong, 'amethyst', 2], [dancheong, 'gold', 2],
    ]);
  }
});

test('Eastern and Western progress are independent and survive the existing collection storage', () => {
  let collection = fill(createCollection(), ming, 'eastern', low, 3);
  collection = fill(collection, ming, 'western', low, 2);
  collection = fill(collection, 'neon-shrine', 'western', high, 8);
  assert.deepEqual(states(collection, 'eastern'), [true, true, false, false]);
  assert.deepEqual(states(collection, 'western'), [true, false, false, false]);
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(saveCollection(collection, storage), true);
  assert.equal(values.size, 1);
  const restored = loadCollection(storage);
  assert.deepEqual(restored, collection);
  assert.deepEqual(getThemeUnlocks(restored, 'eastern'), getThemeUnlocks(collection, 'eastern'));
  assert.deepEqual(getThemeUnlocks(restored, 'western'), getThemeUnlocks(collection, 'western'));
  collection = fill(restored, ming, 'western', low, 3);
  assert.deepEqual(states(collection, 'western'), [true, true, false, false]);
  assert.deepEqual(states(collection, 'eastern'), [true, true, false, false]);
});

test('malformed counts never complete requirements and evaluation does not mutate saved data', () => {
  const collection = fill(createCollection(), ming, 'eastern', low, 3);
  const key = getThemeUnlocks(collection)[1].requirements[0].tiles[0].matchKey;
  for (const invalid of ['3', -1, 2.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const corrupt = { ...collection, counts: { ...collection.counts, [key]: invalid } };
    assert.deepEqual(states(corrupt), [true, false, false, false]);
    assert.deepEqual(states(normalizeCollection(corrupt)), [true, false, false, false]);
  }
  const before = structuredClone(collection);
  Object.freeze(collection.counts);
  Object.freeze(collection);
  const result = getThemeUnlocks(collection);
  assert.deepEqual(collection, before);
  result[1].requirements[0].tiles[0].count = 0;
  assert.equal(getThemeUnlocks(collection)[1].unlocked, true);
  assert.deepEqual(states(null), [true, false, false, false]);
  assert.deepEqual(getThemeUnlocks(collection, 'invalid'), getThemeUnlocks(collection, 'eastern'));
});

test('deal guard rejects locked and unreleased themes, and random picks only unlocked launch themes', () => {
  const empty = createCollection();
  for (const id of [dancheong, stained, dutch, 'neon-shrine', '', undefined]) {
    assert.equal(choosePlayableTheme(empty, 'eastern', id), null);
  }
  assert.equal(choosePlayableTheme(empty, 'eastern', ming), ming);
  for (const draw of [0, 0.25, 0.99, 1, -1, Infinity, NaN]) {
    assert.equal(choosePlayableTheme(empty, 'eastern', 'random', () => draw), ming);
  }
  const secondOpen = fill(empty, ming, 'eastern', low, 3);
  assert.equal(choosePlayableTheme(secondOpen, 'eastern', dancheong), dancheong);
  assert.equal(choosePlayableTheme(secondOpen, 'western', dancheong), null);
  const selected = new Set(Array.from({ length: 100 }, (_, index) =>
    choosePlayableTheme(secondOpen, 'eastern', 'random', () => index / 99)));
  assert.deepEqual([...selected], [ming, dancheong]);
  let complete = secondOpen;
  for (const id of [ming, dancheong, stained]) complete = fill(complete, id, 'eastern', [...low, ...high], 3);
  assert.deepEqual(Array.from({ length: 4 }, (_, index) =>
    choosePlayableTheme(complete, 'eastern', 'random', () => index / 4)), launchThemeIds);
  assert.equal(choosePlayableTheme(complete, 'eastern', 'random', () => 1), dutch);
});
