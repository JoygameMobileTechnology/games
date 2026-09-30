import { isFree, removePair } from './engine.js';

export const ORIGINAL_PAIR_RECALL = 0.4;
export const ORIGINAL_MATCH_RECALL = 0.35;
export const ORIGINAL_MEMORY_DECAY = 0.25;

function liveMemory(tiles, memory, turnIndex) {
  if (!Number.isInteger(turnIndex) || turnIndex < 0) throw new TypeError('An Original AI turn index must be a non-negative integer.');
  const live = new Set(tiles.filter(tile => !tile.removed).map(tile => tile.id));
  return Object.fromEntries(Object.entries(memory ?? {})
    .filter(([id, observation]) => live.has(id) && observation &&
      typeof observation.key === 'string' && observation.key.length > 0 &&
      Number.isInteger(observation.turn) && observation.turn >= 0 && observation.turn <= turnIndex));
}

function seededRandom(seed) {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) throw new TypeError('An Original AI seed must be a finite integer.');
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

/** Log actual reveals by either player; age alone never deletes an observation. */
export function rememberOriginalFaces(tiles, memory = {}, revealedIds = [], turnIndex = 0) {
  const observations = new Map(Object.entries(liveMemory(tiles, memory, turnIndex)));
  for (const id of revealedIds) {
    const tile = tiles.find(candidate => candidate.id === id && !candidate.removed);
    if (!tile) continue;
    observations.delete(id);
    observations.set(id, { key: tile.matchKey, turn: turnIndex });
  }
  return liveMemory(tiles, Object.fromEntries(observations), turnIndex);
}

/** Called once after each completed two-tile attempt, including successful pairs. */
export function decayOriginalMemory(tiles, memory = {}, seed = Math.floor(Math.random() * 0x100000000), turnIndex = 0) {
  const random = seededRandom(seed);
  return Object.fromEntries(Object.entries(liveMemory(tiles, memory, turnIndex))
    .filter(() => random() >= ORIGINAL_MEMORY_DECAY));
}

/** Recall can fail, but a failed recall still guesses from every legal tile. */
export function playOriginalTurn(tiles, memory = {}, seed = Math.floor(Math.random() * 0x100000000), turnIndex = 0) {
  const random = seededRandom(seed);
  const pick = values => values[Math.floor(random() * values.length)];
  let knowledge = liveMemory(tiles, memory, turnIndex);
  const available = tiles.filter(tile => isFree(tile, tiles));
  if (available.length < 2) return { tiles, memory: knowledge, flippedIds: [], matched: false, needsShuffle: tiles.some(tile => !tile.removed) };

  const knownPairs = [];
  for (let i = 0; i < available.length; i++) {
    const firstKey = knowledge[available[i].id]?.key;
    if (!firstKey) continue;
    for (let j = i + 1; j < available.length; j++) {
      if (firstKey === knowledge[available[j].id]?.key) knownPairs.push([available[i], available[j]]);
    }
  }

  let first, second;
  if (knownPairs.length && random() < ORIGINAL_PAIR_RECALL) {
    [first, second] = pick(knownPairs);
  } else {
    first = pick(available);
    const firstKey = first.matchKey; // Its identity is available only after choosing to reveal it.
    const others = available.filter(tile => tile.id !== first.id);
    const partners = others.filter(tile => knowledge[tile.id]?.key === firstKey);
    second = pick(partners.length && random() < ORIGINAL_MATCH_RECALL ? partners : others);
  }

  const flippedIds = [first.id, second.id];
  knowledge = rememberOriginalFaces(tiles, knowledge, flippedIds, turnIndex);
  const nextTiles = removePair(tiles, first.id, second.id);
  const nextMemory = liveMemory(nextTiles, knowledge, turnIndex);
  const uncovered = nextTiles.filter(tile => isFree(tile, nextTiles));
  const knownKeys = uncovered.filter(tile => Object.hasOwn(nextMemory, tile.id)).map(tile => nextMemory[tile.id].key);
  const allKnown = knownKeys.length === uncovered.length;
  const knownPair = new Set(knownKeys).size < knownKeys.length;
  const needsShuffle = nextTiles.some(tile => !tile.removed) &&
    (uncovered.length < 2 || (allKnown && !knownPair));
  return { tiles: nextTiles, memory: nextMemory, flippedIds, matched: nextTiles !== tiles, needsShuffle };
}
