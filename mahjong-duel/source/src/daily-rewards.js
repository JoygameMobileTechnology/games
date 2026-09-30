import { BOOSTER_IDS } from './boosters.js';

export const DAY_POLICY = { id: 'utc', dayId: timestamp => new Date(timestamp).toISOString().slice(0, 10) };
export const DAILY_REWARD_CONFIG = Object.freeze({
  weekly: Object.freeze([{ hint: 1 }, { coins: 25, shuffle: 1 }, { coins: 30, eagle: 1 }, { coins: 40 },
    { coins: 50, hint: 1 }, { coins: 60 }, { freeze: 1 }].map(Object.freeze)),
  longEvery: 30, longReward: Object.freeze({ shuffle: 1, hint: 1, freeze: 1, eagle: 1 }),
});
// Older states may omit the entitlement's reward snapshot. Honor the schedule
// under which those login days were earned instead of retroactively repricing them.
const LEGACY_DAILY_REWARD_CONFIG = Object.freeze({
  weekly: Object.freeze([{ hint: 1 }, { shuffle: 1 }, { freeze: 1 }, { eagle: 1 }, { hint: 2 }, { shuffle: 2 },
    { shuffle: 2, hint: 2, freeze: 2, eagle: 2 }].map(Object.freeze)),
  longEvery: 30, longReward: Object.freeze({ shuffle: 5, hint: 5, freeze: 5, eagle: 5 }),
});
export const emptyWallet = () => Object.fromEntries(BOOSTER_IDS.map(id => [id, 0]));
const REWARD_IDS = [...BOOSTER_IDS, 'coins'];
export const emptyRewards = () => Object.fromEntries(REWARD_IDS.map(id => [id, 0]));
export const validTimestamp = value => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
export const timestampOf = value => validTimestamp(value instanceof Date ? value.getTime() : value) ? Number(value) : Date.now();
export const validEventId = value => typeof value === 'string' && value.length > 0 && value.length <= 200 &&
  !/[\u0000-\u001f]/.test(value) && !Object.hasOwn(Object.prototype, value);
