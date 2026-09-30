import { isFree } from './engine.js';

export const REALISTIC_AI_VERSION = 1;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
const attemptIndex = game => (game.attempts || 0) + (game.aiAttempts || 0);
const STREAM = {
  match: 0xa341316c,
  focus: 0xc8013ea4,
  firstRecall: 0xad90777d,
  secondRecall: 0x7e95761e,
  firstTiming: 0x9e3779b9,
  secondTiming: 0x85ebca6b,
  forgetting: 0x165667b1,
};

function randomStream(seed, domain, index = 0) {
  let state = ((seed >>> 0) ^ domain ^ Math.imul(index, 0x6c8e9cf5)) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function validateSeed(seed) {
  if (!Number.isInteger(seed) || !Number.isFinite(seed)) throw new TypeError('A Realistic AI seed must be a finite integer.');
}

function validateTurn(turnIndex) {
  if (!Number.isInteger(turnIndex) || turnIndex < 0) throw new TypeError('A Realistic AI turn index must be a non-negative integer.');
}

/** The long-term skill stays fixed for this match; form is unrelated to winning. */
export function createRealisticState(seed, skillLevel = 0.5) {
  validateSeed(seed);
  const random = randomStream(seed, STREAM.match);
  return {
    version: REALISTIC_AI_VERSION,
    seed: seed >>> 0,
    skillLevel: clamp(finiteOr(skillLevel, 0.5), 0, 1),
    matchForm: (random() * 2 - 1) * 0.16,
    focus: (random() * 2 - 1) * 0.06,
    formStep: 0,
  };
}

function usableState(state, seed = 0) {
  if (!state || state.version !== REALISTIC_AI_VERSION) return createRealisticState(seed);
  return {
    version: REALISTIC_AI_VERSION,
    seed: Number.isInteger(state.seed) ? state.seed >>> 0 : seed >>> 0,
    skillLevel: clamp(finiteOr(state.skillLevel, 0.5), 0, 1),
    matchForm: clamp(finiteOr(state.matchForm, 0), -0.16, 0.16),
    focus: clamp(finiteOr(state.focus, 0), -0.14, 0.14),
    formStep: Number.isInteger(state.formStep) && state.formStep >= 0 ? state.formStep : 0,
  };
}

/** Public tuning information, also used by memory and both decision phases. */
export function realisticTuning(state) {
  const current = usableState(state);
  const skill = clamp(current.skillLevel + current.matchForm + current.focus, 0, 1);
  return {
    skill,
    pairRecall: 0.3 + 0.6 * skill,
    partnerRecall: 0.45 + 0.5 * skill,
    memoryCapacity: 6 + Math.round(12 * skill),
    memoryLifetime: 4 + Math.round(8 * skill),
    memoryDecay: 0.26 - 0.16 * skill,
  };
}

function liveMemory(tiles, memory, turnIndex, state) {
  validateTurn(turnIndex);
  const tuning = realisticTuning(state);
  const live = new Set(tiles.filter(tile => !tile.removed).map(tile => tile.id));
  // Stable sorting preserves reveal order for equally recent observations.
  const observations = Object.entries(memory ?? {}).filter(([id, observation]) =>
    live.has(id) && observation && typeof observation.key === 'string' && observation.key.length > 0 &&
    Number.isInteger(observation.turn) && observation.turn >= 0 && observation.turn <= turnIndex &&
    turnIndex - observation.turn <= tuning.memoryLifetime,
  ).sort((a, b) => a[1].turn - b[1].turn);
  return Object.fromEntries(observations.slice(-tuning.memoryCapacity));
}

/** This is the only function in this module permitted to read a tile face. */
export function rememberRealisticFaces(tiles, memory = {}, revealedIds = [], turnIndex = 0, state) {
  const observations = new Map(Object.entries(liveMemory(tiles, memory, turnIndex, state)));
  for (const id of revealedIds) {
    const tile = tiles.find(candidate => candidate.id === id && !candidate.removed);
    if (!tile) continue;
    const key = tile.matchKey;
    if (typeof key !== 'string' || !key.length) continue;
    observations.delete(id);
    observations.set(id, { key, turn: turnIndex });
  }
  return liveMemory(tiles, Object.fromEntries(observations), turnIndex, state);
}

/** Applied once per completed attempt by either player; never reads tile faces. */
export function decayRealisticMemory(tiles, memory = {}, seed = 0, turnIndex = 0, state) {
  validateSeed(seed);
  const random = randomStream(seed, STREAM.forgetting, turnIndex);
  const { memoryDecay } = realisticTuning(state);
  return Object.fromEntries(Object.entries(liveMemory(tiles, memory, turnIndex, state))
    .filter(() => random() >= memoryDecay));
}

function knownPairs(available, knowledge) {
  const pairs = [];
  for (let i = 0; i < available.length; i++) {
    const firstKey = knowledge[available[i].id]?.key;
    if (!firstKey) continue;
    for (let j = i + 1; j < available.length; j++) {
      if (firstKey === knowledge[available[j].id]?.key) pairs.push([available[i].id, available[j].id]);
    }
  }
  return pairs;
}

const pick = (values, random) => values[Math.floor(random() * values.length)];

function firstDelay(random, skill, recalledPair) {
  let delay = recalledPair ? 650 + random() * 850 + (1 - skill) * 100 : 750 + random() * 900 + (1 - skill) * 150;
  if (random() < 0.07 + (1 - skill) * 0.05) delay += 600 + random() * 400;
  return Math.round(Math.min(2600, delay));
}

function secondDelay(random, recalledPartner) {
  let delay = recalledPartner ? 220 + random() * 330 : 420 + random() * 680;
  if (random() < (recalledPartner ? 0.05 : 0.09)) delay += 300 + random() * 200;
  return Math.round(Math.min(1500, delay));
}

/** Choose only the first tile. The UI must expose it before asking for the second. */
export function planRealisticTurn(game) {
  const state = usableState(game.realisticState, game.seed);
  const turnIndex = attemptIndex(game);
  const knowledge = liveMemory(game.tiles, game.aiMemory, turnIndex, state);
  const available = game.tiles.filter(tile => isFree(tile, game.tiles));
  const base = { state, turnIndex, firstId: null, rememberedSecondId: null, recalledPair: false, thinkMs: 0 };
  if (available.length < 2) return { ...base, needsShuffle: game.tiles.some(tile => !tile.removed) };

  const tuning = realisticTuning(state);
  const random = randomStream(state.seed, STREAM.firstRecall, turnIndex);
  const timing = randomStream(state.seed, STREAM.firstTiming, turnIndex);
  const pairs = knownPairs(available, knowledge);
  let firstId, rememberedSecondId = null;
  const recalledPair = pairs.length > 0 && random() < tuning.pairRecall;
  if (recalledPair) {
    const pair = pick(pairs, random);
    [firstId, rememberedSecondId] = random() < 0.5 ? pair : [pair[1], pair[0]];
  } else {
    // Failed pair recall guesses from every legal tile. With no remembered pair,
    // exploration sometimes favors positions whose identities are not retained.
    const unseen = available.filter(tile => !Object.hasOwn(knowledge, tile.id));
    const candidates = !pairs.length && unseen.length && random() < 0.65 ? unseen : available;
    firstId = pick(candidates, random).id;
  }
  return {
    ...base, firstId, rememberedSecondId, recalledPair,
    thinkMs: firstDelay(timing, tuning.skill, recalledPair),
    needsShuffle: false,
  };
}

/** The freshly visible first face must already be in game.aiMemory. */
export function chooseRealisticSecond(game, plan) {
  const state = usableState(game.realisticState ?? plan.state, game.seed);
  const turnIndex = attemptIndex(game);
  const knowledge = liveMemory(game.tiles, game.aiMemory, turnIndex, state);
  const available = game.tiles.filter(tile => isFree(tile, game.tiles));
  if (plan.turnIndex !== turnIndex || !available.some(tile => tile.id === plan.firstId)) {
    return { secondId: null, delayMs: 0, recalledPartner: false };
  }
  const others = available.filter(tile => tile.id !== plan.firstId);
  if (!others.length) return { secondId: null, delayMs: 0, recalledPartner: false };
  const random = randomStream(state.seed, STREAM.secondRecall, turnIndex);
  const timing = randomStream(state.seed, STREAM.secondTiming, turnIndex);
  const firstKey = knowledge[plan.firstId]?.key;
  const partners = firstKey ? others.filter(tile => knowledge[tile.id]?.key === firstKey) : [];
  const plannedPartner = plan.recalledPair && partners.find(tile => tile.id === plan.rememberedSecondId);
  const recalledPartner = Boolean(plannedPartner || (partners.length && random() < realisticTuning(state).partnerRecall));
  // A failed recall includes every legal alternative, including accidental matches.
  const second = plannedPartner || pick(recalledPartner ? partners : others, random);
  return { secondId: second.id, delayMs: secondDelay(timing, recalledPartner), recalledPartner };
}

/** A correlated, outcome-independent change in attention after an AI attempt. */
export function advanceRealisticState(game, before) {
  const state = usableState(game.realisticState, game.seed);
  if ((game.aiAttempts || 0) !== (before.aiAttempts || 0) + 1) return state;
  const random = randomStream(state.seed, STREAM.focus, state.formStep + 1);
  return {
    ...state,
    focus: clamp(0.84 * state.focus + (random() * 2 - 1) * 0.045, -0.14, 0.14),
    formStep: state.formStep + 1,
  };
}
