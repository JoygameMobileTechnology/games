import test from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_QUEST_POOL, LEGACY_DAILY_QUEST_REWARDS, applyDailyQuestEvent, createDailyQuestState,
  ensureDailyQuests, getDailyQuestView, normalizeDailyQuests } from '../src/daily-quests.js';
import { dayIdFor } from '../src/daily-rewards.js';
import { requestRewardedAd } from '../src/rewarded-ad.js';

const NOW = Date.UTC(2026, 9, 1, 12), DAY = dayIdFor(NOW);
const IDS = ['easy-pairs-3', 'medium-win-1', 'hard-chain-7'];
function roster({ legacy = false, complete = true } = {}) {
  return normalizeDailyQuests({ dayId: DAY, rerollsUsed: 0, presented: false, entries: IDS.map(id => {
    const definition = DAILY_QUEST_POOL.find(quest => quest.id === id);
    return { id, ...(legacy ? {} : { reward: definition.reward }), progress: complete ? definition.target : 0,
      startedAt: NOW, claimed: false, chains: {}, uniqueKeys: [] };
  }) });
}
const action = (type, extras = {}) => ({ type, eventId: `${type}:event`, dayId: DAY, questId: IDS[0], now: NOW + 1, ...extras });
const start = (quests, extras = {}) => applyDailyQuestEvent(quests, action('quest-ad-start', { attemptId: 'ad:1', ...extras }));
const finish = (quests, extras = {}) => applyDailyQuestEvent(quests, action('quest-ad-complete', { attemptId: 'ad:1', status: 'completed', now: NOW + 2, ...extras }));

test('all 33 approved quest payouts are exact and newly issued rosters snapshot them', () => {
  const expected = {
    'easy-pairs-3': [20, 0], 'easy-pairs-5': [25, 0], 'easy-marble-3': [20, 0], 'easy-sapphire-1': [20, 0],
    'easy-recall-1': [25, 0], 'easy-recovery-1': [20, 0], 'easy-attempts-6': [20, 0], 'easy-chain-2': [25, 0],
    'easy-variety-3': [25, 0], 'easy-duel-1': [40, 0], 'easy-opening-1': [20, 0],
    'medium-pairs-12': [40, 0], 'medium-pairs-18': [50, 0], 'medium-marble-8': [40, 0], 'medium-sapphire-4': [40, 0],
    'medium-amethyst-2': [50, 2], 'medium-gold-1': [50, 2], 'medium-recall-4': [50, 2], 'medium-recovery-3': [40, 0],
    'medium-chain-4': [60, 2], 'medium-variety-8': [50, 0], 'medium-win-1': [60, 2],
    'hard-pairs-35': [80, 4], 'hard-pairs-50': [100, 6], 'hard-marble-20': [80, 4], 'hard-sapphire-10': [80, 4],
    'hard-amethyst-5': [90, 4], 'hard-gold-3': [90, 4], 'hard-recall-10': [90, 4], 'hard-chain-7': [100, 4],
    'hard-variety-20': [80, 4], 'hard-win-3': [100, 6], 'hard-duel-4': [100, 4],
  };
  assert.deepEqual(Object.fromEntries(DAILY_QUEST_POOL.map(quest => [quest.id, [quest.reward.coins, quest.reward.gems]])), expected);
  for (let seed = 0; seed < 100; seed++) {
    const quests = ensureDailyQuests(createDailyQuestState(), NOW, seed);
    for (const entry of quests.entries) assert.deepEqual(entry.reward, { coins: expected[entry.id][0], gems: expected[entry.id][1] });
  }
});

