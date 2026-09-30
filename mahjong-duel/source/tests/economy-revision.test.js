import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOP_BOOSTER_PACKS, SHOP_CURRENCY_PACKS, STARTER_BOOSTERS, STARTER_BOOSTER_VERSION, boosterCost, buyBoosterPack } from '../src/economy.js';
import { applyDailyEvent, createDailyState, emptyRewards, emptyWallet, getDailyView, normalizeDaily, normalizeRewards, normalizeWallet, rewardsForLogin } from '../src/daily-rewards.js';

const day = number => Date.UTC(2026, 8, number, 12);
const login = (daily, number) => applyDailyEvent(daily, { type: 'login', now: day(number) }).daily;

test('revised currency packages and once-only sampler use the approved quantities', () => {
  assert.equal(STARTER_BOOSTER_VERSION, 1);
  assert.deepEqual(STARTER_BOOSTERS, { hint: 2, shuffle: 2, freeze: 2, eagle: 2 });
  assert.deepEqual(SHOP_CURRENCY_PACKS.map(({ grants, priceUsd }) => [grants.coins, grants.gems, priceUsd]), [
    [1000, 0, .99], [0, 20, .99], [1000, 50, 2.99], [2000, 90, 4.99], [4500, 190, 9.99],
  ]);
});

test('every booster payment choice charges only the selected price and grants its full contents', () => {
  const expected = {
    'hint-single': [0, 6, 1200, { hint: 1 }], 'shuffle-single': [0, 8, 1600, { shuffle: 1 }],
    'freeze-single': [0, 10, 2000, { freeze: 1 }], 'eagle-single': [0, 4, 800, { eagle: 1 }],
    'focused-mind': [300, 20, 5200, { hint: 3, freeze: 1, eagle: 1 }],
    'duel-kit': [1200, 40, 12800, { hint: 3, shuffle: 3, freeze: 3, eagle: 3 }],
    'masters-kit': [2400, 70, 23600, { hint: 6, shuffle: 6, freeze: 6, eagle: 6 }],
  };
  for (const pack of SHOP_BOOSTER_PACKS) {
    const [coins, gems, alternateCoins, grant] = expected[pack.id];
    assert.deepEqual(pack.cost, { coins, gems });
    assert.deepEqual(pack.coinCost, { coins: alternateCoins, gems: 0 });
    assert.equal(alternateCoins, (coins + gems * 50) * 4);
    assert.deepEqual(pack.boosters, normalizeWallet(grant));
    for (const payment of ['primary', 'coins']) {
      const cost = boosterCost(pack, payment), balance = { coins: 30000, gems: 1000 };
      const inventory = { hint: 7, shuffle: 5, freeze: 3, eagle: 1 };
      const result = buyBoosterPack(balance, inventory, pack.id, payment);
      assert.deepEqual(result.currencies, { coins: balance.coins - cost.coins, gems: balance.gems - cost.gems });
      for (const id of Object.keys(inventory)) assert.equal(result.wallet[id], inventory[id] + pack.boosters[id]);
      assert.deepEqual(buyBoosterPack(cost, {}, pack.id, payment)?.currencies, { coins: 0, gems: 0 });
      const short = { ...cost }, currency = payment === 'coins' ? 'coins' : 'gems';
      short[currency] -= 1;
      assert.equal(buyBoosterPack(short, inventory, pack.id, payment), null);
      assert.deepEqual(balance, { coins: 30000, gems: 1000 }, 'the exchange does not mutate its inputs');
    }
    assert.equal(boosterCost(pack, 'invalid'), null);
    assert.equal(buyBoosterPack({ coins: 30000, gems: 1000 }, {}, pack.id, 'invalid'), null);
    assert.equal(buyBoosterPack({ coins: pack.coinCost.coins, gems: 0 }, {}, pack.id), null, 'never silently substitute Coins for the primary price');
  }
  assert.equal(boosterCost('missing'), null);
  assert.equal(boosterCost(null), null);
  assert.deepEqual(boosterCost({ id: 'hint-single', cost: { coins: 0, gems: 0 } }), { coins: 0, gems: 6 }, 'only canonical catalogue prices are accepted');
});

