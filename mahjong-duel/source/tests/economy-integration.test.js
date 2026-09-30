import test from 'node:test';
import assert from 'node:assert/strict';
import { createProgression, normalizeProgression, reduceProgression, saveProgression, loadProgression, hasStarterNotice } from '../src/progression.js';
import { DAILY_QUEST_POOL, getDailyQuestView, normalizeDailyQuests } from '../src/daily-quests.js';
import { dayIdFor, getDailyView } from '../src/daily-rewards.js';
import { SHOP_BOOSTER_PACKS, STARTER_BOOSTERS } from '../src/economy.js';

const NOW = Date.UTC(2026, 9, 1, 12), DAY = dayIdFor(NOW), QUEST = 'medium-win-1';
function fresh() {
  const state = reduceProgression(createProgression({ seed: 14 }), { type: 'login', now: NOW });
  state.currencies = { coins: 300, gems: 10 };
  state.quests = normalizeDailyQuests({ dayId: DAY, presented: false, rerollsUsed: 0,
    entries: ['easy-pairs-3', QUEST, 'hard-chain-7'].map(id => {
      const quest = DAILY_QUEST_POOL.find(item => item.id === id);
      return { id, reward: quest.reward, progress: quest.target, startedAt: NOW, claimed: false, uniqueKeys: [], chains: {} };
    }) });
  return state;
}
const event = (type, extras = {}) => ({ type, eventId: `${type}:receipt`, attemptId: 'quest:ad', dayId: DAY, questId: QUEST, now: NOW + 1, ...extras });
const begin = state => reduceProgression(state, event('quest-ad-start'));
const complete = (state, extras = {}) => reduceProgression(state, event('quest-ad-complete', { status: 'completed', now: NOW + 2, ...extras }));
function storageFor(state) {
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(saveProgression(state, storage), true);
  return storage;
}

test('quest double claims atomically credit both balances once through the progression reducer', () => {
  const initial = fresh(), started = begin(initial);
  assert.deepEqual(started.currencies, { coins: 300, gems: 10 });
  assert.deepEqual(started.wallet, initial.wallet);
  assert.strictEqual(reduceProgression(started, event('quest-claim')), started, 'a normal claim cannot race the provider');
  const paid = complete(started);
  assert.deepEqual(paid.currencies, { coins: 420, gems: 14 });
  assert.deepEqual(paid.wallet, initial.wallet, 'currency quest grants do not alter boosters');
  assert.equal(getDailyQuestView(paid, NOW + 2).quests[1].claimMultiplier, 2);
  assert.ok(paid.eventReceipts['quest-ad-complete:receipt']);
  assert.strictEqual(complete(paid), paid);
  assert.strictEqual(complete(paid, { eventId: 'another-callback' }), paid);
  assert.strictEqual(reduceProgression(paid, event('quest-claim', { eventId: 'normal-after-double' })), paid);
  const restored = loadProgression({ storage: storageFor(paid), now: NOW + 3 });
  assert.deepEqual(restored.currencies, paid.currencies);
  assert.strictEqual(complete(restored, { eventId: 'callback-after-reload', now: NOW + 4 }), restored);
});

test('quest callbacks after UTC rollover pay the reserved old reward without touching the new roster', () => {
  const started = begin(fresh()), tomorrow = NOW + 86400000;
  const rolled = reduceProgression(started, { type: 'login', now: tomorrow });
  const newRoster = structuredClone(rolled.quests.entries);
  assert.equal(rolled.quests.dayId, dayIdFor(tomorrow));
  const paid = complete(rolled, { now: tomorrow + 1 });
  assert.deepEqual(paid.currencies, { coins: 420, gems: 14 });
  assert.deepEqual(paid.quests.entries, newRoster);
  assert.equal(paid.quests.claimReceipts['quest-ad-complete:receipt'].dayId, DAY);
  assert.strictEqual(complete(paid, { now: tomorrow + 2, eventId: 'replayed-old-day' }), paid);
});

test('cold reload grants no abandoned quest reward and permits a fresh provider attempt', () => {
  const started = begin(fresh());
  const restored = loadProgression({ storage: storageFor(started), now: NOW + 2 });
  assert.deepEqual(restored.currencies, { coins: 300, gems: 10 });
  assert.equal(restored.quests.adAttempts['quest:ad'].status, 'failed');
  assert.equal(restored.quests.activeAdAttemptId, null);
  assert.equal(restored.quests.entries[1].claimed, false);
  assert.strictEqual(complete(restored, { eventId: 'abandoned-callback', now: NOW + 3 }), restored);
  const retry = reduceProgression(restored, event('quest-ad-start', { attemptId: 'quest:retry', eventId: 'quest:retry:start', now: NOW + 4 }));
  const paid = complete(retry, { attemptId: 'quest:retry', eventId: 'quest:retry:complete', now: NOW + 5 });
  assert.deepEqual(paid.currencies, { coins: 420, gems: 14 });
});