test('every permitted daily mix and reroll stays within the approved earned-currency budgets', () => {
  const easy = DAILY_QUEST_POOL.filter(quest => quest.difficulty === 'easy');
  let averageCoins = 0, averageGems = 0, probability = 0, maximumRerolledGems = 0;
  const coinRange = [Infinity, -Infinity], gemRange = [Infinity, -Infinity];
  for (const first of easy) {
    const medium = DAILY_QUEST_POOL.filter(quest => quest.difficulty === 'medium' && quest.metric !== first.metric);
    for (const second of medium) {
      const thirds = DAILY_QUEST_POOL.filter(quest => quest.metric !== first.metric && quest.metric !== second.metric);
      for (const third of thirds) {
        const selected = [first, second, third], weight = 1 / easy.length / medium.length / thirds.length;
        const coins = selected.reduce((sum, quest) => sum + quest.reward.coins, 0);
        const gems = selected.reduce((sum, quest) => sum + quest.reward.gems, 0);
        averageCoins += coins * weight; averageGems += gems * weight; probability += weight;
        coinRange[0] = Math.min(coinRange[0], coins); coinRange[1] = Math.max(coinRange[1], coins);
        gemRange[0] = Math.min(gemRange[0], gems); gemRange[1] = Math.max(gemRange[1], gems);
        for (const removed of selected) {
          const candidates = DAILY_QUEST_POOL.filter(quest => quest.difficulty !== removed.difficulty && !selected.some(item =>
            item.id === quest.id || (item !== removed && item.metric === quest.metric)));
          for (const replacement of candidates) maximumRerolledGems = Math.max(maximumRerolledGems, gems - removed.reward.gems + replacement.reward.gems);
        }
      }
    }
  }
  assert.ok(Math.abs(probability - 1) < 1e-10);
  assert.equal(Number(averageCoins.toFixed(2)), 126.26);
  assert.equal(Number(averageGems.toFixed(2)), 2.74);
  assert.deepEqual(coinRange, [80, 200]); assert.deepEqual(gemRange, [0, 8]);
  assert.equal(maximumRerolledGems, 14);
  assert.equal(Number((averageCoins * 2).toFixed(2)), 252.52);
  assert.equal(Number((averageGems * 2).toFixed(2)), 5.48);
});

test('a normal claim settles the shown reward once and prevents later doubling', () => {
  const quests = roster();
  const result = applyDailyQuestEvent(quests, action('quest-claim', { questId: IDS[1] }));
  assert.equal(result.accepted, true);
  assert.deepEqual(result.grants, { coins: 60, gems: 2 });
  assert.equal(result.quests.entries[1].claimed, true);
  assert.equal(getDailyQuestView({ quests: result.quests }, NOW + 2).quests[1].claimMultiplier, 1);
  assert.equal(applyDailyQuestEvent(result.quests, action('quest-claim', { questId: IDS[1], eventId: 'second' })).accepted, false);
  assert.equal(start(result.quests, { questId: IDS[1] }).accepted, false);
  const restored = normalizeDailyQuests(JSON.parse(JSON.stringify(result.quests)));
  assert.deepEqual(restored, result.quests);
  assert.equal(applyDailyQuestEvent(restored, action('quest-claim', { questId: IDS[1], eventId: 'after-reload' })).accepted, false);
});

