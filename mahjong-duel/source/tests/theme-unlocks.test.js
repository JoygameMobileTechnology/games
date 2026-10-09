import test from 'node:test';
import assert from 'node:assert/strict';
import { createCollection, normalizeCollection, saveCollection, loadCollection } from '../src/collection.js';
import { rarityForTile } from '../src/rarity.js';
import { themeTileSets } from '../src/tile-data.js';
import { launchThemeIds, rulesetForTheme } from '../src/themes.js';
import { choosePlayableTheme, getThemeProgress, getThemeUnlocks } from '../src/theme-unlocks.js';

const [ming, dancheong, stained, dutch] = launchThemeIds;
const low = ['marble', 'sapphire'], high = ['amethyst', 'gold'];
const states = collection => getThemeUnlocks(collection).map(theme => theme.unlocked);

function fill(collection, themeId, rarities, count, edition = rulesetForTheme(themeId)) {
  const counts = { ...collection.counts };
  for (const tile of themeTileSets[themeId][edition]) {
    if (rarities.includes(rarityForTile(themeId, edition, tile.id).id)) counts[tile.matchKey] = count;
  }
  return { ...collection, counts };
}

function fillTypes(collection, themeId, targets, count = 3, edition = rulesetForTheme(themeId)) {
  const counts = { ...collection.counts };
  for (const [rarity, target] of Object.entries(targets)) {
    const tiles = themeTileSets[themeId][edition].filter(tile => rarityForTile(themeId, edition, tile.id).id === rarity);
    tiles.slice(0, target).forEach(tile => { counts[tile.matchKey] = count; });
  }
  return { ...collection, counts };
}

function unlockStained(collection = createCollection()) {
  collection = fillTypes(collection, ming, { marble: 14, sapphire: 7 });
  collection = fillTypes(collection, dancheong, { marble: 18, sapphire: 8 });
  return fill(collection, ming, high, 2);
}

test('new collections have one mixed theme path, with exactly one next theme', () => {
  const unlocks = getThemeUnlocks(createCollection());
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
  for (const state of unlocks) for (const goal of state.requirements) {
    assert.equal(goal.ruleset, rulesetForTheme(goal.themeId));
    assert.ok(goal.tiles.every(tile => tile.matchKey.startsWith(`${goal.themeId}:${goal.ruleset}:`)));
  }
  for (const removedEdition of ['eastern', 'western', 'invalid']) {
    assert.deepEqual(getThemeUnlocks(createCollection(), removedEdition), unlocks, 'legacy argument cannot create another path');
  }
});

test('Dancheong needs any 14 Ming Marble and 7 Sapphire artworks at three matches each', () => {
  const completed = fillTypes(createCollection(), ming, { marble: 14, sapphire: 7 });
  const missingKey = getThemeUnlocks(completed)[1].requirements[1].tiles[0].matchKey;
  const excessKey = getThemeUnlocks(completed)[1].requirements[0].tiles[0].matchKey;
  const short = { ...completed, counts: { ...completed.counts, [missingKey]: 2, [excessKey]: 3000 } };
  assert.deepEqual(states(short), [true, false, false, false]);
  assert.equal(getThemeUnlocks(short)[1].requirements[1].completedTypes, 6);
  assert.deepEqual(states(completed), [true, true, false, false]);
  assert.equal(getThemeUnlocks(completed)[2].nextToUnlock, true);
  for (const goal of getThemeUnlocks(completed)[1].requirements) {
    for (const tile of goal.tiles.filter(tile => tile.complete)) {
      assert.equal(getThemeUnlocks({ ...completed, counts: { ...completed.counts, [tile.matchKey]: 2 } })[1].unlocked, false);
    }
  }
  const alternate = { ...completed, counts: { ...completed.counts, [missingKey]: 0 } };
  const spare = getThemeUnlocks(completed)[1].requirements[1].tiles.find(tile => !tile.complete);
  alternate.counts[spare.matchKey] = 3;
  assert.equal(getThemeUnlocks(alternate)[1].unlocked, true, 'any seven Sapphire artworks qualify');
});

