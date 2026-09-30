import { ACHIEVEMENTS, ACHIEVEMENT_REWARDS_VERSION, isAchievementId, NUMERIC_COUNTER_KEYS, SET_COUNTER_KEYS, evaluateAchievements } from './achievements.js';
import { normalizeCollection, createCollection, awardCollectedPair, collectionPairId, loadCollection, saveCollection } from './collection.js';
import { themeTileSets } from './tile-data.js';
import { launchThemeIds } from './themes.js';
import { FORMATIONS } from './formations.js';
import { rarityForTile, RARITIES } from './rarity.js';
import { BOOSTER_IDS } from './boosters.js';
import { createDailyState, normalizeDaily, normalizeWallet, emptyWallet, applyDailyEvent, dayIdFor, validDayId, validEventId, validTimestamp, timestampOf } from './daily-rewards.js';
import { createRanking, normalizeRanking, advanceRanking, LEAGUES } from './leaderboards.js';
import { DUEL_COIN_REWARDS, STARTER_BOOSTERS, STARTER_BOOSTER_VERSION, SHOP_CURRENCY_PACKS, emptyCurrencies, normalizeCurrencies, addCurrencies, buyBoosterPack } from './economy.js';
import { createDailyQuestState, normalizeDailyQuests, ensureDailyQuests, applyDailyQuestEvent, recordDailyQuestGameplay } from './daily-quests.js';
import { PAIRS_PER_DUEL } from './game-balance.js';

export const PROGRESSION_VERSION = 1;
export const PROGRESSION_STORAGE_KEY = 'porcelain:progression';
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const safeCount = value => Number.isSafeInteger(value) && value >= 0;
const formations = new Set(FORMATIONS.map(item => item.id));
const rulesets = new Set(['eastern', 'western']);
const rarityIds = new Set(RARITIES.map(item => item.id));
const launchFaces = new Map(launchThemeIds.flatMap(themeId => Object.entries(themeTileSets[themeId]).flatMap(([rulesetId, tiles]) =>
  tiles.map(tile => [tile.matchKey, { ...tile, themeId, rulesetId, rarityId: rarityForTile(themeId, rulesetId, tile.id).id }]))));
