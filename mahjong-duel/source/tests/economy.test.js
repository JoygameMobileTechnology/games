import test from 'node:test';
import assert from 'node:assert/strict';
import { DUEL_COIN_REWARDS, SHOP_CURRENCY_PACKS, SHOP_BOOSTER_PACKS, normalizeCurrencies, canAfford, buyBoosterPack } from '../src/economy.js';
import { createProgression, normalizeProgression, reduceProgression, saveProgression, loadProgression } from '../src/progression.js';

const NOW = Date.UTC(2026, 8, 30, 10);
const fresh = () => createProgression({ seed: 42 });
const finish = (outcome, gameId = outcome) => ({ type: 'complete', gameId, eventId: `${gameId}:complete`, themeId: 'ming-porcelain', rulesetId: 'eastern', formationId: 'crown', outcome,
  finalPairs: outcome === 'win' ? { you: 21, ai: 19 } : outcome === 'lose' ? { you: 19, ai: 21 } : { you: 20, ai: 20 }, now: NOW });
const purchase = (productId = 'gems-pouch', id = 'one') => ({ type: 'shop-purchase-simulated', productId, transactionId: `transaction:${id}`, eventId: `purchase:${id}`, now: NOW });
const memoryStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
};

test('currency migration starts at zero and preserves old boosters, wins, collection and receipts', () => {
  const legacy = fresh();
  delete legacy.currencies; delete legacy.purchaseReceipts; delete legacy.quests;
  legacy.wallet.hint = 12; legacy.counters.completedWins = 100; legacy.counters.completedDuels = 110;
  legacy.completedGameIds = ['old-win']; legacy.eventReceipts = { old: NOW - 1000 };
  const migrated = normalizeProgression(legacy, { now: NOW });
  assert.deepEqual(migrated.currencies, { coins: 0, gems: 0 });
  for (const key of ['wallet', 'collection', 'counters', 'eventReceipts', 'completedGameIds']) assert.deepEqual(migrated[key], legacy[key]);
  assert.strictEqual(reduceProgression(migrated, finish('win', 'old-win')), migrated);
});

test('only completed valid boards pay win100, lose20 or tie50, exactly once', () => {
  assert.deepEqual(DUEL_COIN_REWARDS, { win: 100, lose: 20, tie: 50 });
  let state = fresh();
  const invalid = [finish('win'), finish('lose'), finish('tie')].flatMap(event => [
    { ...event, finalPairs: { you: 21, ai: 0 } }, { ...event, outcome: 'incorrect' }, { ...event, themeId: 'missing' },
  ]);
  for (const event of invalid) assert.strictEqual(reduceProgression(state, event), state);
  for (const outcome of ['win', 'lose', 'tie']) {
    const before = state.currencies.coins, event = finish(outcome);
    state = reduceProgression(state, event);
    assert.equal(state.currencies.coins - before, DUEL_COIN_REWARDS[outcome]);
    assert.equal(state.currencies.gems, 0);
    assert.strictEqual(reduceProgression(state, event), state);
    assert.strictEqual(reduceProgression(state, { ...event, eventId: `${outcome}:replay` }), state);
  }
  assert.equal(state.currencies.coins, 170);
});

test('currency packs require the explicitly simulated event and deduplicate transaction IDs across reload', () => {
  const state = fresh(), event = purchase();
  for (const invalid of [{ ...event, type: 'shop-purchase' }, { ...event, transactionId: '' }, { ...event, eventId: '' }, { ...event, productId: 'hint-single' }]) {
    assert.strictEqual(reduceProgression(state, invalid), state);
  }
  const bought = reduceProgression(state, event);
  assert.deepEqual(bought.currencies, { coins: 0, gems: 15 });
  assert.deepEqual(bought.wallet, state.wallet);
  assert.strictEqual(reduceProgression(bought, event), bought);
  assert.strictEqual(reduceProgression(bought, { ...event, eventId: 'different-event' }), bought);
  assert.strictEqual(reduceProgression(bought, { ...event, transactionId: 'different-transaction' }), bought);
  const storage = memoryStorage(); saveProgression(bought, storage);
  const restored = loadProgression({ storage, now: NOW });
  assert.deepEqual(restored.currencies, bought.currencies);
  assert.deepEqual(restored.purchaseReceipts, bought.purchaseReceipts);
  assert.strictEqual(reduceProgression(restored, { ...event, eventId: 'different-after-reload' }), restored);
  const again = reduceProgression(restored, purchase('gems-pouch', 'two'));
  assert.deepEqual(again.currencies, { coins: 0, gems: 30 });
});