test('Stained Glass requires Eastern Dancheong low rarities and every Eastern Ming high rarity', () => {
  let collection = fillTypes(createCollection(), ming, { marble: 14, sapphire: 7 });
  collection = fillTypes(collection, dancheong, { marble: 18, sapphire: 8 });
  assert.deepEqual(states(collection), [true, true, false, false]);
  collection = fill(collection, ming, high, 1);
  assert.deepEqual(states(collection), [true, true, false, false]);
  const completed = fill(collection, ming, high, 2);
  assert.deepEqual(states(completed), [true, true, true, false]);
  for (const goal of getThemeUnlocks(completed)[2].requirements) {
    assert.equal(goal.ruleset, 'eastern');
    for (const tile of goal.tiles.filter(tile => tile.complete)) {
      const missing = { ...completed, counts: { ...completed.counts, [tile.matchKey]: goal.matchesPerType - 1 } };
      assert.equal(getThemeUnlocks(missing)[2].unlocked, false);
    }
  }
});

test('Dutch needs Western Stained Glass and Eastern Dancheong; later counts cannot bypass earlier locks', () => {
  let collection = fill(createCollection(), stained, low, 3);
  collection = fill(collection, dancheong, high, 2);
  assert.deepEqual(states(collection), [true, false, false, false]);
  collection = unlockStained(collection);
  assert.deepEqual(states(collection), [true, true, true, true]);
  assert.equal(getThemeUnlocks(collection).some(theme => theme.nextToUnlock), false);
  assert.deepEqual(getThemeUnlocks(collection)[3].requirements.map(goal =>
    [goal.themeId, goal.ruleset, goal.rarityId, goal.matchesPerType]), [
    [stained, 'western', 'marble', 3], [stained, 'western', 'sapphire', 3],
    [dancheong, 'eastern', 'amethyst', 2], [dancheong, 'eastern', 'gold', 2],
  ]);
  for (const goal of getThemeUnlocks(collection)[3].requirements) for (const tile of goal.tiles) {
    const missing = { ...collection, counts: { ...collection.counts, [tile.matchKey]: goal.matchesPerType - 1 } };
    assert.equal(getThemeUnlocks(missing)[3].unlocked, false);
  }
  const wrongEdition = fill(fill(unlockStained(), stained, low, 3, 'eastern'), dancheong, high, 2);
  assert.equal(getThemeUnlocks(wrongEdition)[3].unlocked, false, 'archived faces do not count twice as active progression');
});

test('both old edition paths retain their earned stages when their copies are migrated', () => {
  for (const edition of ['eastern', 'western']) {
    let old = { version: 1, counts: {}, receipts: {} };
    for (const themeId of [ming, dancheong, stained]) old = fill(old, themeId, [...low, ...high], 3, edition);
    const migrated = normalizeCollection(old);
    assert.deepEqual(migrated.retainedThemeIds, launchThemeIds);
    assert.deepEqual(states(migrated), [true, true, true, true]);
    const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
    assert.equal(saveCollection(migrated, storage), true);
    assert.deepEqual(loadCollection(storage), migrated);
    // Access is recorded independently from the converted counts, so a changed
    // artwork mapping or a later balance adjustment cannot revoke an earned theme.
    assert.deepEqual(states({ ...migrated, counts: {} }), [true, true, true, true]);
  }
});

test('migration combines partial copies without pretending unfinished old paths were unlocked', () => {
  let old = { version: 1, counts: {}, receipts: {} };
  old = fill(old, ming, low, 1, 'eastern');
  old = fill(old, ming, low, 2, 'western');
  const migrated = normalizeCollection(old);
  assert.deepEqual(migrated.retainedThemeIds, []);
  assert.deepEqual(states(migrated), [true, true, false, false], 'combined earned copies can now complete the single gate');
  const laterOnly = normalizeCollection(fill({ version: 1, counts: {}, receipts: {} }, stained, low, 3, 'eastern'));
  assert.deepEqual(laterOnly.retainedThemeIds, []);
  assert.deepEqual(states(laterOnly), [true, false, false, false]);
});

