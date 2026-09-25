import { isFree, removePair } from './engine.js';

function makeRandom(seed) {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) throw new TypeError('An AI turn seed must be a finite integer.');
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function rememberedPairs(uncovered, knowledge) {
  const pairs = [];
  for (let i = 0; i < uncovered.length; i += 1) {
    if (!knowledge.has(uncovered[i].id)) continue;
    for (let j = i + 1; j < uncovered.length; j += 1) {
      if (knowledge.get(uncovered[i].id) === knowledge.get(uncovered[j].id)) {
        pairs.push([uncovered[i], uncovered[j]]);
      }
    }
  }
  return pairs;
}

function summarize(tiles, knowledge, flippedIds, matched) {
  const live = tiles.filter(tile => !tile.removed);
  const liveIds = new Set(live.map(tile => tile.id));
  const memory = Object.fromEntries([...knowledge].filter(([id]) => liveIds.has(id)));
  const uncovered = live.filter(tile => isFree(tile, tiles));
  const hasUnseen = uncovered.some(tile => !Object.hasOwn(memory, tile.id));
  const needsShuffle = live.length > 0 && (
    uncovered.length < 2 || (!hasUnseen && rememberedPairs(uncovered, new Map(Object.entries(memory))).length === 0)
  );
  return { tiles, memory, flippedIds, matched, needsShuffle };
}

/**
 * Play one memory turn using observed IDs and matching keys only.
 * Geometry is public. A face's matching key is read only after its tile has been
 * chosen to flip. The first revealed face can guide the second choice if its
 * partner was seen earlier. No solution or unrevealed identity is consulted.
 */
export function playMemoryTurn(tiles, memory = {}, seed = Math.floor(Math.random() * 0x100000000)) {
  const random = makeRandom(seed);
  const pick = values => values[Math.floor(random() * values.length)];
  const liveIds = new Set(tiles.filter(tile => !tile.removed).map(tile => tile.id));
  const knowledge = new Map(Object.entries(memory ?? {}).filter(([id, key]) => liveIds.has(id) && typeof key === 'string' && key.length > 0));
  const uncovered = tiles.filter(tile => isFree(tile, tiles));
  if (uncovered.length < 2) return summarize(tiles, knowledge, [], false);

  const knownPairs = rememberedPairs(uncovered, knowledge);
  let first, second;
  if (knownPairs.length > 0) {
    [first, second] = pick(knownPairs);
    knowledge.set(first.id, first.matchKey);
    knowledge.set(second.id, second.matchKey);
  } else {
    const unseen = uncovered.filter(tile => !knowledge.has(tile.id));
    first = pick(unseen.length > 0 ? unseen : uncovered);
    const firstKey = first.matchKey;
    knowledge.set(first.id, firstKey);
    const others = uncovered.filter(tile => tile.id !== first.id);
    const rememberedMatch = others.filter(tile => knowledge.get(tile.id) === firstKey);
    const unseenOthers = others.filter(tile => !knowledge.has(tile.id));
    second = pick(rememberedMatch.length > 0 ? rememberedMatch : unseenOthers.length > 0 ? unseenOthers : others);
    knowledge.set(second.id, second.matchKey);
  }

  const next = removePair(tiles, first.id, second.id);
  return summarize(next, knowledge, [first.id, second.id], next !== tiles);
}