const collectionCounterKeys = ['distinctCollectedMatchKeys', 'maxCollectionCountForOneMatchKey', 'distinctCollectedRarityIds', ...launchThemeIds.map(id => `distinctCollectedMatchKeysByTheme.${id}`)];
const backfillIds = ACHIEVEMENTS.filter(item => collectionCounterKeys.includes(item.counterKey)).map(item => item.id);
const maximaKeys = new Set(['bestPairChain', 'maxRememberedPairsInDuel', 'maxFullyCollectedFaceKeysInDuel', 'maxDistinctMatchedFaceKeysInDuel']);
const attemptDeltaKeys = new Set(NUMERIC_COUNTER_KEYS.filter(key => !key.startsWith('conditionalWins.') && !maximaKeys.has(key) && !['completedDuels', 'completedWins', 'personalPairs', 'maxCollectionCountForOneMatchKey'].includes(key)));
const conditionalKeys = NUMERIC_COUNTER_KEYS.filter(key => key.startsWith('conditionalWins.'));
const bump = (value, amount = 1) => Math.min(Number.MAX_SAFE_INTEGER, value + amount);
function freshSeed() {
  try { return globalThis.crypto.getRandomValues(new Uint32Array(1))[0]; } catch { return Math.floor(Math.random() * 0x100000000); }
}
const starterReceipt = `starter-boosters:v${STARTER_BOOSTER_VERSION}`;
const starterSeenReceipt = `${starterReceipt}:seen`;
export function hasStarterNotice(state) {
  return Object.hasOwn(state.eventReceipts, starterReceipt) && !Object.hasOwn(state.eventReceipts, starterSeenReceipt);
}
function grantStarterBoosters(state, now) {
  if (Object.hasOwn(state.eventReceipts, starterReceipt)) return state;
  return { ...state, wallet: Object.fromEntries(BOOSTER_IDS.map(id => [id, bump(state.wallet[id], STARTER_BOOSTERS[id])])),
    eventReceipts: { ...state.eventReceipts, [starterReceipt]: timestampOf(now) } };
}
export function createProgression({ collection = createCollection(), seed = freshSeed() } = {}) {
  const state = { version: PROGRESSION_VERSION, counters: Object.fromEntries(NUMERIC_COUNTER_KEYS.map(key => [key, 0])),
    sets: Object.fromEntries(SET_COUNTER_KEYS.map(key => [key, []])), unlocked: {}, awardedPoints: {}, achievementRewardsVersion: ACHIEVEMENT_REWARDS_VERSION,
    points: 0, wallet: emptyWallet(), currencies: emptyCurrencies(), purchaseReceipts: {}, quests: createDailyQuestState(),
    collection: normalizeCollection(collection), daily: createDailyState(), ranking: createRanking(seed),
    eventReceipts: {}, attemptCursors: {}, completedGameIds: [], pendingRankingPresentation: null, newAchievementIds: [] };
  return grantStarterBoosters(deriveCollectionCounters(state), Date.now());
}
function validSetValue(key, value) {
  if (key === 'distinctCollectedMatchKeys') return launchFaces.has(value);
  if (key.startsWith('distinctCollectedMatchKeysByTheme.')) return launchFaces.get(value)?.themeId === key.split('.').at(-1);
  if (key === 'distinctCollectedRarityIds') return rarityIds.has(value);
  if (key === 'distinctCompletedFormationIds') return formations.has(value);
  if (key === 'distinctCompletedRulesetIds') return rulesets.has(value);
  if (key === 'distinctCompletedThemeRulesetCombinations') return launchThemeIds.some(id => [...rulesets].some(rule => value === `${id}:${rule}`));
  if (key === 'distinctLoginDayIds' || key === 'distinctDuelCompletionDayIds') return validDayId(value);
  return false;
}
function mergeCollection(authoritative, legacy) {
  const first = normalizeCollection(authoritative), second = normalizeCollection(legacy);
  const counts = { ...first.counts };
  for (const [key, value] of Object.entries(second.counts)) counts[key] = Math.max(counts[key] ?? 0, value);
  return normalizeCollection({ version: first.version, counts, receipts: { ...second.receipts, ...first.receipts } });
}
function deriveCollectionCounters(state) {
  const entries = Object.entries(state.collection.counts).filter(([key, count]) => count > 0 && launchFaces.has(key));
  const sets = { ...state.sets, distinctCollectedMatchKeys: entries.map(([key]) => key),
    distinctCollectedRarityIds: [...new Set(entries.map(([key]) => launchFaces.get(key).rarityId))] };
  for (const id of launchThemeIds) sets[`distinctCollectedMatchKeysByTheme.${id}`] = entries.filter(([key]) => launchFaces.get(key).themeId === id).map(([key]) => key);
  return { ...state, sets, counters: { ...state.counters, maxCollectionCountForOneMatchKey: Math.max(0, ...entries.map(([, count]) => count)) } };
}
function awardAchievements(state, now, allowedIds) {
  const evaluated = evaluateAchievements(state, now, allowedIds);
  return { ...state, unlocked: evaluated.unlocked, awardedPoints: evaluated.awardedPoints, achievementRewardsVersion: evaluated.achievementRewardsVersion, points: evaluated.points,
    newAchievementIds: [...new Set([...state.newAchievementIds, ...evaluated.newlyUnlocked])] };
}
function normalizePresentation(value, completedGameIds) {
  if (!record(value) || !validEventId(value.gameId) || !completedGameIds.includes(value.gameId) || !['win', 'lose', 'tie'].includes(value.outcome) ||
      !Number.isSafeInteger(value.position) || value.position < 1 || value.position > 10000 || !Number.isSafeInteger(value.previousPosition) || value.previousPosition < value.position || value.previousPosition > 10000 ||
      !LEAGUES.some(item => item.id === value.leagueId) || !LEAGUES.some(item => item.id === value.previousLeagueId)) return null;
  return { eventId: validEventId(value.eventId) ? value.eventId : `complete:${value.gameId}`, gameId: value.gameId, outcome: value.outcome,
    position: value.position, previousPosition: value.previousPosition, leagueId: value.leagueId, previousLeagueId: value.previousLeagueId,
    improved: value.position < value.previousPosition, promoted: value.leagueId !== value.previousLeagueId,
    wins: safeCount(value.wins) ? value.wins : 0, newAchievementIds: [...new Set((Array.isArray(value.newAchievementIds) ? value.newAchievementIds : []).filter(isAchievementId))] };
}
export function normalizeProgression(value, { collection, now = Date.now(), cold = false } = {}) {
  const compatible = value?.version === PROGRESSION_VERSION;
  let state = createProgression({ collection: mergeCollection(compatible ? value.collection : null, collection), seed: compatible && safeCount(value.ranking?.seed) ? value.ranking.seed : freshSeed() });
  if (compatible) {
    for (const key of NUMERIC_COUNTER_KEYS) if (safeCount(value.counters?.[key])) state.counters[key] = value.counters[key];
    for (const key of SET_COUNTER_KEYS) state.sets[key] = [...new Set((Array.isArray(value.sets?.[key]) ? value.sets[key] : []).filter(item => validSetValue(key, item)))];
    state.unlocked = Object.fromEntries(Object.entries(record(value.unlocked) ? value.unlocked : {}).filter(([id, timestamp]) => isAchievementId(id) && validTimestamp(timestamp)));
    state.awardedPoints = record(value.awardedPoints) ? value.awardedPoints : {};
    state.wallet = normalizeWallet(value.wallet);
    state.currencies = normalizeCurrencies(value.currencies);
    state.quests = normalizeDailyQuests(value.quests, { cold });
    state.purchaseReceipts = Object.fromEntries(Object.entries(record(value.purchaseReceipts) ? value.purchaseReceipts : {}).filter(([id, item]) =>
      validEventId(id) && validEventId(item?.eventId) && validTimestamp(item?.at) && SHOP_CURRENCY_PACKS.some(pack => pack.id === item?.productId))
      .map(([id, item]) => [id, { productId: item.productId, eventId: item.eventId, at: item.at }]));
    state.daily = normalizeDaily(value.daily);
    if (cold) {
      state.daily.adAttempts = Object.fromEntries(Object.entries(state.daily.adAttempts).map(([id, attempt]) =>
        [id, attempt.status === 'pending' ? { ...attempt, status: 'failed' } : attempt]));
      state.daily.activeAdAttemptId = null;
    }
    state.sets.distinctLoginDayIds = [...state.daily.loginDayIds];
    state.eventReceipts = Object.fromEntries(Object.entries(record(value.eventReceipts) ? value.eventReceipts : {}).filter(([id, timestamp]) => validEventId(id) && validTimestamp(timestamp)));
    state.attemptCursors = Object.fromEntries(Object.entries(record(value.attemptCursors) ? value.attemptCursors : {}).filter(([id, sequence]) => validEventId(id) && Number.isSafeInteger(sequence) && sequence > 0));
    state.completedGameIds = [...new Set((Array.isArray(value.completedGameIds) ? value.completedGameIds : []).filter(validEventId))];
    state.newAchievementIds = [...new Set((Array.isArray(value.newAchievementIds) ? value.newAchievementIds : []).filter(id => isAchievementId(id) && Object.hasOwn(state.unlocked, id)))];
    state.ranking = normalizeRanking(value.ranking, state.counters.completedWins, state.ranking.seed);
    state.pendingRankingPresentation = cold ? null : normalizePresentation(value.pendingRankingPresentation, state.completedGameIds);
  }
  state = grantStarterBoosters(deriveCollectionCounters(state), now);
  state.quests = ensureDailyQuests(state.quests, now, state.ranking.seed);
  return awardAchievements(state, timestampOf(now), compatible ? undefined : backfillIds);
}
export function loadProgression({ collection, storage, now = Date.now() } = {}) {
  let value, target = storage;
  try {
    target ??= globalThis.localStorage;
    value = JSON.parse(target?.getItem(PROGRESSION_STORAGE_KEY) ?? 'null');
  } catch { /* Missing or blocked browser storage starts an honest local profile. */ }
  // Recover the existing binder even when the separate progression JSON is damaged.
  collection ??= loadCollection(target);
  return normalizeProgression(value, { collection, now, cold: true });
}
/** Commit the envelope first. A stale legacy mirror can safely retry without adding pairs. */
export function saveProgression(state, storage) {
  if (state?.version !== PROGRESSION_VERSION) return false;
  try {
    const target = storage ?? globalThis.localStorage;
    if (!target) return false;
    target.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(state));
    saveCollection(state.collection, target);
    return true;
  } catch { return false; }
}
function validContext(event) { return validEventId(event.gameId) && launchThemeIds.includes(event.themeId) && rulesets.has(event.rulesetId) && formations.has(event.formationId); }
function validPairs(value) { return record(value) && ['you', 'ai'].every(actor => safeCount(value[actor]) && value[actor] <= PAIRS_PER_DUEL) && value.you + value.ai <= PAIRS_PER_DUEL; }
function countersValid(values, allowed) { return values == null || record(values) && Object.entries(values).every(([key, value]) => allowed.has(key) && safeCount(value)); }
function receipt(state, event, now) { return { ...state, eventReceipts: { ...state.eventReceipts, [event.eventId]: now } }; }
function unique(values, item) { return values.includes(item) ? values : [...values, item]; }