test('partial copies advance quota bars before an artwork is ready, capped at the best required types', () => {
  let collection = createCollection();
  const key = getThemeUnlocks(collection)[1].requirements[0].tiles[0].matchKey;
  for (const count of [1, 2, 3, 1000]) {
    collection = { ...collection, counts: { [key]: count } };
    const progress = getThemeProgress(getThemeUnlocks(collection)[1]);
    assert.equal(progress.completedMatches, Math.min(3, count));
    assert.equal(progress.requiredMatches, 63);
    assert.equal(progress.completedTypes, Number(count >= 3));
    assert.equal(progress.requiredTypes, 21);
    assert.equal(progress.percent, Math.floor(100 * Math.min(3, count) / 63));
    assert.equal(progress.complete, false);
  }
  collection = fill(createCollection(), ming, low, 2);
  assert.deepEqual(getThemeUnlocks(collection)[1].requirements.map(goal => goal.completedMatches), [28, 14]);
  assert.equal(getThemeProgress(getThemeUnlocks(collection)[1]).percent, 66);
  const ready = fillTypes(collection, ming, { marble: 14, sapphire: 7 });
  assert.deepEqual(getThemeProgress(getThemeUnlocks(ready)[1]), {
    completedTypes: 21, requiredTypes: 21, completedMatches: 63, requiredMatches: 63, percent: 100, complete: true,
  });
  assert.deepEqual(getThemeProgress(getThemeUnlocks(fill(ready, ming, low, 1000))[1]), getThemeProgress(getThemeUnlocks(ready)[1]));
});

test('only improvements among the best quota artworks contribute to match progress', () => {
  const before = fillTypes(createCollection(), ming, { marble: 14, sapphire: 7 }, 2);
  const state = getThemeUnlocks(before)[1];
  const outside = state.requirements[0].tiles.find(tile => tile.count === 0).matchKey;
  const collection = { ...before, counts: { ...before.counts, [outside]: 1 } };
  assert.equal(getThemeProgress(getThemeUnlocks(collection)[1]).completedMatches, getThemeProgress(state).completedMatches);
  collection.counts[outside] = 3;
  assert.equal(getThemeProgress(getThemeUnlocks(collection)[1]).completedMatches, getThemeProgress(state).completedMatches + 1);
});

test('100 percent always represents a real unlock including the preceding theme', () => {
  let collection = fill(createCollection(), stained, low, 3);
  collection = fill(collection, dancheong, high, 2);
  const progress = getThemeProgress(getThemeUnlocks(collection)[3]);
  assert.equal(progress.completedMatches, progress.requiredMatches);
  assert.equal(progress.percent, 99);
  assert.equal(progress.complete, false);
  for (const state of getThemeUnlocks(unlockStained(collection))) assert.equal(getThemeProgress(state).percent === 100, state.unlocked);
  assert.equal(getThemeProgress(null).percent, 0);
});

test('malformed counts never complete requirements and evaluation does not mutate saved data', () => {
  const collection = fillTypes(createCollection(), ming, { marble: 14, sapphire: 7 });
  const key = getThemeUnlocks(collection)[1].requirements[0].tiles[0].matchKey;
  for (const invalid of ['3', -1, 2.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const corrupt = { ...collection, counts: { ...collection.counts, [key]: invalid } };
    assert.deepEqual(states(corrupt), [true, false, false, false]);
    assert.deepEqual(states(normalizeCollection(corrupt)), [true, false, false, false]);
  }
  const before = structuredClone(collection);
  Object.freeze(collection.counts); Object.freeze(collection);
  const result = getThemeUnlocks(collection);
  assert.deepEqual(collection, before);
  result[1].requirements[0].tiles[0].count = 0;
  assert.equal(getThemeUnlocks(collection)[1].unlocked, true);
  assert.deepEqual(states(null), [true, false, false, false]);
});

test('deal guard rejects locked and unreleased themes, and random picks only unlocked launch themes', () => {
  const empty = createCollection();
  for (const id of [dancheong, stained, dutch, 'neon-shrine', '', undefined]) assert.equal(choosePlayableTheme(empty, id), null);
  assert.equal(choosePlayableTheme(empty, ming), ming);
  for (const draw of [0, 0.25, 0.99, 1, -1, Infinity, NaN]) assert.equal(choosePlayableTheme(empty, 'random', () => draw), ming);
  const secondOpen = fill(empty, ming, low, 3);
  assert.equal(choosePlayableTheme(secondOpen, dancheong), dancheong);
  const selected = new Set(Array.from({ length: 100 }, (_, index) => choosePlayableTheme(secondOpen, 'random', () => index / 99)));
  assert.deepEqual([...selected], [ming, dancheong]);
  const complete = fill(fill(unlockStained(), stained, low, 3), dancheong, high, 2);
  assert.deepEqual(Array.from({ length: 4 }, (_, index) => choosePlayableTheme(complete, 'random', () => index / 4)), launchThemeIds);
  assert.equal(choosePlayableTheme(complete, 'random', () => 1), dutch);
});
