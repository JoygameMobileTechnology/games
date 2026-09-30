import { canMatch, isFree, remainingCount } from './engine.js';
import { getDuelOutcome } from './duel.js';
import { PAIRS_PER_DUEL, TILES_PER_DUEL, PAIRS_TO_WIN, POINTS_PER_PAIR, DUEL_TOTAL_SCORE } from './game-balance.js';

export const PAIR_CHAIN_NAMES = Object.freeze(['Double', 'Triple', 'Quadra', 'Sharp', 'Focused', 'Perceptive', 'Intelligent', 'Insightful', 'Astute', 'Brilliant', 'Ingenious', 'Exceptional', 'Masterful', 'Phenomenal']);
export const TURNING_POINTS = Object.freeze({
  turning_lead_five: { name: 'Confident', subtitle: 'Five pairs ahead', variant: 'steady', intensity: 1, duration: 600 },
  turning_recover_four: { name: 'Determined', subtitle: 'Closing the gap', variant: 'recovery', intensity: 1, duration: 650 },
  turning_equalize: { name: 'Balanced', subtitle: 'Scores are level', variant: 'balanced', intensity: 1, duration: 600 },
  turning_comeback_lead: { name: 'Resilient', subtitle: 'Back in the lead', variant: 'recovery', intensity: 2, duration: 800 },
  turning_four_to_win: { name: 'Composed', subtitle: 'Four pairs to victory', variant: 'steady', intensity: 2, duration: 700 },
  turning_draw_only: { name: 'Resolute', subtitle: 'Match the remaining pairs to draw', variant: 'focus', intensity: 2, duration: 800 },
  turning_win_secured: { name: 'Accomplished', subtitle: 'Victory secured', variant: 'victory', intensity: 3, duration: 900 },
  turning_draw_final: { name: 'Admirable', subtitle: 'An evenly matched duel', variant: 'draw', intensity: 3, duration: 900 },
});
const BOOSTER_IDS = ['shuffle', 'hint', 'freeze', 'eagle'];
const safeCount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const pairs = game => ({ you: safeCount(game.score) / POINTS_PER_PAIR, ai: safeCount(game.aiScore) / POINTS_PER_PAIR });
const DRAW_PAIRS = PAIRS_PER_DUEL / 2;
const leader = totals => totals.you === totals.ai ? null : totals.you > totals.ai ? 'you' : 'ai';
const timestamp = now => Number.isFinite(now) ? now : Date.now();
const pairIdentity = ids => JSON.stringify([...ids].sort());
const metadata = tracker => ({ gameId: tracker.gameId, themeId: tracker.themeId, rulesetId: tracker.rulesetId, formationId: tracker.formationId });
const noAttempt = tracker => ({ tracker, event: null, cues: [] });

/** Live only: abandoning or restarting a board discards its tracker, never its earned receipts. */
export function createDuelTracker(game) {
  return { ...metadata({ gameId: game.gameId, themeId: game.theme, rulesetId: game.ruleset, formationId: game.formationId }),
    attemptSequence: safeCount(game.attempts) + safeCount(game.aiAttempts), boosterSequence: 0,
    arrangementVersion: 0, observations: {}, preAttemptObservationSnapshot: null, pendingFlips: [],
    liveTileIds: game.tiles.filter(tile => !tile.removed).map(tile => tile.id),
    chain: 0, localMismatches: 0, rememberedPairs: 0, matchedFaceCopies: {},
    firstScorer: null, lastNonTiedLeader: leader(pairs(game)), leadChanges: 0, maxDeficit: 0, everTrailed: false,
    securedWinner: null, winningSnapshot: null, turningLatches: {},
    boosterUseCount: 0, boosterTypes: [], boosterReceipts: {}, hintMarker: null, freezeWindow: null, shuffleWindow: null,
  };
}

