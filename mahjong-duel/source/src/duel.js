import { canMatch, isFree, remainingCount, removePair } from './engine.js';

export function createDuelState() {
  return { duelVersion: 1, turn: 'you', score: 0, aiScore: 0, attempts: 0, aiAttempts: 0 };
}

export function resolveDuelAttempt(game, ids) {
  if (game?.mode !== 'duel' || !['you', 'ai'].includes(game.turn) ||
      !Array.isArray(game.tiles) || !Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]) return game;

  const first = game.tiles.find(tile => tile.id === ids[0]);
  const second = game.tiles.find(tile => tile.id === ids[1]);
  if (!isFree(first, game.tiles) || !isFree(second, game.tiles)) return game;

  const attemptKey = game.turn === 'you' ? 'attempts' : 'aiAttempts';
  if (!canMatch(first, second)) {
    if (game.turn === 'you' && game.freezeReady) {
      return { ...game, [attemptKey]: game[attemptKey] + 1, freezeReady: false };
    }
    return { ...game, [attemptKey]: game[attemptKey] + 1, turn: game.turn === 'you' ? 'ai' : 'you' };
  }

  const tiles = removePair(game.tiles, first.id, second.id);
  if (tiles === game.tiles) return game;
  const scoreKey = game.turn === 'you' ? 'score' : 'aiScore';
  return { ...game, tiles, [attemptKey]: game[attemptKey] + 1, [scoreKey]: game[scoreKey] + 100 };
}

export function getDuelOutcome(game) {
  if (game?.mode !== 'duel' || !Array.isArray(game.tiles) || remainingCount(game.tiles) > 0) return null;
  return game.score > game.aiScore ? 'win' : game.score < game.aiScore ? 'lose' : 'tie';
}
