import { playGhostTurn, rememberGhostFaces } from './ghost.js';
import { playOriginalTurn, rememberOriginalFaces, decayOriginalMemory } from './original-ai.js';
import { planRealisticTurn, chooseRealisticSecond, rememberRealisticFaces, decayRealisticMemory } from './realistic-ai.js';
import { removePair } from './engine.js';

export const AI_MODES = [
  { id: 'realistic', label: 'Realistic', description: 'Gradually adapts to your skill, with imperfect memory, varied thinking time, and good and bad runs.' },
  { id: 'modern', label: 'Modern AI', description: 'Remembers both players’ last two attempts and uses every match it remembers.' },
  { id: 'original', label: 'Original AI', description: '40% pair recall, 35% partner recall. Each memory has a 25% chance of fading after every attempt.' },
];

export function normalizeAiMode(value) {
  return value === 'original' || value === 'modern' ? value : 'realistic';
}

const attemptIndex = game => (game.attempts || 0) + (game.aiAttempts || 0);

/** Only actual reveals are passed here; Hint and Eagle Eye do not reveal faces. */
export function rememberOpponentFaces(game, ids) {
  if (normalizeAiMode(game.aiMode) === 'realistic') return rememberRealisticFaces(game.tiles, game.aiMemory, ids, attemptIndex(game), game.realisticState);
  const remember = normalizeAiMode(game.aiMode) === 'original' ? rememberOriginalFaces : rememberGhostFaces;
  return remember(game.tiles, game.aiMemory, ids, attemptIndex(game));
}

export function playOpponentTurn(game) {
  // Headless callers can resolve a whole attempt; the UI uses these two choices
  // separately and records the first visible flip before asking for the second.
  if (normalizeAiMode(game.aiMode) === 'realistic') {
    const plan = planRealisticTurn(game);
    if (!plan.firstId) return { tiles: game.tiles, memory: game.aiMemory || {}, flippedIds: [], matched: false, needsShuffle: true };
    const revealed = { ...game, realisticState: plan.state, aiMemory: rememberRealisticFaces(game.tiles, game.aiMemory, [plan.firstId], attemptIndex(game), plan.state) };
    const choice = chooseRealisticSecond(revealed, plan);
    if (!choice.secondId) return { tiles: game.tiles, memory: revealed.aiMemory, flippedIds: [], matched: false, needsShuffle: true };
    const flippedIds = [plan.firstId, choice.secondId];
    const memory = rememberRealisticFaces(game.tiles, revealed.aiMemory, [choice.secondId], attemptIndex(game), plan.state);
    const tiles = removePair(game.tiles, ...flippedIds);
    return { tiles, memory: rememberRealisticFaces(tiles, memory, [], attemptIndex(game), plan.state), flippedIds, matched: tiles !== game.tiles, needsShuffle: false };
  }
  const play = normalizeAiMode(game.aiMode) === 'original' ? playOriginalTurn : playGhostTurn;
  const seed = (game.seed + game.aiAttempts * 97 + game.attempts * 13) >>> 0;
  return play(game.tiles, game.aiMemory, seed, attemptIndex(game));
}

/** Call once after resolving either player's pair, even when they keep the turn. */
export function advanceOpponentMemory(game) {
  if (normalizeAiMode(game.aiMode) === 'realistic') {
    const seed = ((game.seed >>> 0) ^ Math.imul(attemptIndex(game), 0x9e3779b1) ^ 0x5265616c) >>> 0;
    return decayRealisticMemory(game.tiles, game.aiMemory, seed, attemptIndex(game), game.realisticState);
  }
  if (normalizeAiMode(game.aiMode) !== 'original') return rememberOpponentFaces(game, []);
  // A separate stream keeps forgetting independent of the next move's recall rolls.
  const seed = ((game.seed >>> 0) ^ Math.imul(attemptIndex(game), 0x9e3779b1) ^ 0xa511e9b3) >>> 0;
  return decayOriginalMemory(game.tiles, game.aiMemory, seed, attemptIndex(game));
}