/** Call only after an ordinary flip is accepted, for either actor; Hint/Eagle never call this. */
export function observeFlip(tracker, tileId) {
  if (!tracker || !tracker.liveTileIds.includes(tileId) || tracker.pendingFlips.includes(tileId)) return tracker;
  return { ...tracker,
    preAttemptObservationSnapshot: tracker.preAttemptObservationSnapshot ?? { ...tracker.observations },
    pendingFlips: [...tracker.pendingFlips, tileId],
    observations: { ...tracker.observations, [tileId]: { arrangementVersion: tracker.arrangementVersion, attemptSequence: tracker.attemptSequence + 1 } },
  };
}

/** Both shuffle types invalidate positional evidence; neither resets a local pair chain. */
export function trackAutomaticShuffle(tracker) {
  return { ...tracker, arrangementVersion: tracker.arrangementVersion + 1, observations: {},
    preAttemptObservationSnapshot: null, pendingFlips: [], hintMarker: null, shuffleWindow: null };
}

export function trackBooster(tracker, before, after, boosterId) {
  if (!tracker || !BOOSTER_IDS.includes(boosterId) || before === after || before.turn !== 'you' ||
      before.gameId !== tracker.gameId || after.gameId !== tracker.gameId ||
      !Number.isSafeInteger(before.boosters?.[boosterId]) || before.boosters[boosterId] < 1 ||
      after.boosters?.[boosterId] !== before.boosters[boosterId] - 1) return { tracker, event: null };
  // Inventory only decreases during a duel. This rejects a replay of the same activation.
  const receipt = `${boosterId}:${before.boosters[boosterId]}`;
  if (tracker.boosterReceipts[receipt]) return { tracker, event: null };
  let next = boosterId === 'shuffle' ? trackAutomaticShuffle(tracker) : tracker;
  const sequence = tracker.boosterSequence + 1;
  const eventId = `${tracker.gameId}:booster:${boosterId}:${before.boosters[boosterId]}`;
  next = { ...next, boosterSequence: sequence, boosterUseCount: tracker.boosterUseCount + 1,
    boosterTypes: [...new Set([...tracker.boosterTypes, boosterId])], boosterReceipts: { ...tracker.boosterReceipts, [receipt]: true } };
  if (boosterId === 'hint') next.hintMarker = { eventId, ids: [...(after.hintEffect?.ids || [])].sort(), arrangementVersion: next.arrangementVersion };
  if (boosterId === 'shuffle') next.shuffleWindow = { eventId, run: 0 };
  return { tracker: next, event: { type: 'booster', ...metadata(next), eventId, boosterSequence: sequence, boosterId,
    arrangementVersion: next.arrangementVersion, now: Date.now(), counterDeltas: {}, counterMaxima: {} } };
}

function chainCue(count, eventId) {
  if (count < 2) return null;
  const tier = Math.min(count, 15);
  const durations = [460, 500, 540, 570, 600, 625, 650, 690, 725, 760, 800, 830, 865, 900];
  return { id: `chain_${String(tier).padStart(2, '0')}`, eventId: `${eventId}:chain`, actor: 'you', owner: 'you',
    family: 'chain', name: PAIR_CHAIN_NAMES[tier - 2], count, intensity: (tier - 2) / 13,
    duration: count > 15 ? 450 : durations[tier - 2], peak: count === 15, reinforcement: count > 15 };
}
function turningCue(id, eventId) {
  return { ...TURNING_POINTS[id], id, eventId: `${eventId}:${id}`, actor: 'you', owner: 'you', family: 'turning' };
}
function winningFacts(tracker, afterPairs) {
  const conditionalWins = {
    noBoosters: tracker.boosterUseCount === 0,
    noMismatch: tracker.localMismatches === 0,
    recoverFive: tracker.maxDeficit >= 5,
    recoverTen: tracker.maxDeficit >= 10,
    closeFinish: afterPairs.ai === PAIRS_PER_DUEL - PAIRS_TO_WIN,
    chainFinishFive: tracker.chain >= 5,
    frontRunner: tracker.firstScorer === 'you' && !tracker.everTrailed,
    opponentFirst: tracker.firstScorer === 'ai',
    threeLeadChanges: tracker.leadChanges >= 3,
    atMostTwoMisses: tracker.localMismatches <= 2,
    exactlyOneBooster: tracker.boosterUseCount === 1,
    allFourBoosters: BOOSTER_IDS.every(id => tracker.boosterTypes.includes(id)),
  };
  return { atAttempt: tracker.attemptSequence, pairs: afterPairs, chain: tracker.chain,
    localMismatches: tracker.localMismatches, maxDeficit: tracker.maxDeficit, firstScorer: tracker.firstScorer,
    everTrailed: tracker.everTrailed, leadChanges: tracker.leadChanges, boosterUseCount: tracker.boosterUseCount,
    boosterTypes: [...tracker.boosterTypes], conditionalWins };
}
function followRun(window, matched, deltas, prefix) {
  if (!window || !matched) return null;
  const run = window.run + 1;
  if (run === 1) deltas[`${prefix}ImmediateMatch`] = 1;
  if (run === 3) { deltas[`${prefix}ThreePairRun`] = 1; return null; }
  return { ...window, run };
}