test('single and mixed-cost booster packs exchange balances and inventory atomically', () => {
  let state = reduceProgression(fresh(), purchase('jade-chest'));
  for (const pack of SHOP_BOOSTER_PACKS) {
    const before = structuredClone(state), event = { type: 'shop-buy', productId: pack.id, eventId: `buy:${pack.id}`, now: NOW };
    state = reduceProgression(state, event);
    assert.equal(state.currencies.coins, before.currencies.coins - pack.cost.coins);
    assert.equal(state.currencies.gems, before.currencies.gems - pack.cost.gems);
    for (const id of Object.keys(state.wallet)) assert.equal(state.wallet[id], before.wallet[id] + pack.boosters[id]);
    assert.strictEqual(reduceProgression(state, event), state);
  }
});

test('insufficient funds, unsafe inventory and fake products never spend or grant anything', () => {
  const empty = fresh();
  for (const pack of SHOP_BOOSTER_PACKS) {
    assert.equal(canAfford(empty.currencies, pack.cost), false);
    assert.strictEqual(reduceProgression(empty, { type: 'shop-buy', eventId: pack.id, productId: pack.id, now: NOW }), empty);
  }
  const coinsOnly = { ...fresh(), currencies: { coins: 10000, gems: 0 } };
  assert.strictEqual(reduceProgression(coinsOnly, { type: 'shop-buy', eventId: 'mixed', productId: 'duel-kit', now: NOW }), coinsOnly);
  const gemsOnly = { ...fresh(), currencies: { coins: 0, gems: 10000 } };
  assert.strictEqual(reduceProgression(gemsOnly, { type: 'shop-buy', eventId: 'mixed', productId: 'duel-kit', now: NOW }), gemsOnly);
  assert.equal(buyBoosterPack({ coins: 10, gems: 10 }, {}, 'not-a-pack'), null);
  const full = { ...fresh(), currencies: { coins: 100, gems: 100 }, wallet: { ...empty.wallet, hint: Number.MAX_SAFE_INTEGER } };
  assert.strictEqual(reduceProgression(full, { type: 'shop-buy', eventId: 'full', productId: 'hint-single', now: NOW }), full);
  full.currencies.gems = Number.MAX_SAFE_INTEGER;
  assert.strictEqual(reduceProgression(full, purchase()), full);
});

test('catalogue products have fixed valid costs, rewards and prices; bad saved balances are discarded', () => {
  assert.equal(new Set([...SHOP_CURRENCY_PACKS, ...SHOP_BOOSTER_PACKS].map(pack => pack.id)).size, SHOP_CURRENCY_PACKS.length + SHOP_BOOSTER_PACKS.length);
  for (const pack of SHOP_CURRENCY_PACKS) {
    assert.ok(pack.grants.coins + pack.grants.gems > 0);
    assert.equal(pack.priceLabel, `$${pack.priceUsd.toFixed(2)}`);
    assert.ok([0.99, 2.99, 4.99, 9.99].includes(pack.priceUsd));
  }
  for (const pack of SHOP_BOOSTER_PACKS) {
    assert.ok(pack.cost.gems > 0);
    assert.ok(Object.values(pack.boosters).some(value => value > 0));
    assert.equal(canAfford(pack.cost, pack.cost), true);
  }
  assert.deepEqual(normalizeCurrencies({ coins: -1, gems: '4' }), { coins: 0, gems: 0 });
  assert.equal(canAfford({ coins: 10, gems: 10 }, { coins: -1, gems: 0 }), false);
  const dirty = fresh();
  dirty.currencies = { coins: Infinity, gems: Number.MAX_SAFE_INTEGER + 1 };
  dirty.purchaseReceipts = JSON.parse(`{"__proto__":{"eventId":"x","productId":"gems-pouch","at":${NOW}},"bad":{"eventId":"x","productId":"fake","at":${NOW}}}`);
  const safe = normalizeProgression(dirty, { now: NOW });
  assert.deepEqual(safe.currencies, { coins: 0, gems: 0 });
  assert.deepEqual(safe.purchaseReceipts, {});
});
