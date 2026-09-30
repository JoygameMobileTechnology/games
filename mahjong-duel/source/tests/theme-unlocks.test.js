import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollection, normalizeCollection, saveCollection, loadCollection } from '../src/collection.js';
import { rarityForTile } from '../src/rarity.js';
import { themeTileSets } from '../src/tile-data.js';
import { launchThemeIds } from '../src/themes.js';
import { choosePlayableTheme, getThemeProgress, getThemeUnlocks } from '../src/theme-unlocks.js';

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

function fillTypes(collection, themeId, edition, targets, count = 3) {
  const counts = { ...collection.counts };
  for (const [rarity, target] of Object.entries(targets)) {
    const tiles = themeTileSets[themeId][edition].filter(tile => rarityForTile(themeId, edition, tile.id).id === rarity);
    tiles.slice(0, target).forEach(tile => { counts[tile.matchKey] = count; });
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
      { themeId: ming, rarityId: 'marble', requiredTypes: 14, matchesPerType: 3 },
      { themeId: ming, rarityId: 'sapphire', requiredTypes: 7, matchesPerType: 3 },
    ]);
    assert.deepEqual(unlocks[1].requirements.map(goal => goal.availableTypes), [22, 10]);
    assert.deepEqual(unlocks[2].requirements.map(goal => goal.requiredTypes), [18, 8, 5, 3]);
    assert.deepEqual(unlocks[3].requirements.map(goal => goal.requiredTypes), [22, 10, 5, 3]);
    assert.equal(unlocks[2].requirements.flatMap(requirement => requirement.tiles).length, 40);
  }
});

test('Dancheong needs any 14 Marble and 7 Sapphire artworks at three matches each', () => {
  for (const edition of ['eastern', 'western']) {
    const completed = fillTypes(createCollection(), ming, edition, { marble: 14, sapphire: 7 });
    const missingKey = getThemeUnlocks(completed, edition)[1].requirements[1].tiles[0].matchKey;
    const excessKey = getThemeUnlocks(completed, edition)[1].requirements[0].tiles[0].matchKey;
    const short = { ...completed, counts: { ...completed.counts, [missingKey]: 2, [excessKey]: 3000 } };
    assert.deepEqual(states(short, edition), [true, false, false, false]);
    assert.equal(getThemeUnlocks(short, edition)[1].requirements[1].completedTypes, 6);
    assert.deepEqual(states(completed, edition), [true, true, false, false]);
    assert.equal(getThemeUnlocks(completed, edition)[2].nextToUnlock, true);
    for (const goal of getThemeUnlocks(completed, edition)[1].requirements) {
      for (const tile of goal.tiles.filter(tile => tile.complete)) {
        const missing = { ...completed, counts: { ...completed.counts, [tile.matchKey]: 2 } };
        assert.equal(getThemeUnlocks(missing, edition)[1].unlocked, false);
      }
    }
    const alternate = { ...completed, counts: { ...completed.counts, [missingKey]: 0 } };
    const spare = getThemeUnlocks(completed, edition)[1].requirements[1].tiles.find(tile => !tile.complete);
    alternate.counts[spare.matchKey] = 3;
    assert.equal(getThemeUnlocks(alternate, edition)[1].unlocked, true, 'any seven Sapphire artworks qualify');
    assert.equal(getThemeUnlocks(fill(completed, ming, edition, low, 3), edition)[1].unlocked, true, 'surpassing quotas remains unlocked');
  }
});