test('confirmed quest ads double both currencies exactly once and block competing claims', () => {
  const quests = roster(), started = start(quests, { questId: IDS[1] });
  assert.equal(started.accepted, true);
  assert.deepEqual(started.grants, { coins: 0, gems: 0 });
  const view = getDailyQuestView({ quests: started.quests }, NOW + 1);
  assert.equal(view.quests[1].pending, true);
  assert.equal(view.quests[1].pendingAttemptId, 'ad:1');
  assert.equal(view.adAttempt.id, 'ad:1');
  assert.equal(applyDailyQuestEvent(started.quests, action('quest-claim', { questId: IDS[1] })).accepted, false);
  assert.equal(start(started.quests, { questId: IDS[1], attemptId: 'ad:2' }).accepted, false);
  assert.equal(start(started.quests, { questId: IDS[2], attemptId: 'ad:2' }).accepted, false, 'only one pending provider request');
  assert.equal(finish(started.quests, { questId: IDS[0] }).accepted, false, 'a mismatched quest cannot use the snapshot');
  const completed = finish(started.quests, { questId: IDS[1] });
  assert.deepEqual(completed.grants, { coins: 120, gems: 4 });
  assert.equal(completed.quests.entries[1].claimed, true);
  assert.equal(getDailyQuestView({ quests: completed.quests }, NOW + 2).quests[1].claimMultiplier, 2);
  assert.equal(getDailyQuestView({ quests: completed.quests }, NOW + 2).adAttempt, null);
  assert.equal(finish(completed.quests, { questId: IDS[1], eventId: 'replayed' }).accepted, false);
  assert.equal(start(completed.quests, { questId: IDS[1], attemptId: 'ad:3' }).accepted, false);
  assert.equal(applyDailyQuestEvent(completed.quests, action('quest-claim', { questId: IDS[1] })).accepted, false);
  // Each other quest can still be doubled independently.
  const next = start(completed.quests, { questId: IDS[2], attemptId: 'ad:2', eventId: 'start:2' });
  assert.equal(next.accepted, true);
  assert.deepEqual(finish(next.quests, { questId: IDS[2], attemptId: 'ad:2', eventId: 'finish:2' }).grants, { coins: 200, gems: 8 });
});

test('an incomplete quest cannot reserve an ad or claim any reward', () => {
  const quests = roster({ complete: false });
  assert.equal(start(quests).accepted, false);
  assert.equal(applyDailyQuestEvent(quests, action('quest-claim')).accepted, false);
  assert.equal(finish(quests).accepted, false);
});

test('cancelled, failed and unavailable ads pay nothing and allow a fresh request or standard claim', () => {
  for (const status of ['cancelled', 'failed', 'unavailable']) {
    const failed = finish(start(roster()).quests, { status });
    assert.equal(failed.accepted, true);
    assert.deepEqual(failed.grants, { coins: 0, gems: 0 });
    assert.equal(failed.quests.entries[0].claimed, false);
    assert.equal(failed.quests.activeAdAttemptId, null);
    assert.equal(start(failed.quests).accepted, false, 'settled attempt IDs never reopen');
    const retry = start(failed.quests, { attemptId: 'retry', eventId: 'retry:start', now: NOW + 3 });
    assert.equal(retry.accepted, true);
    assert.deepEqual(finish(retry.quests, { attemptId: 'retry', eventId: 'retry:complete', now: NOW + 4 }).grants, { coins: 40, gems: 0 });
    assert.deepEqual(applyDailyQuestEvent(failed.quests, action('quest-claim', { eventId: 'normal' })).grants, { coins: 20, gems: 0 });
  }
});

test('a valid pending snapshot survives midnight and settles only the old day, even when its ID is on the new roster', () => {
  const started = start(roster()), tomorrow = NOW + 86400000;
  let seed = 0, rolled;
  do { rolled = ensureDailyQuests(started.quests, tomorrow, seed++); } while (!rolled.entries.some(entry => entry.id === IDS[0]));
  assert.equal(rolled.adAttempts['ad:1'].status, 'pending');
  const snapshot = structuredClone(rolled.entries);
  const paid = finish(rolled, { now: tomorrow + 1 });
  assert.deepEqual(paid.grants, { coins: 40, gems: 0 });
  assert.deepEqual(paid.quests.entries, snapshot, 'no new-day progress or claim is changed');
  assert.equal(paid.quests.claimReceipts['quest-ad-complete:event'].dayId, DAY);
  assert.equal(finish(paid.quests, { now: tomorrow + 2, eventId: 'again' }).accepted, false);
  const restored = normalizeDailyQuests(JSON.parse(JSON.stringify(paid.quests)));
  assert.deepEqual(restored, paid.quests);
  assert.equal(finish(restored, { now: tomorrow + 3, eventId: 'again-after-load' }).accepted, false);
});