const ownValue = (object, key) => typeof key === 'string' && object != null && Object.hasOwn(object, key) ? object[key] : undefined;
export function validDayId(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
export function dayIdFor(now = Date.now(), policy = DAY_POLICY) { return policy.dayId(timestampOf(now)); }
export function normalizeWallet(value) {
  return Object.fromEntries(BOOSTER_IDS.map(id => [id, Number.isSafeInteger(value?.[id]) && value[id] >= 0 ? value[id] : 0]));
}
export function normalizeRewards(value) {
  return Object.fromEntries(REWARD_IDS.map(id => [id, Number.isSafeInteger(value?.[id]) && value[id] >= 0 ? value[id] : 0]));
}
const add = (first, second, multiplier = 1) => Object.fromEntries(REWARD_IDS.map(id => [id,
  Math.min(Number.MAX_SAFE_INTEGER, (first[id] ?? 0) + (second[id] ?? 0) * multiplier)]));
export function rewardsForLogin(loginNumber, config = DAILY_REWARD_CONFIG) {
  if (!Number.isSafeInteger(loginNumber) || loginNumber < 1) return emptyRewards();
  const weekly = normalizeRewards(config.weekly[(loginNumber - 1) % config.weekly.length]);
  return loginNumber % config.longEvery === 0 ? add(weekly, config.longReward) : weekly;
}
export function createDailyState() {
  return { loginDayIds: [], entitlements: {}, claimReceipts: {}, claims: {}, adAttempts: {}, activeAdAttemptId: null, presentedDayIds: [] };
}
export function normalizeDaily(value) {
  const daily = createDailyState();
  daily.loginDayIds = [...new Set((Array.isArray(value?.loginDayIds) ? value.loginDayIds : []).filter(validDayId))];
  daily.presentedDayIds = [...new Set((Array.isArray(value?.presentedDayIds) ? value.presentedDayIds : []).filter(id => daily.loginDayIds.includes(id)))];
  daily.loginDayIds.forEach((dayId, index) => {
    const id = `login:${dayId}`, stored = ownValue(value?.entitlements, id);
    daily.entitlements[id] = { id, dayId, loginNumber: index + 1,
      rewards: stored?.rewards && typeof stored.rewards === 'object' ? normalizeRewards(stored.rewards) : rewardsForLogin(index + 1, LEGACY_DAILY_REWARD_CONFIG) };
  });
  for (const [id, receipt] of Object.entries(value?.claimReceipts && typeof value.claimReceipts === 'object' ? value.claimReceipts : {})) {
    if (!validEventId(id) || ![1, 2].includes(receipt?.multiplier) || !validTimestamp(receipt?.at) || !Array.isArray(receipt?.entitlementIds)) continue;
    const entitlementIds = [...new Set(receipt.entitlementIds.filter(key => ownValue(daily.entitlements, key) && !ownValue(daily.claims, key)))];
    if (!entitlementIds.length) continue;
    daily.claimReceipts[id] = { entitlementIds, multiplier: receipt.multiplier, at: receipt.at };
    entitlementIds.forEach(key => { daily.claims[key] = { receiptId: id, claimedAt: receipt.at, multiplier: receipt.multiplier }; });
  }
  for (const [id, attempt] of Object.entries(value?.adAttempts && typeof value.adAttempts === 'object' ? value.adAttempts : {})) {
    if (!validEventId(id) || !['pending', 'completed', 'cancelled', 'failed', 'unavailable'].includes(attempt?.status) || !Array.isArray(attempt?.entitlementIds)) continue;
    daily.adAttempts[id] = { id, status: attempt.status, startedAt: timestampOf(attempt.startedAt),
      entitlementIds: [...new Set(attempt.entitlementIds.filter(key => ownValue(daily.entitlements, key)))] };
  }
  if (ownValue(daily.adAttempts, value?.activeAdAttemptId)?.status === 'pending') daily.activeAdAttemptId = value.activeAdAttemptId;
  return daily;
}
function pendingEntitlements(daily) { return Object.values(daily.entitlements).filter(item => !ownValue(daily.claims, item.id)); }
function claim(daily, ids, eventId, multiplier, now) {
  if (!validEventId(eventId) || ownValue(daily.claimReceipts, eventId)) return { daily, grants: emptyRewards() };
  const eligible = [...new Set(ids)].filter(id => ownValue(daily.entitlements, id) && !ownValue(daily.claims, id));
  if (!eligible.length) return { daily, grants: emptyRewards() };
  let grants = emptyRewards();
  const claims = { ...daily.claims };
  eligible.forEach(id => {
    grants = add(grants, daily.entitlements[id].rewards, multiplier);
    claims[id] = { receiptId: eventId, claimedAt: now, multiplier };
  });
  return { daily: { ...daily, claims, claimReceipts: { ...daily.claimReceipts, [eventId]: { entitlementIds: eligible, multiplier, at: now } } }, grants };
}

/** Pure daily transition: ad starts snapshot IDs; only confirmed completion pays that snapshot. */
export function applyDailyEvent(daily, event) {
  const now = timestampOf(event.now), empty = { daily, grants: emptyRewards() };
  if (event.type === 'login') {
    const dayId = dayIdFor(now);
    if (!validDayId(dayId) || daily.loginDayIds.includes(dayId)) return empty;
    const loginNumber = daily.loginDayIds.length + 1, id = `login:${dayId}`;
    return { ...empty, daily: { ...daily, loginDayIds: [...daily.loginDayIds, dayId],
      entitlements: { ...daily.entitlements, [id]: { id, dayId, loginNumber, rewards: rewardsForLogin(loginNumber) } } } };
  }
  if (event.type === 'daily-presented') {
    const dayId = event.dayId ?? dayIdFor(now);
    if (!daily.loginDayIds.includes(dayId) || daily.presentedDayIds.includes(dayId)) return empty;
    return { ...empty, daily: { ...daily, presentedDayIds: [...daily.presentedDayIds, dayId] } };
  }
  if (event.type === 'daily-claim') return claim(daily, pendingEntitlements(daily).map(item => item.id), event.eventId, 1, now);
  if (event.type === 'daily-ad-start') {
    if (!validEventId(event.attemptId) || ownValue(daily.adAttempts, event.attemptId) || !pendingEntitlements(daily).length) return empty;
    const attempt = { id: event.attemptId, status: 'pending', startedAt: now, entitlementIds: pendingEntitlements(daily).map(item => item.id) };
    return { ...empty, daily: { ...daily, adAttempts: { ...daily.adAttempts, [attempt.id]: attempt }, activeAdAttemptId: attempt.id } };
  }
  if (event.type === 'daily-ad-complete') {
    const attempt = ownValue(daily.adAttempts, event.attemptId);
    if (!attempt || attempt.status !== 'pending' || !['completed', 'cancelled', 'failed', 'unavailable'].includes(event.status)) return empty;
    const resolution = event.status === 'completed' ? claim(daily, attempt.entitlementIds, event.eventId, 2, now) : empty;
    return { ...resolution, daily: { ...resolution.daily,
      adAttempts: { ...resolution.daily.adAttempts, [attempt.id]: { ...attempt, status: event.status } },
      activeAdAttemptId: resolution.daily.activeAdAttemptId === attempt.id ? null : resolution.daily.activeAdAttemptId } };
  }
  return empty;
}
export function getDailyView(state, now = Date.now()) {
  const daily = state?.daily ?? createDailyState(), loginDays = daily.loginDayIds.length, dayId = dayIdFor(now);
  const entitlements = pendingEntitlements(daily);
  const rewards = entitlements.reduce((total, item) => add(total, item.rewards), emptyRewards());
  return { loginDays, weeklyDay: loginDays ? (loginDays - 1) % DAILY_REWARD_CONFIG.weekly.length + 1 : 0,
    longDay: loginDays ? (loginDays - 1) % DAILY_REWARD_CONFIG.longEvery + 1 : 0, entitlements, rewards,
    hasClaim: entitlements.length > 0, claimedToday: Boolean(ownValue(daily.claims, `login:${dayId}`)),
    shouldAutoOpen: daily.loginDayIds.includes(dayId) && !daily.presentedDayIds.includes(dayId), dayId,
    adAttempt: ownValue(daily.adAttempts, daily.activeAdAttemptId) ?? null };
}
