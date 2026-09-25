import { isFree, canMatch } from './engine.js';

export const MATCH_VIEW_MS = 240;
export const MISS_VIEW_MS = 700;
export const PEEK_VIEW_MS = 1800;
export const MAX_PEEKS = 3;
const MISMATCH_VIEW_MS = { calm: 900, balanced: MISS_VIEW_MS, intricate: 550 };

/** The human can expose at most two uncovered stones per attempt. */
export function flipMemoryTile(tiles, revealedIds, tileId, difficulty = 'balanced') {
  if (!Object.hasOwn(MISMATCH_VIEW_MS, difficulty)) throw new RangeError(`Unknown difficulty: ${difficulty}`);
  if (revealedIds.length >= 2 || revealedIds.includes(tileId)) return null;
  const tile = tiles.find(candidate => candidate.id === tileId);
  if (!isFree(tile, tiles)) return null;
  const revealed = [...revealedIds, tileId];
  if (revealed.length === 1) return { revealed, match: null, duration: 0 };
  const first = tiles.find(candidate => candidate.id === revealed[0]);
  const match = canMatch(first, tile);
  return { revealed, match, duration: match ? MATCH_VIEW_MS : MISMATCH_VIEW_MS[difficulty] };
}