test('cold reload fails abandoned pending ads without a grant, allowing a same-day retry', () => {
  const started = start(roster());
  const warm = normalizeDailyQuests(JSON.parse(JSON.stringify(started.quests)));
  assert.equal(warm.adAttempts['ad:1'].status, 'pending');
  const cold = normalizeDailyQuests(JSON.parse(JSON.stringify(started.quests)), { cold: true });
  assert.equal(cold.adAttempts['ad:1'].status, 'failed');
  assert.equal(cold.activeAdAttemptId, null);
  assert.equal(cold.entries[0].claimed, false);
  assert.deepEqual(cold.claimReceipts, {});
  assert.equal(finish(cold).accepted, false, 'a late callback cannot pay an abandoned request');
  assert.equal(start(cold, { attemptId: 'fresh-retry', eventId: 'fresh-retry' }).accepted, true);
  assert.deepEqual(applyDailyQuestEvent(cold, action('quest-claim')).grants, { coins: 20, gems: 0 });
});

test('legacy assigned quests retain old rewards in views, standard claims and doubled snapshots', () => {
  const quests = roster({ legacy: true });
  assert.deepEqual(quests.entries[0].reward, { coins: 0, gems: 2 });
  assert.deepEqual(quests.entries[1].reward, { coins: 50, gems: 5 });
  assert.deepEqual(getDailyQuestView({ quests }, NOW).quests[2].reward, { coins: 50, gems: 10 });
  assert.deepEqual(applyDailyQuestEvent(quests, action('quest-claim')).grants, { coins: 0, gems: 2 });
  assert.deepEqual(finish(start(quests, { questId: IDS[1] }).quests, { questId: IDS[1] }).grants, { coins: 100, gems: 10 });
  const incomplete = roster({ legacy: true, complete: false });
  const rerolled = applyDailyQuestEvent(incomplete, action('quest-reroll'));
  assert.equal(rerolled.accepted, true);
  const replacement = rerolled.quests.entries[0];
  assert.deepEqual(replacement.reward, DAILY_QUEST_POOL.find(quest => quest.id === replacement.id).reward);
  assert.deepEqual(rerolled.quests.entries[1].reward, LEGACY_DAILY_QUEST_REWARDS[IDS[1]], 'other assignments keep their snapshots');
  const next = ensureDailyQuests(quests, NOW + 86400000, 8);
  for (const entry of next.entries) assert.deepEqual(entry.reward, DAILY_QUEST_POOL.find(quest => quest.id === entry.id).reward);
});

test('invalid ad identifiers, callback status and completion timing cannot grant currency', () => {
  const quests = roster();
  for (const extras of [{ attemptId: '__proto__' }, { eventId: '__proto__' }, { dayId: '2020-01-01' }, { questId: '__proto__' }]) {
    assert.equal(start(quests, extras).accepted, false);
  }
  const started = start(quests).quests;
  for (const extras of [{ attemptId: '__proto__' }, { eventId: '__proto__' }, { status: 'opened' }, { dayId: '2020-01-01' }, { now: NOW }]) {
    const result = finish(started, extras);
    assert.equal(result.accepted, false);
    assert.deepEqual(result.grants, { coins: 0, gems: 0 });
  }
});

test('the rewarded adapter retains no-video testing and passes only supported placements to a provider', async () => {
  assert.deepEqual(await requestRewardedAd({ attemptId: 'quest-test', placement: 'daily-quests' }), { attemptId: 'quest-test', status: 'completed' });
  const calls = [], provider = { show: async request => { calls.push(request); return { status: 'completed' }; } };
  await requestRewardedAd({ attemptId: 'daily', provider });
  await requestRewardedAd({ attemptId: 'quest', placement: 'daily-quests', provider });
  assert.deepEqual(calls, [{ attemptId: 'daily', placement: 'daily-rewards' }, { attemptId: 'quest', placement: 'daily-quests' }]);
  assert.deepEqual(await requestRewardedAd({ attemptId: 'bad', placement: 'unlimited-currency', provider }), { attemptId: 'bad', status: 'failed' });
  assert.equal(calls.length, 2);
});