/** Receives the authoritative before/after reducer transition, not a rendered score. */
export function resolveTrackedAttempt(tracker, before, after, ids, { rarity, now } = {}) {
  if (!tracker || before === after || before.mode !== 'duel' || before.gameId !== tracker.gameId || after.gameId !== tracker.gameId ||
      !['you', 'ai'].includes(before.turn) || !Array.isArray(ids) || ids.length !== 2 || ids[0] === ids[1]) return noAttempt(tracker);
  const sequence = safeCount(before.attempts) + safeCount(before.aiAttempts) + 1;
  const actor = before.turn, attemptKey = actor === 'you' ? 'attempts' : 'aiAttempts';
  if (sequence !== tracker.attemptSequence + 1 || after[attemptKey] !== before[attemptKey] + 1 ||
      safeCount(after.attempts) + safeCount(after.aiAttempts) !== sequence) return noAttempt(tracker);
  const tiles = ids.map(id => before.tiles.find(tile => tile.id === id));
  if (!tiles.every(tile => isFree(tile, before.tiles))) return noAttempt(tracker);
  const matched = canMatch(...tiles), beforePairs = pairs(before), afterPairs = pairs(after);
  if (afterPairs[actor] !== beforePairs[actor] + Number(matched) || afterPairs[actor === 'you' ? 'ai' : 'you'] !== beforePairs[actor === 'you' ? 'ai' : 'you'] ||
      (matched && !ids.every(id => after.tiles.find(tile => tile.id === id)?.removed))) return noAttempt(tracker);
  // The transition itself is proof of the accepted flips, even if a caller missed a visual callback.
  const observed = ids.reduce((value, id) => observeFlip(value, id), tracker);
  const evidence = observed.preAttemptObservationSnapshot || {};
  const eventId = `${tracker.gameId}:attempt:${sequence}`;
  const counterDeltas = {}, counterMaxima = {}, cues = [];
  let next = { ...observed, attemptSequence: sequence, preAttemptObservationSnapshot: null, pendingFlips: [],
    liveTileIds: after.tiles.filter(tile => !tile.removed).map(tile => tile.id), turningLatches: { ...tracker.turningLatches } };
  if (matched) next.observations = Object.fromEntries(Object.entries(next.observations).filter(([id]) => !ids.includes(id)));
  const validEvidence = ids.map(id => evidence[id]?.arrangementVersion === tracker.arrangementVersion ? evidence[id] : null);
  if (actor === 'you') {
    next.chain = matched ? tracker.chain + 1 : 0;
    if (!matched) next.localMismatches += 1;
    if (matched) {
      counterMaxima.bestPairChain = next.chain;
      if (validEvidence.every(Boolean)) {
        counterDeltas.rememberedPairs = 1;
        next.rememberedPairs += 1;
        counterMaxima.maxRememberedPairsInDuel = next.rememberedPairs;
        if (validEvidence.every(value => sequence - value.attemptSequence - 1 >= 3)) counterDeltas.delayedRecallPairs = 1;
      } else if (validEvidence.every(value => !value)) counterDeltas.pairsWithNeitherFacePreviouslyObserved = 1;
      if (tracker.lastAttempt?.actor === 'ai' && !tracker.lastAttempt.matched) counterDeltas.matchesImmediatelyAfterOpponentMiss = 1;
      if (tracker.lastLocalAttempt?.matched === false) counterDeltas.matchesAfterOwnPreviousAttemptMissed = 1;
      const key = tiles[0].matchKey;
      next.matchedFaceCopies = { ...tracker.matchedFaceCopies, [key]: [...new Set([...(tracker.matchedFaceCopies[key] || []), ...ids])] };
      counterMaxima.maxDistinctMatchedFaceKeysInDuel = Object.keys(next.matchedFaceCopies).length;
      counterMaxima.maxFullyCollectedFaceKeysInDuel = Object.values(next.matchedFaceCopies).filter(copies => copies.length === 4).length;
      if (before.eagleMs > 0) {
        counterDeltas.matchedPairsDuringEagleEye = 1;
        if ((typeof rarity === 'string' ? rarity : rarity?.id) === 'gold') counterDeltas.goldOrCelestialPairsDuringEagleEye = 1;
      }
      const cue = chainCue(next.chain, eventId); if (cue) cues.push(cue);
    }
    if (tracker.hintMarker && matched && tracker.hintMarker.arrangementVersion === tracker.arrangementVersion && pairIdentity(tracker.hintMarker.ids) === pairIdentity(ids)) counterDeltas.successfullyFollowedHints = 1;
    next.hintMarker = null;
    next.freezeWindow = followRun(tracker.freezeWindow, matched, counterDeltas, 'freezeSavesFollowedBy');
    next.shuffleWindow = followRun(tracker.shuffleWindow, matched, counterDeltas, 'paidShufflesFollowedBy');
    if (!matched && before.freezeReady && !after.freezeReady) next.freezeWindow = { eventId, run: 0 };
    next.lastLocalAttempt = { matched, attemptSequence: sequence };
  }
  next.lastAttempt = { actor, matched, attemptSequence: sequence };
  if (matched) {
    const previousLeader = tracker.lastNonTiedLeader;
    const afterLeader = leader(afterPairs);
    const changedLeader = Boolean(previousLeader && afterLeader && previousLeader !== afterLeader);
    if (!afterLeader || changedLeader) { next.turningLatches.turning_lead_five = false; next.turningLatches.turning_recover_four = false; }
    if (afterLeader) next.lastNonTiedLeader = afterLeader;
    const alreadySecured = tracker.securedWinner || beforePairs.you >= PAIRS_TO_WIN || beforePairs.ai >= PAIRS_TO_WIN;
    if (!alreadySecured) {
      if (!tracker.firstScorer && beforePairs.you + beforePairs.ai === 0) next.firstScorer = actor;
      next.leadChanges += Number(changedLeader);
      next.maxDeficit = Math.max(tracker.maxDeficit, beforePairs.ai - beforePairs.you, afterPairs.ai - afterPairs.you);
      next.everTrailed = tracker.everTrailed || beforePairs.you < beforePairs.ai || afterPairs.you < afterPairs.ai;
      const trigger = id => {
        if (next.turningLatches[id]) return;
        cues.push(turningCue(id, eventId)); next.turningLatches[id] = true;
      };
      // Equality and comeback cues can recur in later lead episodes.
      if (actor === 'you' && beforePairs.you < beforePairs.ai && afterPairs.you === afterPairs.ai && afterPairs.you !== DRAW_PAIRS) cues.push(turningCue('turning_equalize', eventId));
      if (actor === 'you' && beforePairs.you === beforePairs.ai && afterPairs.you > afterPairs.ai && previousLeader === 'ai') cues.push(turningCue('turning_comeback_lead', eventId));
      if (afterPairs.you >= PAIRS_TO_WIN) {
        next.securedWinner = 'you'; next.winningSnapshot = winningFacts(next, afterPairs);
        // Terminal feedback takes over comparative cues at this boundary.
        cues.splice(0, cues.length, ...cues.filter(cue => cue.family === 'chain'));
        trigger('turning_win_secured');
      } else if (afterPairs.ai >= PAIRS_TO_WIN) {
        next.securedWinner = 'ai';
      } else if (afterPairs.you === DRAW_PAIRS && afterPairs.ai === DRAW_PAIRS && remainingCount(after.tiles) === 0) {
        trigger('turning_draw_final');
      } else {
        if (actor === 'you' && beforePairs.you - beforePairs.ai === 4 && afterPairs.you - afterPairs.ai === 5) trigger('turning_lead_five');
        if (actor === 'you' && beforePairs.ai - beforePairs.you === 5 && afterPairs.ai - afterPairs.you === 4) trigger('turning_recover_four');
        if (actor === 'you' && beforePairs.you < PAIRS_TO_WIN - 4 && afterPairs.you === PAIRS_TO_WIN - 4 && afterPairs.ai < DRAW_PAIRS) trigger('turning_four_to_win');
        if (beforePairs.ai < DRAW_PAIRS && afterPairs.ai === DRAW_PAIRS && afterPairs.you < DRAW_PAIRS) trigger('turning_draw_only');
      }
    }
  }
  const event = { type: 'attempt', ...metadata(next), eventId, attemptSequence: sequence, actor, matched,
    physicalTileIds: [...ids], matchKey: matched ? tiles[0].matchKey : null,
    rarity: matched ? (typeof rarity === 'string' ? rarity : rarity?.id) || null : null,
    beforePairs, afterPairs, arrangementVersion: tracker.arrangementVersion,
    preAttemptObservationSnapshot: { ...evidence },
    boosterState: { inventory: { ...before.boosters }, eagleMs: Math.max(0, Number(before.eagleMs) || 0),
      freezeReady: Boolean(before.freezeReady), freezeConsumed: Boolean(!matched && actor === 'you' && before.freezeReady && !after.freezeReady),
      hintPhysicalTileIds: tracker.hintMarker ? [...tracker.hintMarker.ids] : [] },
    now: timestamp(now), counterDeltas, counterMaxima };
  return { tracker: next, event, cues };
}

