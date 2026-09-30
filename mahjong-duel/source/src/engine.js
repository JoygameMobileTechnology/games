import { themeTileSets } from './tile-data.js';
import { FORMATION_WIDTH, FORMATION_HEIGHT, FORMATION_IDS, getFormation, chooseFormationId } from './formations.js';

export const BOARD_WIDTH = FORMATION_WIDTH;
export const BOARD_HEIGHT = FORMATION_HEIGHT;
export const TILE_COUNT = 80;

// Adapt the supplied tile-system difficulty axes to an 80-tile round. Eastern
// rounds use 20 exact-picture faces, with four copies of each.
const DIFFICULTY_DRAWS = {
  calm: { anchors: 10, counts: [1, 3, 5], tiers: [1, 3, 5], kin: 3, glyphs: 1 },
  balanced: { anchors: 6, counts: [1, 2, 3, 4, 5, 6], tiers: [1, 2, 3, 4, 5], kin: 3, glyphs: 0 },
  intricate: { anchors: 4, counts: [1, 2, 3, 4, 5, 6], tiers: [1, 2, 3, 4, 5], kin: 1, glyphs: 4 },
};

const EPSILON = 0.00001;
const randomSeed = () => Math.floor(Math.random() * 0x100000000);

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
}

function shuffled(values, random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const other = Math.floor(random() * (i + 1));
    [result[i], result[other]] = [result[other], result[i]];
  }
  return result;
}

function normalizeSeed(seed) {
  if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
    throw new TypeError('A deal seed must be a finite integer.');
  }
  return seed >>> 0;
}

function overlaps(a, b) {
  return Math.abs(a - b) < 1 - EPSILON;
}

/** Memory tiles can flip whenever uncovered; neighbours on the same tier do not block. */
export function isFree(tile, tiles) {
  if (!tile || tile.removed) return false;
  const current = tiles.find((candidate) => candidate.id === tile.id);
  if (!current || current.removed) return false;
  for (const other of tiles) {
    if (other.removed || other.id === current.id) continue;
    if (!overlaps(other.y, current.y)) continue;
    if (other.z > current.z && overlaps(other.x, current.x)) return false;
  }
  return true;
}

/** Each manifest match key identifies one exact picture in either edition. */
export function canMatch(first, second) {
  return Boolean(
    first && second && !first.removed && !second.removed &&
    first.id !== second.id && typeof first.matchKey === 'string' &&
    first.matchKey.length > 0 && first.matchKey === second.matchKey,
  );
}

export function getAvailablePairs(tiles) {
  const free = tiles.filter((tile) => isFree(tile, tiles));
  const pairs = [];
  for (let i = 0; i < free.length; i += 1) {
    for (let j = i + 1; j < free.length; j += 1) {
      if (canMatch(free[i], free[j])) pairs.push([free[i], free[j]]);
    }
  }
  return pairs;
}

/** Invalid moves are a no-op, including repeated clicks and covered matching tiles. */
export function removePair(tiles, firstId, secondId) {
  const first = tiles.find((tile) => tile.id === firstId);
  const second = tiles.find((tile) => tile.id === secondId);
  if (!canMatch(first, second) || !isFree(first, tiles) || !isFree(second, tiles)) return tiles;
  return tiles.map((tile) => tile.id === firstId || tile.id === secondId
    ? { ...tile, removed: true }
    : tile);
}

export function remainingCount(tiles) {
  return tiles.reduce((count, tile) => count + (tile.removed ? 0 : 1), 0);
}

/** Reject saved boards whose face identities or copy rules no longer exist. */
export function isCurrentCatalogueDeal(game) {
  const definitions = themeTileSets[game?.theme]?.[game?.ruleset];
  if (!Array.isArray(definitions) || !Array.isArray(game?.tiles) || game.tiles.length !== TILE_COUNT) return false;
  const faces = new Map(definitions.map(face => [face.id, face]));
  const copies = new Map();
  const ids = new Set();
  for (const tile of game.tiles) {
    const face = faces.get(tile?.faceId);
    if (!face || ['season', 'flower'].includes(face.family) || face.copies !== 4 ||
        tile.family !== face.family || tile.matchKey !== face.matchKey || !tile.id || ids.has(tile.id)) return false;
    ids.add(tile.id);
    copies.set(face.id, (copies.get(face.id) || 0) + 1);
  }
  return copies.size === 20 && [...copies.values()].every(count => count === 4);
}

function validateTiles(tiles) {
  const ids = new Set();
  for (const tile of tiles) {
    if (!tile.id || ids.has(tile.id)) throw new Error('Every tile needs a unique identity.');
    ids.add(tile.id);
    if (![tile.x, tile.y, tile.z].every(Number.isFinite)) {
      throw new Error('Tile positions must be finite numbers.');
    }
    if (typeof tile.matchKey !== 'string' || !tile.matchKey) {
      throw new Error('Every tile needs a matching key.');
    }
  }
}

function pairByKey(tiles, random) {
  const groups = new Map();
  for (const tile of tiles) {
    if (!groups.has(tile.matchKey)) groups.set(tile.matchKey, []);
    groups.get(tile.matchKey).push(tile);
  }
  const pairs = [];
  for (const group of groups.values()) {
    if (group.length % 2 !== 0) throw new Error('Remaining matching groups must contain an even number of tiles.');
    const mixed = shuffled(group, random);
    for (let i = 0; i < mixed.length; i += 2) pairs.push([mixed[i], mixed[i + 1]]);
  }
  return shuffled(pairs, random);
}

