import { launchThemeIds } from './themes.js';

export const UPDATE_INTERVAL_MS = 3 * 60 * 1000;
export const THEME_POPULATION_STORAGE_KEY = 'mahjong-duel-theme-population-v1';
export const MIN_THEME_POPULATION = 18_000;
export const MAX_THEME_POPULATION = 130_000;

function defaultStorage() {
  try { return globalThis.sessionStorage; } catch { return undefined; }
}

function randomInteger(min, max, random) {
  const draw = random();
  const fraction = Number.isFinite(draw) ? Math.max(0, Math.min(1 - Number.EPSILON, draw)) : 0.5;
  return min + Math.floor(fraction * (max - min + 1));
}

function validCount(value) {
  return Number.isInteger(value) && value >= MIN_THEME_POPULATION && value <= MAX_THEME_POPULATION;
}

function validTimestamp(value, now) {
  return Number.isInteger(value) && value >= 0 && value <= now;
}

function checkNow(now) {
  if (!Number.isInteger(now) || now < 0) throw new RangeError('Population time must be a non-negative integer.');
}

function normalizeState(value, now, random) {
  return {
    counts: Object.fromEntries(launchThemeIds.map(id => [id, validCount(value?.counts?.[id])
      ? value.counts[id]
      : randomInteger(MIN_THEME_POPULATION, MAX_THEME_POPULATION, random)])),
    updatedAt: validTimestamp(value?.updatedAt, now) ? value.updatedAt : now,
  };
}

/** Read one tab's cosmetic population snapshot; callers persist it after loading/updating. */
export function loadThemePopulation({ storage = defaultStorage(), now = Date.now(), random = Math.random } = {}) {
  checkNow(now);
  let stored;
  try { stored = JSON.parse(storage?.getItem(THEME_POPULATION_STORAGE_KEY) ?? 'null'); } catch { /* Start fresh if unavailable. */ }
  return updateThemePopulation(normalizeState(stored, now, random), { now, random });
}

/** Make one small change when due, even after a long absence; never replay missed updates. */
export function updateThemePopulation(state, { now = Date.now(), random = Math.random } = {}) {
  checkNow(now);
  if (!validTimestamp(state?.updatedAt, now) || !launchThemeIds.every(id => validCount(state?.counts?.[id]))) {
    return normalizeState(state, now, random);
  }
  if (now - state.updatedAt < UPDATE_INTERVAL_MS) return state;

  return {
    counts: Object.fromEntries(launchThemeIds.map(id => {
      const current = state.counts[id];
      const maxChange = Math.max(30, Math.floor(current * 0.02));
      const next = current + randomInteger(-maxChange, maxChange, random);
      return [id, Math.max(MIN_THEME_POPULATION, Math.min(MAX_THEME_POPULATION, next))];
    })),
    updatedAt: now,
  };
}

export function saveThemePopulation(state, storage = defaultStorage()) {
  try {
    if (!storage) return false;
    storage.setItem(THEME_POPULATION_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch { return false; }
}
