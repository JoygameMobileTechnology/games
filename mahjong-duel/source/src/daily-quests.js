import { dayIdFor, validDayId, validEventId, validTimestamp, timestampOf } from './daily-rewards.js';
import { emptyCurrencies } from './economy.js';

// Provisional balancing estimates, not a promise or a timer imposed on play.
const minutesPerUnit = { pairs: 0.4, attempts: 0.3, opening: 2, unique: 0.6, chain: 2,
  duels: 6, wins: 9, 'rarity:marble': 0.8, 'rarity:sapphire': 2, 'rarity:amethyst': 5, 'rarity:gold': 8 };
const define = (id, title, description, difficulty, target, metric, gems, coins = 0) =>
  Object.freeze({ id, title, description, difficulty, target, metric,
    estimatedMinutes: Math.max(2, Math.ceil(target * (minutesPerUnit[metric] ?? 1.5))),
    reward: Object.freeze({ gems, coins }) });

/** All goals use today's player actions; none requires a locked theme or a booster. */
export const DAILY_QUEST_POOL = Object.freeze([
  define('easy-pairs-3', 'A Gentle Start', 'Match 3 pairs.', 'easy', 3, 'pairs', 0, 20),
  define('easy-pairs-5', 'Five Little Finds', 'Match 5 pairs.', 'easy', 5, 'pairs', 0, 25),
  define('easy-marble-3', 'Marble Moments', 'Match 3 Marble pairs.', 'easy', 3, 'rarity:marble', 0, 20),
  define('easy-sapphire-1', 'A Touch of Blue', 'Match a Sapphire pair.', 'easy', 1, 'rarity:sapphire', 0, 20),
  define('easy-recall-1', 'A Familiar Face', 'Match a pair whose two tiles you have seen before.', 'easy', 1, 'counter:rememberedPairs', 0, 25),
  define('easy-recovery-1', 'Try Again', 'Find a match immediately after your own missed attempt.', 'easy', 1, 'counter:matchesAfterOwnPreviousAttemptMissed', 0, 20),
  define('easy-attempts-6', 'Take Your Time', 'Make 6 two-tile attempts, whether they match or not.', 'easy', 6, 'attempts', 0, 20),
  define('easy-chain-2', 'Two Together', 'Match 2 pairs in a row.', 'easy', 2, 'chain', 0, 25),
  define('easy-variety-3', 'Small Gallery', 'Match 3 different tile artworks.', 'easy', 3, 'unique', 0, 25),
  define('easy-duel-1', 'See It Through', 'Finish a duel, win or lose.', 'easy', 1, 'duels', 0, 40),
  define('easy-opening-1', 'First Find', 'Find your first pair in a duel.', 'easy', 1, 'opening', 0, 20),
  define('medium-pairs-12', 'A Dozen Discoveries', 'Match 12 pairs.', 'medium', 12, 'pairs', 0, 40),
  define('medium-pairs-18', 'Steady Hands', 'Match 18 pairs.', 'medium', 18, 'pairs', 0, 50),
  define('medium-marble-8', 'Marble Collector', 'Match 8 Marble pairs.', 'medium', 8, 'rarity:marble', 0, 40),
  define('medium-sapphire-4', 'Sapphire Seeker', 'Match 4 Sapphire pairs.', 'medium', 4, 'rarity:sapphire', 0, 40),
  define('medium-amethyst-2', 'Violet Treasures', 'Match 2 Amethyst pairs.', 'medium', 2, 'rarity:amethyst', 2, 50),
  define('medium-gold-1', 'Golden Moment', 'Match a Gold pair.', 'medium', 1, 'rarity:gold', 2, 50),
  define('medium-recall-4', 'By Memory', 'Match 4 pairs whose two tiles you have seen before.', 'medium', 4, 'counter:rememberedPairs', 2, 50),
  define('medium-recovery-3', 'Find Your Feet', 'Find a match after your own missed attempt 3 times.', 'medium', 3, 'counter:matchesAfterOwnPreviousAttemptMissed', 0, 40),
  define('medium-chain-4', 'Find Your Flow', 'Match 4 pairs in a row.', 'medium', 4, 'chain', 2, 60),
  define('medium-variety-8', 'Growing Gallery', 'Match 8 different tile artworks.', 'medium', 8, 'unique', 0, 50),
  define('medium-win-1', 'A Worthy Rival', 'Win a completed duel.', 'medium', 1, 'wins', 2, 60),
  define('hard-pairs-35', 'A Full Afternoon', 'Match 35 pairs.', 'hard', 35, 'pairs', 4, 80),
  define('hard-pairs-50', 'Fifty Finds', 'Match 50 pairs.', 'hard', 50, 'pairs', 6, 100),
  define('hard-marble-20', 'Marble Master', 'Match 20 Marble pairs.', 'hard', 20, 'rarity:marble', 4, 80),
  define('hard-sapphire-10', 'Deep Blue', 'Match 10 Sapphire pairs.', 'hard', 10, 'rarity:sapphire', 4, 80),
  define('hard-amethyst-5', 'Amethyst Garden', 'Match 5 Amethyst pairs.', 'hard', 5, 'rarity:amethyst', 4, 90),
  define('hard-gold-3', 'Golden Collection', 'Match 3 Gold pairs.', 'hard', 3, 'rarity:gold', 4, 90),
  define('hard-recall-10', 'A Keen Memory', 'Match 10 pairs whose two tiles you have seen before.', 'hard', 10, 'counter:rememberedPairs', 4, 90),
  define('hard-chain-7', 'Unbroken Focus', 'Match 7 pairs in a row.', 'hard', 7, 'chain', 4, 100),
  define('hard-variety-20', 'Curator’s Eye', 'Match 20 different tile artworks.', 'hard', 20, 'unique', 4, 80),
  define('hard-win-3', 'Three Triumphs', 'Win 3 completed duels.', 'hard', 3, 'wins', 6, 100),
  define('hard-duel-4', 'Duel Devotee', 'Finish 4 duels, win or lose.', 'hard', 4, 'duels', 4, 100),
]);
// Entries issued before reward snapshots existed retain their original payout.
// New selections and rerolls always snapshot the current definition instead.
export const LEGACY_DAILY_QUEST_REWARDS = Object.freeze({
  'easy-pairs-3': Object.freeze({ gems: 2, coins: 0 }),
  'easy-pairs-5': Object.freeze({ gems: 2, coins: 20 }),
  'easy-marble-3': Object.freeze({ gems: 2, coins: 0 }),
  'easy-sapphire-1': Object.freeze({ gems: 2, coins: 0 }),
  'easy-recall-1': Object.freeze({ gems: 2, coins: 0 }),
  'easy-recovery-1': Object.freeze({ gems: 2, coins: 0 }),
  'easy-attempts-6': Object.freeze({ gems: 2, coins: 0 }),
  'easy-chain-2': Object.freeze({ gems: 2, coins: 0 }),
  'easy-variety-3': Object.freeze({ gems: 2, coins: 0 }),
  'easy-duel-1': Object.freeze({ gems: 3, coins: 30 }),
  'easy-opening-1': Object.freeze({ gems: 2, coins: 0 }),
  'medium-pairs-12': Object.freeze({ gems: 4, coins: 40 }),
  'medium-pairs-18': Object.freeze({ gems: 5, coins: 0 }),
  'medium-marble-8': Object.freeze({ gems: 4, coins: 0 }),
  'medium-sapphire-4': Object.freeze({ gems: 4, coins: 30 }),
  'medium-amethyst-2': Object.freeze({ gems: 5, coins: 0 }),
  'medium-gold-1': Object.freeze({ gems: 5, coins: 0 }),
  'medium-recall-4': Object.freeze({ gems: 5, coins: 0 }),
  'medium-recovery-3': Object.freeze({ gems: 4, coins: 30 }),
  'medium-chain-4': Object.freeze({ gems: 5, coins: 0 }),
  'medium-variety-8': Object.freeze({ gems: 4, coins: 40 }),
  'medium-win-1': Object.freeze({ gems: 5, coins: 50 }),
  'hard-pairs-35': Object.freeze({ gems: 8, coins: 80 }),
  'hard-pairs-50': Object.freeze({ gems: 10, coins: 100 }),
  'hard-marble-20': Object.freeze({ gems: 8, coins: 0 }),
  'hard-sapphire-10': Object.freeze({ gems: 8, coins: 60 }),
  'hard-amethyst-5': Object.freeze({ gems: 9, coins: 0 }),
  'hard-gold-3': Object.freeze({ gems: 10, coins: 0 }),
  'hard-recall-10': Object.freeze({ gems: 9, coins: 0 }),
  'hard-chain-7': Object.freeze({ gems: 10, coins: 50 }),
  'hard-variety-20': Object.freeze({ gems: 8, coins: 80 }),
  'hard-win-3': Object.freeze({ gems: 10, coins: 100 }),
  'hard-duel-4': Object.freeze({ gems: 9, coins: 100 }),
});
const byId = new Map(DAILY_QUEST_POOL.map(quest => [quest.id, quest]));
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const safeCount = value => Number.isSafeInteger(value) && value >= 0;
const isToday = (quests, now) => quests.dayId === dayIdFor(now);