test('Stained Glass requires Dancheong low rarities and two matches of every Ming high rarity', () => {
  for (const edition of ['eastern', 'western']) {
    let collection = fillTypes(createCollection(), ming, edition, { marble: 14, sapphire: 7 });
    collection = fillTypes(collection, dancheong, edition, { marble: 18, sapphire: 8 });
    assert.deepEqual(states(collection, edition), [true, true, false, false]);
    collection = fill(collection, ming, edition, high, 1);
    assert.deepEqual(states(collection, edition), [true, true, false, false]);
    const completed = fill(collection, ming, edition, high, 2);
    for (const requirement of getThemeUnlocks(completed, edition)[2].requirements.slice(0, 2)) {
      for (const tile of requirement.tiles.filter(tile => tile.complete)) {
        const missing = { ...completed, counts: { ...completed.counts, [tile.matchKey]: 2 } };
        assert.equal(getThemeUnlocks(missing, edition)[2].unlocked, false);
      }
    }
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
    for (const goal of getThemeUnlocks(collection, edition)[3].requirements) {
      for (const tile of goal.tiles) {
        const missing = { ...collection, counts: { ...collection.counts, [tile.matchKey]: goal.matchesPerType - 1 } };
        assert.equal(getThemeUnlocks(missing, edition)[3].unlocked, false);
      }
    }
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

test('partial copies advance quota bars before an artwork is ready, capped at the best required types', () => {
  for (const edition of ['eastern', 'western']) {
    let collection = createCollection();
    const key = getThemeUnlocks(collection, edition)[1].requirements[0].tiles[0].matchKey;
    for (const count of [1, 2, 3, 1000]) {
      collection = { ...collection, counts: { [key]: count } };
      const state = getThemeUnlocks(collection, edition)[1], progress = getThemeProgress(state);
      assert.equal(progress.completedMatches, Math.min(3, count));
      assert.equal(progress.requiredMatches, 63);
      assert.equal(progress.completedTypes, Number(count >= 3));
      assert.equal(progress.requiredTypes, 21);
      assert.equal(progress.percent, Math.floor(100 * Math.min(3, count) / 63));
      assert.equal(progress.complete, false);
    }
    collection = fill(createCollection(), ming, edition, low, 2);
    const partial = getThemeUnlocks(collection, edition)[1];
    assert.deepEqual(partial.requirements.map(goal => goal.completedMatches), [28, 14]);
    assert.equal(getThemeProgress(partial).percent, 66);
    assert.equal(getThemeProgress(partial).completedTypes, 0);
    const allReady = fillTypes(collection, ming, edition, { marble: 14, sapphire: 7 });
    assert.deepEqual(getThemeProgress(getThemeUnlocks(allReady, edition)[1]), {
      completedTypes: 21, requiredTypes: 21, completedMatches: 63, requiredMatches: 63, percent: 100, complete: true,
    });
    const excess = fill(allReady, ming, edition, low, 1000);
    assert.deepEqual(getThemeProgress(getThemeUnlocks(excess, edition)[1]), getThemeProgress(getThemeUnlocks(allReady, edition)[1]));
  }
});

test('only improvements among the best quota artworks contribute to match progress', () => {
  for (const edition of ['eastern', 'western']) {
    const before = fillTypes(createCollection(), ming, edition, { marble: 14, sapphire: 7 }, 2);
    const state = getThemeUnlocks(before, edition)[1];
    const outside = state.requirements[0].tiles.find(tile => tile.count === 0).matchKey;
    const collection = { ...before, counts: { ...before.counts, [outside]: 1 } };
    assert.equal(getThemeProgress(getThemeUnlocks(collection, edition)[1]).completedMatches,
      getThemeProgress(state).completedMatches, 'a lower-ranked partial artwork does not inflate the quota');
    collection.counts[outside] = 3;
    assert.equal(getThemeProgress(getThemeUnlocks(collection, edition)[1]).completedMatches,
      getThemeProgress(state).completedMatches + 1, 'a ready artwork replaces a two-copy artwork in the best quota');
  }
});

test('100 percent always represents a real unlock, including prerequisite and edition guards', () => {
  for (const edition of ['eastern', 'western']) {
    let collection = fill(createCollection(), stained, edition, low, 3);
    collection = fill(collection, dancheong, edition, high, 2);
    const blocked = getThemeUnlocks(collection, edition)[3];
    const blockedProgress = getThemeProgress(blocked);
    assert.equal(blockedProgress.completedMatches, blockedProgress.requiredMatches);
    assert.equal(blockedProgress.percent, 99);
    assert.equal(blockedProgress.complete, false);
    collection = fillTypes(collection, ming, edition, { marble: 14, sapphire: 7 });
    collection = fillTypes(collection, dancheong, edition, { marble: 18, sapphire: 8 });
    collection = fill(collection, ming, edition, high, 2);
    for (const state of getThemeUnlocks(collection, edition)) {
      assert.equal(getThemeProgress(state).percent === 100, state.unlocked);
    }
    const other = edition === 'eastern' ? 'western' : 'eastern';
    for (const state of getThemeUnlocks(collection, other).slice(1)) {
      assert.equal(getThemeProgress(state).completedMatches, 0);
      assert.equal(getThemeProgress(state).percent, 0);
    }
  }
  assert.equal(getThemeProgress(null).percent, 0);
});

test('malformed counts never complete requirements and evaluation does not mutate saved data', () => {
  const collection = fillTypes(createCollection(), ming, 'eastern', { marble: 14, sapphire: 7 });
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
