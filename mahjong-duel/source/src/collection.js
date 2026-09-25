import { themeTileSets } from './tile-data.js';

export const COLLECTION_STORAGE_KEY = 'porcelain:collection';
export const COLLECTION_VERSION = 1;
const catalogue = Object.values(themeTileSets).flatMap(sets => Object.values(sets).flat());
const identities = new Set(catalogue.map(tile => tile.matchKey));
const record = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 200;

export function createCollection() { return { version: COLLECTION_VERSION, counts: {}, receipts: {} }; }

export function collectionCount(collection, matchKey) {
  const count = collection?.counts?.[matchKey];
  return identities.has(matchKey) && Number.isSafeInteger(count) && count > 0 ? count : 0;
}

/** Stable across tile selection order; use the physical pair, not the face ID. */
export function collectionPairId(ids) {
  return Array.isArray(ids) && ids.length === 2 && ids.every(validId) && ids[0] !== ids[1]
    ? JSON.stringify([...ids].sort()) : null;
}

function validReceipt(receipt) {
  try {
    const values = JSON.parse(receipt);
    return Array.isArray(values) && values.length === 2 && values.every(validId);
  } catch { return false; }
}

export function normalizeCollection(value) {
  if (!record(value) || value.version !== COLLECTION_VERSION) return createCollection();
  const counts = Object.fromEntries(Object.entries(record(value.counts) ? value.counts : {})
    .filter(([key, count]) => identities.has(key) && Number.isSafeInteger(count) && count > 0));
  const receipts = Object.fromEntries(Object.entries(record(value.receipts) ? value.receipts : {})
    .filter(([receipt, key]) => validReceipt(receipt) && identities.has(key) && counts[key] > 0));
  return { version: COLLECTION_VERSION, counts, receipts };
}

/** One player match adds one pair. Replays and ghost matches are exact no-ops. */
export function awardCollectedPair(collection, { gameId, pairId, matchKey, actor } = {}) {
  const pair = Array.isArray(pairId) ? collectionPairId(pairId) : pairId;
  if (collection?.version !== COLLECTION_VERSION || !record(collection.counts) || !record(collection.receipts) ||
      actor !== 'you' || !validId(gameId) || !validId(pair) || !identities.has(matchKey)) return collection;
  const receipt = JSON.stringify([gameId, pair]);
  if (Object.hasOwn(collection.receipts, receipt)) return collection;
  const previous = collectionCount(collection, matchKey);
  if (previous === Number.MAX_SAFE_INTEGER) return collection;
  return {
    version: COLLECTION_VERSION,
    counts: { ...collection.counts, [matchKey]: previous + 1 },
    receipts: { ...collection.receipts, [receipt]: matchKey },
  };
}

export function collectionStats(collection, { themeId, ruleset } = {}) {
  const tiles = themeId ? Object.entries(themeTileSets[themeId] ?? {}).filter(([rule]) => !ruleset || rule === ruleset).flatMap(([, faces]) => faces)
    : Object.values(themeTileSets).flatMap(sets => Object.entries(sets).filter(([rule]) => !ruleset || rule === ruleset).flatMap(([, faces]) => faces));
  return tiles.reduce((stats, tile) => {
    const count = collectionCount(collection, tile.matchKey);
    stats.unique += Number(count > 0); stats.totalMatches += count;
    return stats;
  }, { unique: 0, totalMatches: 0, totalTiles: tiles.length });
}

export function loadCollection(storage) {
  try { return normalizeCollection(JSON.parse((storage ?? globalThis.localStorage)?.getItem(COLLECTION_STORAGE_KEY) ?? 'null')); }
  catch { return createCollection(); }
}

/** A single write keeps counts and replay receipts together. No other key is touched. */
export function saveCollection(value, storage) {
  if (value?.version !== COLLECTION_VERSION) return false;
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    target.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(normalizeCollection(value)));
    return true;
  } catch { return false; }
}
