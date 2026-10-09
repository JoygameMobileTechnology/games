import { themeTileSets } from './tile-data.js';
import { launchThemeIds, rulesetForTheme } from './themes.js';
import { rarityForTile, RARITIES } from './rarity.js';
import { legacyUnlockedThemeIds } from './theme-unlock-requirements.js';

export const COLLECTION_STORAGE_KEY = 'porcelain:collection';
export const COLLECTION_VERSION = 2;
export const COLLECTION_MIGRATION_BACKUP_KEY = 'porcelain:backup:before-theme-tiles-v2:collection';
const catalogue = Object.values(themeTileSets).flatMap(sets => Object.values(sets).flat());
const identities = new Set(catalogue.map(tile => tile.matchKey));
const record = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 200;

export function createCollection() { return { version: COLLECTION_VERSION, counts: {}, receipts: {}, retainedThemeIds: [], editionCredits: {} }; }

// Both former editions contain the same number of artworks per rarity. A stable
// one-to-one mapping carries earned copies across without changing their rarity.
const migratedIdentities = new Map(launchThemeIds.flatMap(themeId => {
  const canonical = rulesetForTheme(themeId), previous = canonical === 'eastern' ? 'western' : 'eastern';
  const tilesOf = (edition, rarity) => themeTileSets[themeId][edition]
    .filter(tile => rarityForTile(themeId, edition, tile.id)?.id === rarity)
    .sort((a, b) => a.id.localeCompare(b.id));
  return RARITIES.flatMap(({ id }) => {
    const targets = tilesOf(canonical, id);
    return tilesOf(previous, id).map((tile, index) => [tile.matchKey, targets[index].matchKey]);
  });
}));

function retainedThemeIds(ids) {
  const valid = Array.isArray(ids) ? ids.filter(id => launchThemeIds.includes(id)) : [];
  const furthest = Math.max(-1, ...valid.map(id => launchThemeIds.indexOf(id)));
  return furthest >= 0 ? launchThemeIds.slice(0, furthest + 1) : [];
}

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
  if (!record(value) || ![1, COLLECTION_VERSION].includes(value.version)) return createCollection();
  const counts = Object.fromEntries(Object.entries(record(value.counts) ? value.counts : {})
    .filter(([key, count]) => identities.has(key) && Number.isSafeInteger(count) && count > 0));
  const receipts = Object.fromEntries(Object.entries(record(value.receipts) ? value.receipts : {})
    .filter(([receipt, key]) => validReceipt(receipt) && identities.has(key) && counts[key] > 0));
  const retained = retainedThemeIds(value.retainedThemeIds);
  const editionCredits = {};
  if (value.version === 1) {
    retained.push(...legacyUnlockedThemeIds(counts));
    for (const [oldKey, canonicalKey] of migratedIdentities) {
      if (counts[oldKey]) {
        counts[canonicalKey] = Math.min(Number.MAX_SAFE_INTEGER, (counts[canonicalKey] ?? 0) + counts[oldKey]);
        editionCredits[oldKey] = counts[oldKey];
      }
    }
  } else {
    const explicitCredits = record(value.editionCredits);
    for (const [oldKey, canonicalKey] of migratedIdentities) {
      // Earlier version2 saves already transferred their archived copies. Infer
      // that credit once; keep it explicit thereafter, including partial saves.
      const saved = explicitCredits ? value.editionCredits[oldKey] : counts[oldKey];
      const credit = Number.isSafeInteger(saved) && saved > 0
        ? Math.min(saved, counts[oldKey] ?? 0, counts[canonicalKey] ?? 0) : 0;
      if (credit) editionCredits[oldKey] = credit;
    }
  }
  // Archived counts and original replay receipts stay intact. Version 2 marks
  // their copy credit as already transferred, so loading cannot add it twice.
  return { version: COLLECTION_VERSION, counts, receipts, retainedThemeIds: retainedThemeIds(retained), editionCredits };
}

/** Reconcile the progression envelope and its older standalone collection mirror. */
export function mergeCollections(authoritative, mirror) {
  const first = normalizeCollection(authoritative), second = normalizeCollection(mirror);
  const counts = { ...first.counts };
  const editionCredits = {};
  for (const [key, count] of Object.entries(second.counts)) counts[key] = Math.max(counts[key] ?? 0, count);
  for (const [archivedKey, canonicalKey] of migratedIdentities) {
    // Canonical counts include both native copies and converted copies. Taking
    // only their maximum would lose complementary progress when one save had
    // native copies and the other had copies from the removed edition.
    const parts = collection => {
      const total = collectionCount(collection, canonicalKey);
      const transferred = collection.editionCredits[archivedKey] ?? 0;
      return { native: total - transferred, transferred };
    };
    const a = parts(first), b = parts(second);
    const transferred = Math.max(a.transferred, b.transferred);
    const count = Math.min(Number.MAX_SAFE_INTEGER, Math.max(a.native, b.native) + transferred);
    if (count) counts[canonicalKey] = count;
    if (transferred) editionCredits[archivedKey] = transferred;
  }
  return normalizeCollection({ version: COLLECTION_VERSION, counts, editionCredits,
    receipts: { ...second.receipts, ...first.receipts },
    retainedThemeIds: [...first.retainedThemeIds, ...second.retainedThemeIds] });
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
    ...collection,
    version: COLLECTION_VERSION,
    counts: { ...collection.counts, [matchKey]: previous + 1 },
    receipts: { ...collection.receipts, [receipt]: matchKey },
  };
}

export function collectionStats(collection, { themeId, ruleset } = {}) {
  // Preserve every saved collection, but only count artwork available in this release.
  const visibleThemes = themeId ? launchThemeIds.filter(id => id === themeId) : launchThemeIds;
  const tiles = visibleThemes.filter(id => !ruleset || ruleset === rulesetForTheme(id))
    .flatMap(id => themeTileSets[id]?.[rulesetForTheme(id)] ?? []);
  return tiles.reduce((stats, tile) => {
    const count = collectionCount(collection, tile.matchKey);
    stats.unique += Number(count > 0); stats.totalMatches += count;
    return stats;
  }, { unique: 0, totalMatches: 0, totalTiles: tiles.length });
}

export function loadCollection(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const raw = target?.getItem(COLLECTION_STORAGE_KEY), value = JSON.parse(raw ?? 'null');
    if (value?.version === 1 && Object.keys(record(value.counts) ? value.counts : {}).length) {
      try {
        if (target?.getItem(COLLECTION_MIGRATION_BACKUP_KEY) == null) target?.setItem(COLLECTION_MIGRATION_BACKUP_KEY, raw);
      } catch { /* Full or blocked storage must not prevent a safe in-memory load. */ }
    }
    return normalizeCollection(value);
  }
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
