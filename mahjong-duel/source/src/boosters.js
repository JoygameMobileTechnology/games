import { getAvailablePairs } from './engine.js';

export const BOOSTER_USES = 3;
export const HINT_MS = 1500;
export const EAGLE_MS = 10000;
export const BOOSTER_IDS = ['shuffle', 'hint', 'freeze', 'eagle'];

export function restoreBoosters(game) {
  const boosters = Object.fromEntries(BOOSTER_IDS.map(id => [id,
    Number.isInteger(game.boosters?.[id]) ? Math.max(0, Math.min(BOOSTER_USES, game.boosters[id])) : BOOSTER_USES]));
  const live = new Set(game.tiles.filter(tile => !tile.removed).map(tile => tile.id));
  return { ...game, boosters, freezeReady: Boolean(game.freezeReady),
    hintEffect: game.hintEffect && game.hintEffect.remainingMs > 0 ? {
      ids: game.hintEffect.ids.filter(id => live.has(id)), remainingMs: Math.min(HINT_MS, game.hintEffect.remainingMs),
    } : null,
    eagleMs: Math.max(0, Math.min(EAGLE_MS, Number(game.eagleMs) || 0)),
  };
}

/** Only the human spends boosters. A queued Freeze cannot be stacked. */
export function canUseBooster(game, id) {
  return Boolean(game && game.turn === 'you' && BOOSTER_IDS.includes(id) && game.boosters?.[id] > 0 &&
    game.tiles.some(tile => !tile.removed) && !(id === 'freeze' && game.freezeReady) &&
    !(id === 'eagle' && game.eagleMs > 0) && !(id === 'hint' && game.hintEffect));
}

export function useBooster(game, id) {
  if (!canUseBooster(game, id)) return game;
  const pair = id === 'hint' ? getAvailablePairs(game.tiles)[0] : null;
  if (id === 'hint' && !pair) return game;
  return { ...game, boosters: { ...game.boosters, [id]: game.boosters[id] - 1 },
    ...(id === 'hint' ? { hintEffect: { ids: pair.map(tile => tile.id), remainingMs: HINT_MS } } : {}),
    ...(id === 'freeze' ? { freezeReady: true } : {}),
    ...(id === 'eagle' ? { eagleMs: EAGLE_MS } : {}),
  };
}

export function advanceBoosterEffects(game, elapsedMs) {
  if (!game || !(elapsedMs > 0) || (!game.hintEffect && !game.eagleMs)) return game;
  const hintMs = Math.max(0, (game.hintEffect?.remainingMs || 0) - elapsedMs);
  return { ...game, hintEffect: hintMs > 0 ? { ...game.hintEffect, remainingMs: hintMs } : null,
    eagleMs: Math.max(0, game.eagleMs - elapsedMs) };
}
