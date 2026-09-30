import test from 'node:test';
import assert from 'node:assert/strict';
import { launchThemeIds } from '../src/themes.js';
import {
  loadThemePopulation, updateThemePopulation, saveThemePopulation,
  UPDATE_INTERVAL_MS, THEME_POPULATION_STORAGE_KEY, MIN_THEME_POPULATION, MAX_THEME_POPULATION,
} from '../src/theme-population.js';

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem(key) { assert.equal(key, THEME_POPULATION_STORAGE_KEY); return value; },
    setItem(key, next) { assert.equal(key, THEME_POPULATION_STORAGE_KEY); value = next; },
  };
}

function snapshot(count = 50_000, updatedAt = 1_000) {
  return { counts: Object.fromEntries(launchThemeIds.map(id => [id, count])), updatedAt };
}

test('new sessions draw one bounded integer for each launch theme', () => {
  const draws = [0, 1, 0.25, 0.75];
  let calls = 0;
  const state = loadThemePopulation({ storage: null, now: 1_000, random: () => draws[calls++] });
  assert.deepEqual(Object.keys(state.counts), launchThemeIds);
  assert.equal(calls, 4);
  assert.equal(state.counts[launchThemeIds[0]], MIN_THEME_POPULATION);
  assert.equal(state.counts[launchThemeIds[1]], MAX_THEME_POPULATION);
  assert.ok(Object.values(state.counts).every(value => Number.isInteger(value) && value >= 18_000 && value <= 130_000));
  assert.equal(state.updatedAt, 1_000);
});

test('saved session counts survive navigation and reload until the interval is due', () => {
  const storage = memoryStorage();
  const initial = loadThemePopulation({ storage, now: 1_000, random: () => 0.3 });
  assert.equal(saveThemePopulation(initial, storage), true);
  const noDraw = () => { throw new Error('Unexpected reroll'); };
  assert.equal(updateThemePopulation(initial, { now: 1_001, random: noDraw }), initial);
  assert.deepEqual(loadThemePopulation({ storage, now: 1_000 + UPDATE_INTERVAL_MS - 1, random: noDraw }), initial);
});

test('the exact three-minute boundary updates once without mutating the previous snapshot', () => {
  const initial = snapshot();
  const previous = structuredClone(initial);
  const next = updateThemePopulation(initial, { now: initial.updatedAt + UPDATE_INTERVAL_MS, random: () => 0 });
  assert.equal(UPDATE_INTERVAL_MS, 180_000);
  assert.notEqual(next, initial);
  assert.deepEqual(initial, previous);
  assert.ok(Object.values(next.counts).every(value => value === 49_000));
  assert.equal(next.updatedAt, 181_000);
});

test('long-hidden tabs get a single nearby update rather than replaying missed intervals', () => {
  const initial = snapshot();
  const now = initial.updatedAt + UPDATE_INTERVAL_MS * 100;
  let calls = 0;
  const next = updateThemePopulation(initial, { now, random: () => { calls++; return 1; } });
  assert.equal(calls, launchThemeIds.length);
  assert.ok(Object.values(next.counts).every(value => value === 51_000));
  assert.equal(next.updatedAt, now);
  assert.equal(updateThemePopulation(next, { now: now + 1, random: () => { throw new Error('Unexpected second update'); } }), next);
});

test('an overdue reload also performs only one update', () => {
  const initial = snapshot();
  const storage = memoryStorage(JSON.stringify(initial));
  const now = initial.updatedAt + UPDATE_INTERVAL_MS * 20;
  const loaded = loadThemePopulation({ storage, now, random: () => 0 });
  assert.ok(Object.values(loaded.counts).every(value => value === 49_000));
  assert.equal(loaded.updatedAt, now);
});

test('counts remain in range and each update stays within two percent over repeated changes', () => {
  let state = snapshot();
  state.counts[launchThemeIds[0]] = MIN_THEME_POPULATION;
  state.counts[launchThemeIds[1]] = MAX_THEME_POPULATION;
  const draws = [0, 1, 0.01, 0.99, 0.45, 0.8];
  let draw = 0;
  for (let step = 0; step < 1_000; step++) {
    const next = updateThemePopulation(state, { now: state.updatedAt + UPDATE_INTERVAL_MS, random: () => draws[draw++ % draws.length] });
    for (const id of launchThemeIds) {
      assert.ok(next.counts[id] >= MIN_THEME_POPULATION && next.counts[id] <= MAX_THEME_POPULATION);
      assert.ok(Math.abs(next.counts[id] - state.counts[id]) <= Math.floor(state.counts[id] * 0.02));
      assert.ok(Number.isInteger(next.counts[id]));
    }
    state = next;
  }
});

test('load repairs invalid counts and timestamps while preserving valid theme counts', () => {
  const stored = { counts: { [launchThemeIds[0]]: 42_500, [launchThemeIds[1]]: 17_999, [launchThemeIds[2]]: '50000', [launchThemeIds[3]]: 130_001, retired: 55_000 }, updatedAt: 999_999_999 };
  let calls = 0;
  const state = loadThemePopulation({ storage: memoryStorage(JSON.stringify(stored)), now: 1_000, random: () => { calls++; return 0; } });
  assert.equal(state.counts[launchThemeIds[0]], 42_500);
  assert.equal(calls, 3);
  assert.deepEqual(Object.keys(state.counts), launchThemeIds);
  assert.equal(state.updatedAt, 1_000);
  assert.ok(launchThemeIds.slice(1).every(id => state.counts[id] === MIN_THEME_POPULATION));
});

test('clock rollback keeps counts but resets the next update window', () => {
  const initial = snapshot(65_000, 20_000);
  const repaired = updateThemePopulation(initial, { now: 10_000, random: () => { throw new Error('Unexpected reroll'); } });
  assert.deepEqual(repaired.counts, initial.counts);
  assert.equal(repaired.updatedAt, 10_000);
});

test('invalid storage JSON, unavailable storage and write restrictions fail safely', () => {
  const blockedStorage = { getItem() { throw new Error('Access blocked'); }, setItem() { throw new Error('Quota exceeded'); } };
  for (const storage of [null, memoryStorage('{bad json'), blockedStorage]) {
    const state = loadThemePopulation({ storage, now: 1_000, random: () => 0.5 });
    assert.equal(Object.keys(state.counts).length, 4);
    assert.ok(Object.values(state.counts).every(value => value >= MIN_THEME_POPULATION && value <= MAX_THEME_POPULATION));
  }
  assert.equal(saveThemePopulation(snapshot(), null), false);
  assert.equal(saveThemePopulation(snapshot(), blockedStorage), false);
});