/** Authoritative transitions only: no storage, sounds or other effects occur here. */
export function reduceProgression(state, event) {
  if (state?.version !== PROGRESSION_VERSION || !record(event)) return state;
  const now = timestampOf(event.now);
  if (['daily-ad-start', 'quest-ad-start'].includes(event.type) &&
      [state.daily.adAttempts, state.quests.adAttempts].some(attempts => Object.values(attempts ?? {}).some(attempt => attempt.status === 'pending'))) return state;
  if (event.type === 'achievements-seen') {
    const seen = new Set((Array.isArray(event.ids) ? event.ids : []).filter(isAchievementId));
    const remaining = state.newAchievementIds.filter(id => !seen.has(id));
    return remaining.length === state.newAchievementIds.length ? state : { ...state, newAchievementIds: remaining };
  }
  if (event.type === 'starter-seen') return hasStarterNotice(state) ? { ...state, eventReceipts: { ...state.eventReceipts, [starterSeenReceipt]: now } } : state;
  if (event.type === 'ranking-presented') return consumeRankingPresentation(state);
  if (['quests-presented', 'quest-claim', 'quest-reroll', 'quest-ad-start', 'quest-ad-complete'].includes(event.type)) {
    if (event.type !== 'quests-presented' && (!validEventId(event.eventId) || Object.hasOwn(state.eventReceipts, event.eventId))) return state;
    const result = applyDailyQuestEvent(state.quests, event, state.ranking.seed);
    if (!result.accepted) return state;
    let next = { ...state, quests: result.quests, currencies: addCurrencies(state.currencies, result.grants) };
    if (validEventId(event.eventId)) next = receipt(next, event, now);
    return next;
  }
  if (['shop-buy', 'shop-purchase-simulated'].includes(event.type)) {
    if (!validEventId(event.eventId) || Object.hasOwn(state.eventReceipts, event.eventId)) return state;
    if (event.type === 'shop-buy') {
      const exchange = buyBoosterPack(state.currencies, state.wallet, event.productId, event.payment);
      return exchange ? receipt({ ...state, ...exchange }, event, now) : state;
    }
    // Testing adapter only. The UI explicitly confirms that no payment is taken.
    const pack = SHOP_CURRENCY_PACKS.find(item => item.id === event.productId);
    if (!pack || !validEventId(event.transactionId) || Object.hasOwn(state.purchaseReceipts ?? {}, event.transactionId)) return state;
    const currencies = normalizeCurrencies(state.currencies);
    if (['coins', 'gems'].some(id => !Number.isSafeInteger(currencies[id] + pack.grants[id]))) return state;
    return receipt({ ...state, currencies: addCurrencies(currencies, pack.grants),
      purchaseReceipts: { ...state.purchaseReceipts, [event.transactionId]: { productId: pack.id, eventId: event.eventId, at: now } } }, event, now);
  }
  if (['login', 'daily-presented', 'daily-claim', 'daily-ad-start', 'daily-ad-complete'].includes(event.type)) {
    if (!['login', 'daily-presented'].includes(event.type) && (!validEventId(event.eventId) || Object.hasOwn(state.eventReceipts, event.eventId))) return state;
    const result = applyDailyEvent(state.daily, event);
    const quests = event.type === 'login' ? ensureDailyQuests(state.quests, now, state.ranking.seed) : state.quests;
    if (result.daily === state.daily && quests === state.quests) return state;
    const wallet = Object.fromEntries(BOOSTER_IDS.map(id => [id, bump(state.wallet[id], result.grants[id])]));
    let next = { ...state, daily: result.daily, wallet, currencies: addCurrencies(state.currencies, { coins: result.grants.coins }), quests, sets: { ...state.sets, distinctLoginDayIds: [...result.daily.loginDayIds] } };
    if (validEventId(event.eventId)) next = receipt(next, event, now);
    return awardAchievements(next, now);
  }
  if (!validEventId(event.eventId) || Object.hasOwn(state.eventReceipts, event.eventId) || !validEventId(event.gameId)) return state;
  if (event.type === 'booster') {
    if (event.actor && event.actor !== 'you' || !BOOSTER_IDS.includes(event.boosterId) || state.wallet[event.boosterId] < 1 || state.completedGameIds.includes(event.gameId)) return state;
    return receipt({ ...state, wallet: { ...state.wallet, [event.boosterId]: state.wallet[event.boosterId] - 1 } }, event, now);
  }
  if (event.type === 'attempt') {
    if (!validContext(event) || !['you', 'ai'].includes(event.actor) || typeof event.matched !== 'boolean' ||
        !Number.isSafeInteger(event.attemptSequence) || event.attemptSequence <= (state.attemptCursors[event.gameId] ?? 0) ||
        !collectionPairId(event.physicalTileIds) || !validPairs(event.beforePairs) || !validPairs(event.afterPairs) || state.completedGameIds.includes(event.gameId) ||
        !countersValid(event.counterDeltas, attemptDeltaKeys) || !countersValid(event.counterMaxima, maximaKeys)) return state;
    for (const actor of ['you', 'ai']) if (event.afterPairs[actor] !== event.beforePairs[actor] + Number(event.matched && actor === event.actor)) return state;
    const face = launchFaces.get(event.matchKey);
    if (event.matched && (!face || face.themeId !== event.themeId || face.rulesetId !== event.rulesetId || face.rarityId !== event.rarity)) return state;
    let next = { ...state, attemptCursors: { ...state.attemptCursors, [event.gameId]: event.attemptSequence } };
    if (event.actor === 'you' && event.matched) {
      const collection = awardCollectedPair(state.collection, { gameId: event.gameId, pairId: event.physicalTileIds, matchKey: event.matchKey, actor: 'you' });
      if (collection === state.collection) return state;
      const counters = { ...state.counters, personalPairs: bump(state.counters.personalPairs) };
      for (const [key, value] of Object.entries(event.counterDeltas ?? {})) counters[key] = bump(counters[key], value);
      for (const [key, value] of Object.entries(event.counterMaxima ?? {})) counters[key] = Math.max(counters[key], value);
      next = deriveCollectionCounters({ ...next, collection, counters });
    }
    next.quests = recordDailyQuestGameplay(state.quests, event, state.ranking.seed);
    return awardAchievements(receipt(next, event, now), now);
  }
  if (event.type === 'complete') {
    const finalPairs = event.finalPairs ?? event.afterPairs;
    if (!validContext(event) || !validPairs(finalPairs) || finalPairs.you + finalPairs.ai !== PAIRS_PER_DUEL || state.completedGameIds.includes(event.gameId)) return state;
    const outcome = finalPairs.you > finalPairs.ai ? 'win' : finalPairs.you < finalPairs.ai ? 'lose' : 'tie';
    if (event.outcome !== outcome) return state;
    const counters = { ...state.counters, completedDuels: bump(state.counters.completedDuels), completedWins: bump(state.counters.completedWins, Number(outcome === 'win')) };
    if (outcome === 'win' && record(event.winningSnapshot?.conditionalWins)) {
      for (const key of conditionalKeys) if (event.winningSnapshot.conditionalWins[key.slice('conditionalWins.'.length)] === true) counters[key] = bump(counters[key]);
    }
    const sets = { ...state.sets,
      distinctCompletedFormationIds: unique(state.sets.distinctCompletedFormationIds, event.formationId),
      distinctCompletedRulesetIds: unique(state.sets.distinctCompletedRulesetIds, event.rulesetId),
      distinctCompletedThemeRulesetCombinations: unique(state.sets.distinctCompletedThemeRulesetCombinations, `${event.themeId}:${event.rulesetId}`),
      distinctDuelCompletionDayIds: unique(state.sets.distinctDuelCompletionDayIds, dayIdFor(now)) };
    let next = awardAchievements(receipt({ ...state, counters, sets, completedGameIds: [...state.completedGameIds, event.gameId],
      currencies: addCurrencies(state.currencies, { coins: DUEL_COIN_REWARDS[outcome], gems: 0 }),
      quests: recordDailyQuestGameplay(state.quests, event, state.ranking.seed) }, event, now), now);
    const ranking = advanceRanking(state.ranking, { outcome, wins: counters.completedWins, eventId: event.eventId, gameId: event.gameId, newAchievementIds: next.newAchievementIds });
    return { ...next, ranking: ranking.ranking, pendingRankingPresentation: ranking.presentation };
  }
  return state;
}
export function consumeRankingPresentation(state) {
  return state.pendingRankingPresentation ? { ...state, pendingRankingPresentation: null } : state;
}