function randomFor(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return () => {
    hash += 0x6d2b79f5;
    let mixed = Math.imul(hash ^ hash >>> 15, hash | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}
const choose = (items, random) => items[Math.floor(random() * items.length)];
const own = (object, key) => typeof key === 'string' && Object.hasOwn(object ?? {}, key) ? object[key] : undefined;
const validReward = reward => record(reward) && safeCount(reward.coins) && safeCount(reward.gems);
const copyReward = reward => ({ coins: reward.coins, gems: reward.gems });
const rewardForEntry = entry => copyReward(validReward(entry.reward) ? entry.reward : LEGACY_DAILY_QUEST_REWARDS[entry.id]);
const claimKey = (dayId, questId) => `${dayId}:${questId}`;
const settledStatuses = ['completed', 'cancelled', 'failed', 'unavailable'];
const hasClaim = (quests, dayId, questId) => Object.values(quests.claimReceipts ?? {}).some(receipt => receipt.dayId === dayId && receipt.questId === questId);
const pendingAttempt = (quests, dayId, questId) => Object.values(quests.adAttempts ?? {}).find(attempt => attempt.status === 'pending' &&
  (dayId == null || attempt.dayId === dayId && attempt.questId === questId));
const newEntry = (id, startedAt) => ({ id, reward: copyReward(byId.get(id).reward), progress: 0, claimed: false, startedAt, uniqueKeys: [], chains: {} });
export const createDailyQuestState = () => ({ dayId: null, entries: [], rerollsUsed: 0, presented: false,
  adAttempts: {}, claimReceipts: {}, activeAdAttemptId: null });

/** A reload cannot establish that an interrupted provider actually completed. */
export function recoverInterruptedQuestAds(quests) {
  const pending = Object.values(quests.adAttempts ?? {}).filter(attempt => attempt.status === 'pending');
  if (!pending.length) return quests;
  const adAttempts = { ...quests.adAttempts };
  for (const attempt of pending) adAttempts[attempt.id] = { ...attempt, status: 'failed' };
  return { ...quests, adAttempts, activeAdAttemptId: null };
}

export function normalizeDailyQuests(value, { cold = false } = {}) {
  const base = createDailyQuestState(), claimed = new Set();
  for (const [id, receipt] of Object.entries(record(value?.claimReceipts) ? value.claimReceipts : {})) {
    if (!validEventId(id) || !validDayId(receipt?.dayId) || !byId.has(receipt?.questId) ||
        ![1, 2].includes(receipt.multiplier) || !validTimestamp(receipt.at) || !validReward(receipt.reward)) continue;
    const key = claimKey(receipt.dayId, receipt.questId);
    if (claimed.has(key)) continue;
    claimed.add(key);
    base.claimReceipts[id] = { dayId: receipt.dayId, questId: receipt.questId, multiplier: receipt.multiplier,
      reward: copyReward(receipt.reward), at: receipt.at };
  }
  for (const [id, attempt] of Object.entries(record(value?.adAttempts) ? value.adAttempts : {})) {
    if (!validEventId(id) || !validDayId(attempt?.dayId) || !byId.has(attempt?.questId) ||
        !['pending', ...settledStatuses].includes(attempt.status) || !validTimestamp(attempt.startedAt) ||
        !validReward(attempt.reward) || attempt.eligible !== true) continue;
    // In a damaged save, retain at most one live request and never resurrect a paid one.
    const status = attempt.status === 'pending' && (base.activeAdAttemptId || claimed.has(claimKey(attempt.dayId, attempt.questId))) ? 'failed' : attempt.status;
    base.adAttempts[id] = { id, dayId: attempt.dayId, questId: attempt.questId, status,
      startedAt: attempt.startedAt, reward: copyReward(attempt.reward), eligible: true };
    if (status === 'pending') base.activeAdAttemptId = id;
  }
  let normalized = base;
  if (record(value) && validDayId(value.dayId) && Array.isArray(value.entries) && value.entries.length === 3) {
    const seen = new Set();
    const entries = value.entries.flatMap(entry => {
      const definition = byId.get(entry?.id);
      if (!definition || seen.has(entry.id)) return [];
      seen.add(entry.id);
      const progress = Math.min(definition.target, safeCount(entry.progress) ? entry.progress : 0);
      return [{ id: entry.id, reward: rewardForEntry(entry), progress,
        claimed: progress >= definition.target && (entry.claimed === true || claimed.has(claimKey(value.dayId, entry.id))),
        startedAt: validTimestamp(entry.startedAt) && dayIdFor(entry.startedAt) === value.dayId ? entry.startedAt : Date.parse(`${value.dayId}T00:00:00Z`),
        uniqueKeys: [...new Set((Array.isArray(entry.uniqueKeys) ? entry.uniqueKeys : []).filter(validEventId))].slice(0, definition.target),
        chains: Object.fromEntries(Object.entries(record(entry.chains) ? entry.chains : {}).filter(([id, count]) => validEventId(id) && safeCount(count)).map(([id, count]) => [id, Math.min(count, definition.target)])),
      }];
    });
    if (entries.length === 3) normalized = { ...base, dayId: value.dayId, entries,
      rerollsUsed: safeCount(value.rerollsUsed) ? Math.min(1, value.rerollsUsed) : 0, presented: value.presented === true };
  }
  return cold ? recoverInterruptedQuestAds(normalized) : normalized;
}

/** Stable per player and UTC day; already persisted selections are never rerolled here. */
export function ensureDailyQuests(quests, now = Date.now(), seed = 0) {
  const timestamp = timestampOf(now), dayId = dayIdFor(timestamp);
  if (quests?.dayId === dayId && quests.entries?.length === 3) return quests;
  // Do not reopen old boards or pay old activities when the device clock moves backwards.
  if (validDayId(quests?.dayId) && quests.dayId > dayId) return quests;
  const random = randomFor(`${seed}:${dayId}`), selected = [];
  for (const difficulty of ['easy', 'medium', null]) {
    const candidates = DAILY_QUEST_POOL.filter(quest => (!difficulty || quest.difficulty === difficulty) && !selected.some(item => item.metric === quest.metric));
    selected.push(choose(candidates, random));
  }
  return { ...createDailyQuestState(), ...quests, dayId, entries: selected.map(quest => newEntry(quest.id, timestamp)), rerollsUsed: 0, presented: false };
}

export function getDailyQuestView(progression, now = Date.now()) {
  const quests = ensureDailyQuests(progression?.quests, now, progression?.ranking?.seed ?? 0);
  return { dayId: quests.dayId, quests: quests.entries.map(entry => {
    const pending = pendingAttempt(quests, quests.dayId, entry.id);
    const receipt = Object.values(quests.claimReceipts ?? {}).find(item => item.dayId === quests.dayId && item.questId === entry.id);
    return { ...byId.get(entry.id), reward: rewardForEntry(entry), progress: entry.progress,
      completed: entry.progress >= byId.get(entry.id).target, claimed: entry.claimed || hasClaim(quests, quests.dayId, entry.id),
      claimMultiplier: receipt?.multiplier ?? 1, pending: Boolean(pending), pendingAttemptId: pending?.id ?? null };
  }), adAttempt: pendingAttempt(quests) ?? null,
  rerollsLeft: 1 - quests.rerollsUsed, shouldAutoOpen: isToday(quests, now) && !quests.presented,
  resetAt: Date.parse(`${quests.dayId}T00:00:00Z`) + 86400000 };
}

function settleClaim(quests, dayId, questId, reward, eventId, multiplier, now) {
  if (!validEventId(eventId) || own(quests.claimReceipts, eventId) || hasClaim(quests, dayId, questId) ||
      !validReward(reward) || ![reward.coins, reward.gems].every(amount => Number.isSafeInteger(amount * multiplier))) return null;
  return { quests: { ...quests,
    entries: quests.dayId === dayId ? quests.entries.map(entry => entry.id === questId ? { ...entry, reward: copyReward(reward), claimed: true } : entry) : quests.entries,
    claimReceipts: { ...quests.claimReceipts, [eventId]: { dayId, questId, reward: copyReward(reward), multiplier, at: now } } },
    grants: { coins: reward.coins * multiplier, gems: reward.gems * multiplier }, accepted: true };
}

/** UI actions return grants; the progression reducer commits them and its receipt atomically. */
export function applyDailyQuestEvent(quests, event, seed = 0) {
  const now = timestampOf(event.now), current = ensureDailyQuests(quests, now, seed);
  const empty = { quests, grants: emptyCurrencies(), accepted: false };
  // Completion belongs to the saved request, even if a new day's roster already exists.
  if (event.type === 'quest-ad-complete') {
    const attempt = own(current.adAttempts, event.attemptId);
    if (!attempt || attempt.status !== 'pending' || event.dayId !== attempt.dayId || event.questId !== attempt.questId ||
        !validEventId(event.eventId) || !settledStatuses.includes(event.status) || now < attempt.startedAt) return empty;
    const resolution = event.status === 'completed'
      ? settleClaim(current, attempt.dayId, attempt.questId, attempt.reward, event.eventId, 2, now)
      : { quests: current, grants: emptyCurrencies(), accepted: true };
    if (!resolution) return empty;
    return { ...resolution, quests: { ...resolution.quests,
      adAttempts: { ...current.adAttempts, [attempt.id]: { ...attempt, status: event.status } },
      activeAdAttemptId: current.activeAdAttemptId === attempt.id ? null : current.activeAdAttemptId } };
  }
  if (!isToday(current, now) || event.dayId !== current.dayId) return empty;
  if (event.type === 'quests-presented') {
    if (current.presented) return empty;
    return { ...empty, quests: { ...current, presented: true }, accepted: true };
  }
  if (!validEventId(event.eventId)) return empty;
  const index = current.entries.findIndex(entry => entry.id === event.questId);
  if (index < 0) return empty;
  const entry = current.entries[index], definition = byId.get(entry.id);
  if (event.type === 'quest-claim' || event.type === 'quest-ad-start') {
    if (entry.claimed || hasClaim(current, current.dayId, entry.id) || entry.progress < definition.target ||
        pendingAttempt(current, current.dayId, entry.id)) return empty;
    if (event.type === 'quest-claim') return settleClaim(current, current.dayId, entry.id, rewardForEntry(entry), event.eventId, 1, now) ?? empty;
    if (!validEventId(event.attemptId) || own(current.adAttempts, event.attemptId) || pendingAttempt(current)) return empty;
    const attempt = { id: event.attemptId, dayId: current.dayId, questId: entry.id, status: 'pending',
      startedAt: now, reward: rewardForEntry(entry), eligible: true };
    return { ...empty, quests: { ...current, adAttempts: { ...current.adAttempts, [attempt.id]: attempt }, activeAdAttemptId: attempt.id }, accepted: true };
  }
  if (event.type === 'quest-reroll') {
    if (current.rerollsUsed || entry.claimed || entry.progress >= definition.target) return empty;
    const candidates = DAILY_QUEST_POOL.filter(quest => quest.difficulty !== definition.difficulty && !current.entries.some(item =>
      item.id === quest.id || (item.id !== entry.id && byId.get(item.id).metric === quest.metric)));
    const replacement = choose(candidates, randomFor(`${seed}:${current.dayId}:${entry.id}:reroll`));
    return { ...empty, quests: { ...current, rerollsUsed: 1,
      entries: current.entries.map((item, i) => i === index ? newEntry(replacement.id, now) : item) }, accepted: true };
  }
  return empty;
}

/** Called only after the authoritative reducer validates and deduplicates a gameplay event. */
export function recordDailyQuestGameplay(quests, event, seed = 0) {
  const now = timestampOf(event.now), current = ensureDailyQuests(quests, now, seed);
  if (!isToday(current, now) || (event.type === 'attempt' && event.actor !== 'you')) return current;
  const entries = current.entries.map(entry => {
    if (entry.claimed || now < entry.startedAt) return entry;
    const definition = byId.get(entry.id);
    if (entry.progress >= definition.target) return entry;
    let amount = 0, uniqueKeys = entry.uniqueKeys, chains = entry.chains, progress = entry.progress;
    if (event.type === 'attempt') {
      if (definition.metric === 'attempts') amount = 1;
      if (definition.metric === 'chain') {
        chains = { ...chains, [event.gameId]: event.matched ? (chains[event.gameId] ?? 0) + 1 : 0 };
        progress = Math.max(progress, chains[event.gameId]);
      }
      if (event.matched) {
        if (definition.metric === 'pairs') amount = 1;
        if (definition.metric === `rarity:${event.rarity}`) amount = 1;
        if (definition.metric.startsWith('counter:')) amount = Math.min(1, event.counterDeltas?.[definition.metric.slice(8)] ?? 0);
        if (definition.metric === 'opening' && event.beforePairs.you === 0) amount = 1;
        if (definition.metric === 'unique' && !uniqueKeys.includes(event.matchKey)) {
          uniqueKeys = [...uniqueKeys, event.matchKey]; progress = uniqueKeys.length;
        }
      }
    } else if (event.type === 'complete') {
      if (definition.metric === 'duels' || (definition.metric === 'wins' && event.outcome === 'win')) amount = 1;
      if (definition.metric === 'chain' && Object.hasOwn(chains, event.gameId)) {
        chains = { ...chains }; delete chains[event.gameId];
      }
    }
    progress = Math.min(definition.target, progress + amount);
    return progress === entry.progress && uniqueKeys === entry.uniqueKeys && chains === entry.chains ? entry : { ...entry, progress, uniqueKeys, chains };
  });
  return entries.every((entry, index) => entry === current.entries[index]) ? current : { ...current, entries };
}
