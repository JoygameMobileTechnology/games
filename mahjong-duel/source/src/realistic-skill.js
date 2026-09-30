import { DUEL_TOTAL_SCORE, POINTS_PER_PAIR, TILES_PER_DUEL } from './game-balance.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const count = value => Number.isSafeInteger(value) && value >= 0;
const gameId = value => typeof value === 'string' && value.trim().length > 0;

/** Stored separately from an active match; a match keeps its starting skill. */
export function normalizeRealisticSkill(value) {
  const saved = value?.version === 1 ? value : {};
  return {
    version: 1,
    level: Number.isFinite(saved.level) ? clamp(saved.level, 0, 1) : 0.5,
    completedGames: count(saved.completedGames) ? saved.completedGames : 0,
    lastGameId: gameId(saved.lastGameId) ? saved.lastGameId : null,
  };
}

export function createRealisticSample() {
  return { attempts: 0, matches: 0, hinted: false };
}

function normalizeSample(value) {
  const valid = count(value?.attempts) && count(value?.matches) && value.matches <= value.attempts;
  return { attempts: valid ? value.attempts : 0, matches: valid ? value.matches : 0, hinted: value?.hinted === true };
}

/** Receives an authoritative duel transition, never card faces or a solution. */
export function recordRealisticAttempt(before, after) {
  const sample = normalizeSample(before?.realisticSample);
  if (before?.aiMode !== 'realistic' || after?.aiMode !== 'realistic' ||
      before.mode !== 'duel' || after.mode !== 'duel' || before.turn !== 'you' ||
      !gameId(before.gameId) || before.gameId !== after.gameId ||
      !count(before.attempts) || after.attempts !== before.attempts + 1 ||
      !count(before.aiAttempts) || after.aiAttempts !== before.aiAttempts ||
      !count(before.score) || !count(before.aiScore) || after.aiScore !== before.aiScore ||
      ![0, POINTS_PER_PAIR].includes(after.score - before.score)) return sample;

  // A hint still assists the next attempt after its visual highlight expires.
  if (sample.hinted) return { ...sample, hinted: false };
  return { attempts: sample.attempts + 1, matches: sample.matches + Number(after.score > before.score), hinted: false };
}

/** Learn once when a complete Realistic duel ends, regardless of who won. */
export function evolveRealisticSkill(value, game) {
  const profile = normalizeRealisticSkill(value);
  if (game?.mode !== 'duel' || game.aiMode !== 'realistic' ||
      !gameId(game.gameId) || game.gameId === profile.lastGameId ||
      !Array.isArray(game.tiles) || game.tiles.length !== TILES_PER_DUEL ||
      !game.tiles.every(tile => tile?.removed === true) ||
      !count(game.score) || !count(game.aiScore) ||
      game.score % POINTS_PER_PAIR !== 0 || game.aiScore % POINTS_PER_PAIR !== 0 ||
      game.score + game.aiScore !== DUEL_TOTAL_SCORE ||
      !count(game.attempts) || !count(game.aiAttempts) ||
      game.attempts < game.score / POINTS_PER_PAIR || game.aiAttempts < game.aiScore / POINTS_PER_PAIR) return profile;

  const sample = normalizeSample(game.realisticSample);
  const enoughEvidence = sample.attempts >= 8 && sample.attempts <= game.attempts && sample.matches <= game.score / POINTS_PER_PAIR;
  const accuracy = enoughEvidence ? sample.matches / sample.attempts : 0;
  const target = clamp((accuracy - 0.10) / 0.65, 0, 1);
  const change = enoughEvidence ? clamp((target - profile.level) * 0.12, -0.035, 0.035) : 0;
  return {
    version: 1,
    level: clamp(profile.level + change, 0, 1),
    completedGames: Math.min(Number.MAX_SAFE_INTEGER, profile.completedGames + 1),
    lastGameId: game.gameId,
  };
}