/** Repeated calls intentionally return the same receipt identity; the durable reducer commits once. */
export function completedDuelEvent(tracker, game, outcome, now) {
  if (!tracker || tracker.gameId !== game?.gameId || game.tiles?.length !== TILES_PER_DUEL || remainingCount(game.tiles) !== 0 ||
      game.score + game.aiScore !== DUEL_TOTAL_SCORE || getDuelOutcome(game) !== outcome || !['win', 'lose', 'tie'].includes(outcome)) return null;
  return { type: 'complete', ...metadata(tracker), eventId: `${tracker.gameId}:complete`, outcome, now: timestamp(now),
    afterPairs: pairs(game), winningSnapshot: tracker.winningSnapshot,
    conditionalWins: outcome === 'win' ? { ...tracker.winningSnapshot?.conditionalWins } : {}, counterDeltas: {}, counterMaxima: {} };
}

export function coalesceStreakCues(cues = []) {
  const priority = cue => ['turning_win_secured', 'turning_draw_final'].includes(cue.id) ? 100 : cue.id === 'turning_draw_only' ? 90 : cue.id === 'turning_comeback_lead' ? 80 : cue.family === 'chain' ? 60 : 40;
  return cues.filter(cue => cue && cue.actor === 'you' && cue.owner === 'you' && (cue.family === 'chain' || TURNING_POINTS[cue.id]))
    .filter((cue, index, all) => all.findIndex(other => other.eventId === cue.eventId) === index)
    .sort((first, second) => priority(second) - priority(first)).slice(0, 2);
}