test('the first 30 new login rewards pay 845 Coins and 26 boosters, and double exactly once', () => {
  let daily = createDailyState();
  const total = emptyRewards();
  for (let index = 1; index <= 30; index++) {
    const reward = rewardsForLogin(index);
    for (const id of Object.keys(total)) total[id] += reward[id];
    daily = login(daily, index);
  }
  assert.deepEqual(total, { coins: 845, hint: 10, shuffle: 6, freeze: 5, eagle: 5 });
  assert.deepEqual(getDailyView({ daily }, day(30)).rewards, total);
  const standard = applyDailyEvent(daily, { type: 'daily-claim', eventId: 'standard', now: day(30) });
  assert.deepEqual(standard.grants, total);
  assert.deepEqual(applyDailyEvent(standard.daily, { type: 'daily-claim', eventId: 'standard-replay', now: day(30) }).grants, emptyRewards());
  daily = applyDailyEvent(daily, { type: 'daily-ad-start', attemptId: 'double', now: day(30) }).daily;
  const doubled = applyDailyEvent(daily, { type: 'daily-ad-complete', attemptId: 'double', eventId: 'double-claim', status: 'completed', now: day(30) });
  assert.deepEqual(doubled.grants, { coins: 1690, hint: 20, shuffle: 12, freeze: 10, eagle: 10 });
  assert.deepEqual(applyDailyEvent(doubled.daily, { type: 'daily-ad-complete', attemptId: 'double', eventId: 'double-replay', status: 'completed', now: day(30) }).grants, emptyRewards());
  assert.deepEqual(rewardsForLogin(30), { coins: 25, hint: 1, shuffle: 2, freeze: 1, eagle: 1 });
  assert.deepEqual(rewardsForLogin(31), { coins: 30, hint: 0, shuffle: 0, freeze: 0, eagle: 1 });
});

test('Coin-only login days claim normally and failed doubles preserve both kinds of rewards', () => {
  let daily = createDailyState();
  for (let index = 1; index <= 4; index++) {
    daily = login(daily, index);
    if (index < 4) daily = applyDailyEvent(daily, { type: 'daily-claim', eventId: `claim:${index}`, now: day(index) }).daily;
  }
  assert.deepEqual(getDailyView({ daily }, day(4)).rewards, { ...emptyRewards(), coins: 40 });
  daily = applyDailyEvent(daily, { type: 'daily-ad-start', attemptId: 'failed', now: day(4) }).daily;
  const failed = applyDailyEvent(daily, { type: 'daily-ad-complete', attemptId: 'failed', eventId: 'failure', status: 'failed', now: day(4) });
  assert.deepEqual(failed.grants, emptyRewards());
  assert.deepEqual(applyDailyEvent(failed.daily, { type: 'daily-claim', eventId: 'standard', now: day(4) }).grants, { ...emptyRewards(), coins: 40 });
});

test('saved entitlements keep their earned amounts, including legacy states without snapshots', () => {
  const loginDayIds = Array.from({ length: 30 }, (_, index) => new Date(day(index + 1)).toISOString().slice(0, 10));
  const legacy = normalizeDaily({ loginDayIds });
  const legacyTotal = getDailyView({ daily: legacy }, day(30)).rewards;
  assert.equal(legacyTotal.coins, 0);
  assert.equal(Object.values(normalizeWallet(legacyTotal)).reduce((sum, value) => sum + value, 0), 86);
  const saved = { loginDayIds: [loginDayIds[0]], entitlements: { [`login:${loginDayIds[0]}`]: { rewards: { hint: 7, freeze: 3, coins: 99 } } } };
  const restored = normalizeDaily(saved);
  assert.deepEqual(getDailyView({ daily: restored }, day(1)).rewards, { ...emptyRewards(), hint: 7, freeze: 3, coins: 99 });
  assert.deepEqual(normalizeDaily(restored), restored, 'reload does not reprice earned rewards');
  const next = login(legacy, 31);
  assert.deepEqual(next.entitlements['login:2026-10-01'].rewards, rewardsForLogin(31), 'new login days use the new schedule');
});

test('reward normalization supports Coins without adding currencies to the booster inventory', () => {
  assert.deepEqual(emptyWallet(), { shuffle: 0, hint: 0, freeze: 0, eagle: 0 });
  assert.deepEqual(normalizeWallet({ hint: 2, coins: 500, gems: 10 }), { shuffle: 0, hint: 2, freeze: 0, eagle: 0 });
  assert.deepEqual(normalizeRewards({ hint: 2, coins: 500, gems: 10 }), { ...emptyRewards(), hint: 2, coins: 500 });
  assert.deepEqual(normalizeRewards({ coins: -5, hint: Infinity, shuffle: '2' }), emptyRewards());
  assert.deepEqual(rewardsForLogin(0), emptyRewards());
});
