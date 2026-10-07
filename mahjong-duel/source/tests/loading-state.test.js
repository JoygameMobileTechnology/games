import test from 'node:test';
import assert from 'node:assert/strict';
import { themes } from '../src/themes.js';
import { themeTileSets } from '../src/tile-data.js';
import { chooseLoadingTheme, chooseLoadingTiles, takeLoadingTheme } from '../src/loading-state.js';

const STORAGE_KEY = 'porcelain:loadingTheme';
function memoryStorage(initial) {
  const values = new Map(initial === undefined ? [] : [[STORAGE_KEY, initial]]);
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('every active theme is reachable on a first load or after an obsolete preference', () => {
  assert.equal(themes.length, 4);
  for (const previous of [null, undefined, '', 'retired-theme']) {
    themes.forEach((theme, index) => {
      assert.equal(chooseLoadingTheme(previous, () => (index + .5) / themes.length), theme);
    });
  }
});

test('each previous theme is excluded while every other active theme remains reachable', () => {
  for (const previous of themes) {
    const alternatives = themes.filter(theme => theme !== previous);
    alternatives.forEach((theme, index) => {
      assert.equal(chooseLoadingTheme(previous.id, () => (index + .5) / alternatives.length), theme);
    });
    assert.equal(chooseLoadingTheme(previous.id, () => 0), alternatives[0]);
    assert.equal(chooseLoadingTheme(previous.id, () => 1 - Number.EPSILON), alternatives.at(-1));
  }
});

test('persisted launches never repeat consecutively, including after module reload', async () => {
  const storage = memoryStorage();
  let previousId = null;
  const seen = new Set();
  for (let launch = 0; launch < 24; launch++) {
    const { takeLoadingTheme: reloadedTake } = await import(`../src/loading-state.js?launch=${launch}`);
    const theme = reloadedTake(storage, () => (launch % 10) / 10);
    assert.ok(themes.includes(theme));
    assert.notEqual(theme.id, previousId);
    assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)), theme.id);
    seen.add(theme.id);
    previousId = theme.id;
  }
  assert.equal(seen.size, 4);
});

test('corrupt and non-string saved values recover to a valid active theme', () => {
  for (const value of ['{invalid', '{}', '42', 'null', '"retired-theme"']) {
    const storage = memoryStorage(value);
    assert.equal(takeLoadingTheme(storage, () => 0), themes[0]);
    assert.equal(storage.getItem(STORAGE_KEY), JSON.stringify(themes[0].id));
  }
});

test('blocked or absent storage never prevents loading', () => {
  const blocked = {
    getItem() { throw new Error('Storage blocked'); },
    setItem() { throw new Error('Storage blocked'); },
  };
  assert.equal(takeLoadingTheme(blocked, () => 0), themes[0]);
  assert.equal(takeLoadingTheme(null, () => 0), themes[0]);
  const full = {
    getItem() { return JSON.stringify(themes[0].id); },
    setItem() { throw new Error('Storage full'); },
  };
  assert.equal(takeLoadingTheme(full, () => 0), themes[1]);
});

test('a browser that throws when accessing localStorage uses the safe fallback', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('SecurityError'); },
  });
  try {
    assert.equal(takeLoadingTheme(undefined, () => 0), themes[0]);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('loading artwork stays within its selected collection and never repeats an identity or image', () => {
  for (const theme of themes) {
    const catalogue = themeTileSets[theme.id].western;
    const selection = chooseLoadingTiles(theme.id, undefined, () => .4);
    assert.equal(selection.length, 12);
    assert.equal(new Set(selection.map(tile => tile.id)).size, selection.length);
    assert.equal(new Set(selection.map(tile => tile.src)).size, selection.length);
    assert.ok(selection.every(tile => catalogue.includes(tile)));
  }
});

test('requesting more loading faces than available returns the collection once', () => {
  for (const theme of themes) {
    const catalogue = themeTileSets[theme.id].western;
    assert.equal(catalogue.length, 40);
    const selection = chooseLoadingTiles(theme.id, 1000, () => .7);
    assert.equal(selection.length, catalogue.length);
    assert.equal(new Set(selection.map(tile => tile.id)).size, catalogue.length);
    assert.equal(new Set(selection.map(tile => tile.src)).size, catalogue.length);
    assert.deepEqual(new Set(selection), new Set(catalogue));
  }
});

test('loading selection is shuffled without modifying catalogue order or tile records', () => {
  for (const theme of themes) {
    const catalogue = themeTileSets[theme.id].western;
    const snapshot = structuredClone(catalogue);
    const first = chooseLoadingTiles(theme.id, 12, () => 0);
    const second = chooseLoadingTiles(theme.id, 12, () => 1 - Number.EPSILON);
    assert.notDeepEqual(first.map(tile => tile.id), second.map(tile => tile.id));
    assert.deepEqual(catalogue, snapshot);
  }
});

test('empty or invalid loading artwork requests do not produce duplicate fallback faces', () => {
  assert.deepEqual(chooseLoadingTiles('unknown'), []);
  assert.deepEqual(chooseLoadingTiles(themes[0].id, 0), []);
  assert.deepEqual(chooseLoadingTiles(themes[0].id, -3), []);
  assert.equal(chooseLoadingTiles(themes[0].id, 3.9).length, 3);
});