// Peel the highest exposed tiles first. Complete tiers have even tile counts,
// so a fresh layout always has a complete removal order before faces are dealt.
function geometrySolution(slots, random) {
  let remaining = slots.map((tile) => ({ ...tile, removed: false }));
  const solution = [];
  while (remaining.length > 0) {
    const free = shuffled(remaining.filter((tile) => isFree(tile, remaining)), random)
      .sort((a, b) => b.z - a.z);
    if (free.length < 2) return null;
    const pair = [free[0], free[1]];
    solution.push(pair);
    remaining = remaining.filter((tile) => tile.id !== pair[0].id && tile.id !== pair[1].id);
  }
  return solution;
}

function placePairs(tiles, pairs, order) {
  const placements = new Map();
  const solution = [];
  for (let i = 0; i < pairs.length; i += 1) {
    for (let side = 0; side < 2; side += 1) {
      const tile = pairs[i][side];
      const slot = order[i][side];
      placements.set(tile.id, { ...tile, x: slot.x, y: slot.y, z: slot.z });
    }
    solution.push(pairs[i].map((tile) => tile.id));
  }
  return { tiles: tiles.map((tile) => placements.get(tile.id) || tile), solution };
}

function chooseFaces(ruleset, difficulty, theme, random) {
  if (!Object.hasOwn(themeTileSets, theme)) throw new RangeError(`Unknown theme: ${theme}`);
  const sets = themeTileSets[theme];
  if (!Object.hasOwn(sets, ruleset)) throw new RangeError(`Unknown ruleset: ${ruleset}`);
  const definitions = sets[ruleset];
  if (!Object.hasOwn(DIFFICULTY_DRAWS, difficulty)) throw new RangeError(`Unknown difficulty: ${difficulty}`);
  if (ruleset === 'western') return shuffled(definitions, random).slice(0, 20);

  const draw = DIFFICULTY_DRAWS[difficulty];
  const pick = (family, count) => shuffled(definitions.filter((face) => face.family === family), random).slice(0, count);
  const rankOffset = difficulty === 'calm' ? Math.floor(random() * 2) : 0;
  const ranks = (family, values) => {
    // Alternate spaced ranks so all six types remain collectible in Calm duels.
    const selected = values.map(rank => rank + rankOffset);
    return definitions.filter((face) => face.family === family && selected.includes(face.rank));
  };
  return [
    ...pick('anchor', draw.anchors),
    ...ranks('count', draw.counts),
    ...ranks('tier', draw.tiers),
    ...pick('kin', draw.kin),
    ...pick('glyph', draw.glyphs),
  ];
}

export function createGame(ruleset = 'eastern', seed = randomSeed(), difficulty = 'balanced', theme = 'ming-porcelain', options = {}) {
  const normalizedSeed = normalizeSeed(seed);
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Deal options must be an object.');
  const formationId = options.formationId ?? chooseFormationId(normalizedSeed);
  const formation = getFormation(formationId);
  const random = seededRandom(normalizedSeed);
  const faces = chooseFaces(ruleset, difficulty, theme, random);
  const tiles = [];
  for (const face of faces) {
    for (let copy = 0; copy < face.copies; copy += 1) {
      tiles.push({ ...face, id: `tile-${tiles.length + 1}`, faceId: face.id, removed: false });
    }
  }
  if (tiles.length !== TILE_COUNT) throw new Error('The selected tile set must contain exactly 80 tiles.');
  if (new Set(tiles.map((tile) => tile.matchKey)).size !== 20) {
    throw new Error('The selected tile set must contain exactly 20 matching groups.');
  }
  const order = geometrySolution(formation.slots, random);
  if (!order || order.length !== TILE_COUNT / 2) throw new Error(`Formation ${formationId} must have a complete 80-tile removal order.`);
  const deal = placePairs(tiles, pairByKey(tiles, random), order);
  return { ...deal, seed: normalizedSeed, ruleset, difficulty, theme, formationId };
}

/**
 * Reposition the exact surviving tile identities into a guaranteed solvable deal.
 * When surviving slots cannot be peeled in pairs, reset them onto a balanced
 * subset of the selected formation. Removed tiles and their state stay untouched.
 */
export function shuffleBoard(tiles, seed = randomSeed(), options = {}) {
  validateTiles(tiles);
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Shuffle options must be an object.');
  const formation = getFormation(options.formationId ?? FORMATION_IDS[0]);
  const random = seededRandom(normalizeSeed(seed));
  const live = tiles.filter((tile) => !tile.removed);
  const pairs = pairByKey(live, random);
  let order = geometrySolution(live, random);
  let reflowed = false;
  if (!order) {
    const fullOrder = geometrySolution(formation.slots, random);
    // A suffix is the board left after legal pair removals, so remains peelable.
    order = fullOrder.slice(fullOrder.length - pairs.length);
    reflowed = true;
  }
  return { ...placePairs(tiles, pairs, order), reflowed };
}

/** Bounded backtracking solver for hints or small residual boards; never mutates. */
export function solveBoard(tiles, { maxStates = 20000 } = {}) {
  validateTiles(tiles);
  if (remainingCount(tiles) % 2 !== 0) return null;
  const visited = new Set();
  let explored = 0;
  function search(current) {
    if (remainingCount(current) === 0) return [];
    if (explored >= maxStates) return null;
    const state = current.map((tile) => tile.removed ? '0' : '1').join('');
    if (visited.has(state)) return null;
    visited.add(state);
    explored += 1;
    const pairs = getAvailablePairs(current).sort((a, b) =>
      (b[0].z + b[1].z) - (a[0].z + a[1].z));
    for (const [first, second] of pairs) {
      const next = removePair(current, first.id, second.id);
      const rest = search(next);
      if (rest) return [[first.id, second.id], ...rest];
    }
    return null;
  }
  return search(tiles);
}