test('only one rewarded provider request may be pending across daily login and quest placements', () => {
  const initial = fresh();
  const dailyStart = { type: 'daily-ad-start', eventId: 'daily:first:start', attemptId: 'daily:first', now: NOW + 1 };
  const dailyPending = reduceProgression(initial, dailyStart);
  assert.notStrictEqual(dailyPending, initial);
  assert.strictEqual(begin(dailyPending), dailyPending, 'daily request blocks a quest request');
  assert.strictEqual(reduceProgression(dailyPending, { ...dailyStart, eventId: 'daily:second:start', attemptId: 'daily:second' }), dailyPending);
  const questPending = begin(initial);
  assert.strictEqual(reduceProgression(questPending, dailyStart), questPending, 'quest request blocks a daily request');
  const cancelled = complete(questPending, { status: 'cancelled' });
  assert.notStrictEqual(reduceProgression(cancelled, dailyStart), cancelled, 'finishing a request frees the provider slot');
});

test('cold recovery releases an interrupted daily ad without paying or blocking a new quest claim', () => {
  const initial = fresh();
  const pending = reduceProgression(initial, { type: 'daily-ad-start', eventId: 'daily:interrupted:start', attemptId: 'daily:interrupted', now: NOW + 1 });
  const restored = loadProgression({ storage: storageFor(pending), now: NOW + 2 });
  assert.deepEqual(restored.currencies, initial.currencies);
  assert.deepEqual(restored.wallet, initial.wallet);
  assert.equal(restored.daily.adAttempts['daily:interrupted'].status, 'failed');
  assert.equal(restored.daily.activeAdAttemptId, null);
  assert.equal(getDailyView(restored, NOW + 2).hasClaim, true);
  const late = { type: 'daily-ad-complete', eventId: 'daily:interrupted:late', attemptId: 'daily:interrupted', status: 'completed', now: NOW + 3 };
  assert.strictEqual(reduceProgression(restored, late), restored);
  const questPending = reduceProgression(restored, event('quest-ad-start', { eventId: 'quest:after-reload', now: NOW + 4 }));
  assert.equal(questPending.quests.adAttempts['quest:ad'].status, 'pending');
});

test('unsuccessful quest ads leave standard claims available and pay nothing', () => {
  for (const status of ['cancelled', 'failed', 'unavailable']) {
    const failed = complete(begin(fresh()), { status });
    assert.deepEqual(failed.currencies, { coins: 300, gems: 10 });
    const standard = reduceProgression(failed, event('quest-claim', { eventId: `standard:${status}`, now: NOW + 3 }));
    assert.deepEqual(standard.currencies, { coins: 360, gems: 12 });
    assert.equal(getDailyQuestView(standard, NOW + 3).quests[1].claimMultiplier, 1);
    assert.strictEqual(reduceProgression(standard, event('quest-claim', { eventId: `duplicate:${status}`, now: NOW + 4 })), standard);
  }
});

test('daily login claims credit Coins and boosters together while retaining existing Gems', () => {
  for (const doubled of [false, true]) {
    let state = createProgression({ seed: 14 });
    state.currencies = { coins: 130, gems: 17 };
    const beforeWallet = structuredClone(state.wallet);
    state = reduceProgression(state, { type: 'login', now: NOW });
    state = reduceProgression(state, { type: 'login', now: NOW + 86400000 });
    const claimTime = NOW + 86400000 + 1, multiplier = doubled ? 2 : 1;
    assert.deepEqual(getDailyView(state, claimTime).rewards, { hint: 1, shuffle: 1, freeze: 0, eagle: 0, coins: 25 });
    const action = doubled
      ? { type: 'daily-ad-complete', attemptId: 'login:ad', eventId: 'login:paid', status: 'completed', now: claimTime }
      : { type: 'daily-claim', eventId: 'login:paid', now: claimTime };
    if (doubled) state = reduceProgression(state, { type: 'daily-ad-start', eventId: 'login:start', attemptId: 'login:ad', now: claimTime });
    state = reduceProgression(state, action);
    assert.deepEqual(state.currencies, { coins: 130 + 25 * multiplier, gems: 17 });
    assert.deepEqual(state.wallet, { ...beforeWallet, hint: beforeWallet.hint + multiplier, shuffle: beforeWallet.shuffle + multiplier });
    assert.strictEqual(reduceProgression(state, action), state);
    const loaded = loadProgression({ storage: storageFor(state), now: claimTime + 1 });
    assert.deepEqual(loaded.currencies, state.currencies); assert.deepEqual(loaded.wallet, state.wallet);
    assert.equal(getDailyView(loaded, claimTime + 1).hasClaim, false);
  }
});

