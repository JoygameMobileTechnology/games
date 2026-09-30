import { playGhostTurn, rememberGhostFaces } from './ghost.js';
import { playOriginalTurn, rememberOriginalFaces, decayOriginalMemory } from './original-ai.js';

export const AI_MODES = [
  { id: 'modern', label: 'Modern AI', description: 'Remembers both players’ last two attempts and uses every match it remembers.' },
  { id: 'original', label: 'Original AI', description: '40% pair recall, 35% partner recall. Each memory has a 25% chance of fading after every attempt.' },
];

export function normalizeAiMode(value) {
  return value === 'original' ? 'original' : 'modern';
}

const attemptIndex = game => (game.attempts || 0) + (game.aiAttempts || 0);

/** Only actual reveals are passed here; Hint and Eagle Eye do not reveal faces. */
export function rememberOpponentFaces(game, ids) {
  const remember = normalizeAiMode(game.aiMode) === 'original' ? rememberOriginalFaces : rememberGhostFaces;
  return remember(game.tiles, game.aiMemory, ids, attemptIndex(game));
}

export function playOpponentTurn(game) {
  const play = normalizeAiMode(game.aiMode) === 'original' ? playOriginalTurn : playGhostTurn;
  const seed = (game.seed + game.aiAttempts * 97 + game.attempts * 13) >>> 0;
  return play(game.tiles, game.aiMemory, seed, attemptIndex(game));
}

/** Call once after resolving either player's pair, even when they keep the turn. */
export function advanceOpponentMemory(game) {
  if (normalizeAiMode(game.aiMode) !== 'original') return rememberOpponentFaces(game, []);
  // A separate stream keeps forgetting independent of the next move's recall rolls.
  const seed = ((game.seed >>> 0) ^ Math.imul(attemptIndex(game), 0x9e3779b1) ^ 0xa511e9b3) >>> 0;
  return decayOriginalMemory(game.tiles, game.aiMemory, seed, attemptIndex(game));
}
