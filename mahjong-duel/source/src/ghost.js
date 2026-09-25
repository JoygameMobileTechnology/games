import { isFree, removePair } from './engine.js';

export const GHOST_MEMORY_TURNS = 2;
export const GHOST_MEMORY_VERSION = 3;

function recentMemory(tiles, memory, turnIndex) {
  if (!Number.isInteger(turnIndex) || turnIndex < 0) throw new TypeError('A ghost turn index must be a non-negative integer.');
  const live = new Set(tiles.filter(tile => !tile.removed).map(tile => tile.id));
  return Object.fromEntries(Object.entries(memory ?? {})
    .filter(([id, observation]) => live.has(id) && observation &&
      typeof observation.key === 'string' && observation.key.length > 0 &&
      Number.isInteger(observation.turn) && observation.turn >= 0 &&
      observation.turn >= turnIndex - GHOST_MEMORY_TURNS && observation.turn <= turnIndex));
}

/** Record visible faces from either player or Peek, measured in pair attempts. */
export function rememberGhostFaces(tiles, memory = {}, revealedIds = [], turnIndex = 0) {
  const observations = new Map(Object.entries(recentMemory(tiles, memory, turnIndex)));
  for (const id of revealedIds) {
    const tile = tiles.find(candidate => candidate.id === id && !candidate.removed);
    if (!tile) continue;
    observations.delete(id);
    observations.set(id, { key: tile.matchKey, turn: turnIndex });
  }
  return recentMemory(tiles, Object.fromEntries(observations), turnIndex);
}

/** Guess blindly until an actually revealed face identifies a remembered match. */
export function playGhostTurn(tiles, memory = {}, seed = Math.floor(Math.random() * 0x100000000), turnIndex = 0) {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) throw new TypeError('A ghost turn seed must be a finite integer.');
  let randomState = seed >>> 0;
  const pick = values => {
    randomState += 0x6d2b79f5;
    let mixed = Math.imul(randomState ^ (randomState >>> 15), randomState | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    const random = ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    return values[Math.floor(random * values.length)];
  };
  let knowledge = recentMemory(tiles, memory, turnIndex);
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
  if (knownPairs.length) {
    [first, second] = pick(knownPairs);
  } else {
    // No unseen-tile preference or deliberate misses: every legal stone is a guess.
    first = pick(available);
    const firstKey = first.matchKey; // Chosen first; its reveal can inform the second pick.
    const others = available.filter(tile => tile.id !== first.id);
    const partners = others.filter(tile => knowledge[tile.id]?.key === firstKey);
    second = pick(partners.length ? partners : others);
  }
  const flippedIds = [first.id, second.id];
  knowledge = rememberGhostFaces(tiles, knowledge, flippedIds, turnIndex);
  const nextTiles = removePair(tiles, first.id, second.id);
  const nextMemory = recentMemory(nextTiles, knowledge, turnIndex);
  const uncovered = nextTiles.filter(tile => isFree(tile, nextTiles));
  const knownKeys = uncovered.filter(tile => Object.hasOwn(nextMemory, tile.id)).map(tile => nextMemory[tile.id].key);
  const allKnown = knownKeys.length === uncovered.length;
  const knownPair = new Set(knownKeys).size < knownKeys.length;
  const needsShuffle = nextTiles.some(tile => !tile.removed) &&
    (uncovered.length < 2 || (allKnown && !knownPair));
  return { tiles: nextTiles, memory: nextMemory, flippedIds, matched: nextTiles !== tiles, needsShuffle };
}

export function ghostName(profile) {
  const name = typeof profile?.name === 'string' ? profile.name.trim().replace(/\s+/g, ' ') : '';
  return `${name || 'Player'}’s Ghost`;
}