test('the authoritative shop reducer uses only the selected payment, with no silent fallback', () => {
  const expected = {
    'hint-single': { primary: [0, 6], coins: [1200, 0] }, 'shuffle-single': { primary: [0, 8], coins: [1600, 0] },
    'freeze-single': { primary: [0, 10], coins: [2000, 0] }, 'eagle-single': { primary: [0, 4], coins: [800, 0] },
    'focused-mind': { primary: [300, 20], coins: [5200, 0] }, 'duel-kit': { primary: [1200, 40], coins: [12800, 0] },
    'masters-kit': { primary: [2400, 70], coins: [23600, 0] },
  };
  for (const pack of SHOP_BOOSTER_PACKS) {
    for (const payment of ['primary', 'coins']) {
      const state = fresh(); state.currencies = { coins: 30000, gems: 100 };
      const action = { type: 'shop-buy', eventId: `${pack.id}:${payment}`, productId: pack.id, payment, now: NOW };
      const purchased = reduceProgression(state, action), [coins, gems] = expected[pack.id][payment];
      assert.deepEqual(purchased.currencies, { coins: 30000 - coins, gems: 100 - gems });
      assert.deepEqual(purchased.wallet, Object.fromEntries(Object.keys(state.wallet).map(id => [id, state.wallet[id] + pack.boosters[id]])));
      assert.strictEqual(reduceProgression(purchased, action), purchased);
    }
    const coinsOnly = fresh(); coinsOnly.currencies = { coins: 30000, gems: 0 };
    assert.strictEqual(reduceProgression(coinsOnly, { type: 'shop-buy', eventId: 'no-gems', productId: pack.id, payment: 'primary', now: NOW }), coinsOnly);
    const gemsOnly = fresh(); gemsOnly.currencies = { coins: 0, gems: 100 };
    assert.strictEqual(reduceProgression(gemsOnly, { type: 'shop-buy', eventId: 'no-coins', productId: pack.id, payment: 'coins', now: NOW }), gemsOnly);
    assert.strictEqual(reduceProgression(coinsOnly, { type: 'shop-buy', eventId: 'bad-payment', productId: pack.id, payment: 'both', now: NOW }), coinsOnly);
  }
});

test('existing profiles receive the sampler once without losing prior inventory, currency or receipts', () => {
  const old = fresh();
  old.wallet = { hint: 7, shuffle: 4, freeze: 19, eagle: 0 };
  old.currencies = { coins: 965, gems: 37 };
  delete old.eventReceipts['starter-boosters:v1'];
  old.eventReceipts['earned-before-update'] = NOW - 100;
  const restored = loadProgression({ storage: storageFor(old), now: NOW + 1 });
  assert.deepEqual(restored.wallet, { hint: 9, shuffle: 6, freeze: 21, eagle: 2 });
  assert.deepEqual(restored.currencies, old.currencies);
  assert.equal(restored.eventReceipts['earned-before-update'], NOW - 100);
  assert.ok(restored.eventReceipts['starter-boosters:v1']);
  assert.equal(hasStarterNotice(restored), true);
  const reloaded = loadProgression({ storage: storageFor(restored), now: NOW + 2 });
  assert.deepEqual(reloaded.wallet, restored.wallet);
  assert.equal(hasStarterNotice(reloaded), true, 'an undismissed introduction remains available');
  const dismissed = reduceProgression(reloaded, { type: 'starter-seen', now: NOW + 3 });
  assert.equal(hasStarterNotice(dismissed), false);
  assert.deepEqual(dismissed.wallet, restored.wallet);
  assert.strictEqual(reduceProgression(dismissed, { type: 'starter-seen', now: NOW + 4 }), dismissed);
  const later = loadProgression({ storage: storageFor(dismissed), now: NOW + 86400000 });
  assert.deepEqual(later.wallet, restored.wallet);
  assert.equal(hasStarterNotice(later), false);
  assert.deepEqual(normalizeProgression(later, { now: NOW + 86400001 }).wallet, restored.wallet);
});

test('a fresh profile gets exactly eight starter boosters, independent of daily claims', () => {
  const state = createProgression({ seed: 14 });
  assert.deepEqual(state.wallet, STARTER_BOOSTERS);
  assert.equal(Object.values(state.wallet).reduce((sum, count) => sum + count, 0), 8);
  assert.deepEqual(state.currencies, { coins: 0, gems: 0 });
  assert.equal(getDailyView(state, NOW).hasClaim, false);
  const paid = complete(begin(fresh()));
  assert.deepEqual(paid.wallet, STARTER_BOOSTERS, 'quest doubling cannot double the sampler');
});
