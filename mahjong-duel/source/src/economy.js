import { normalizeWallet } from './daily-rewards.js';

export const DUEL_COIN_REWARDS = Object.freeze({ win: 100, lose: 20, tie: 50 });
export const STARTER_BOOSTER_VERSION = 1;
export const STARTER_BOOSTERS = Object.freeze({ shuffle: 2, hint: 2, freeze: 2, eagle: 2 });
export const emptyCurrencies = () => ({ coins: 0, gems: 0 });
const safeAmount = value => Number.isSafeInteger(value) && value >= 0;
export function normalizeCurrencies(value) {
  return { coins: safeAmount(value?.coins) ? value.coins : 0, gems: safeAmount(value?.gems) ? value.gems : 0 };
}
export function addCurrencies(currencies, grants) {
  const balance = normalizeCurrencies(currencies), reward = normalizeCurrencies(grants);
  return Object.fromEntries(['coins', 'gems'].map(id => [id, Math.min(Number.MAX_SAFE_INTEGER, balance[id] + reward[id])]));
}
export function canAfford(currencies, cost) {
  return Boolean(cost && ['coins', 'gems'].every(id => safeAmount(cost[id]) && normalizeCurrencies(currencies)[id] >= cost[id]));
}

export const SHOP_CURRENCY_PACKS = Object.freeze([
  { id: 'coins-pouch', name: 'Coin Pouch', description: 'A little extra for your next supplies.', grants: { coins: 1000, gems: 0 }, priceUsd: 0.99 },
  { id: 'gems-pouch', name: 'Gem Pouch', description: 'A handful of gems for a useful boost.', grants: { coins: 0, gems: 20 }, priceUsd: 0.99 },
  { id: 'travelers-purse', name: 'Traveler’s Purse', description: 'Gems and coins for the journey ahead.', grants: { coins: 1000, gems: 50 }, priceUsd: 2.99 },
  { id: 'jade-chest', name: 'Jade Chest', description: 'A generous reserve for your favorite boosters.', grants: { coins: 2000, gems: 90 }, priceUsd: 4.99 },
  { id: 'imperial-chest', name: 'Imperial Chest', description: 'Our largest collection of coins and gems.', grants: { coins: 4500, gems: 190 }, priceUsd: 9.99 },
].map(pack => Object.freeze({ ...pack, kind: 'currency', grants: Object.freeze(pack.grants), priceLabel: `$${pack.priceUsd.toFixed(2)}` })));

export const SHOP_BOOSTER_PACKS = Object.freeze([
  { id: 'hint-single', name: 'Hint', description: 'Highlight an available pair.', cost: { coins: 0, gems: 6 }, coinCost: { coins: 1200, gems: 0 }, boosters: { hint: 1 } },
  { id: 'shuffle-single', name: 'Shuffle', description: 'Give the board a fresh arrangement.', cost: { coins: 0, gems: 8 }, coinCost: { coins: 1600, gems: 0 }, boosters: { shuffle: 1 } },
  { id: 'freeze-single', name: 'Freeze', description: 'Skip your opponent’s next turn.', cost: { coins: 0, gems: 10 }, coinCost: { coins: 2000, gems: 0 }, boosters: { freeze: 1 } },
  { id: 'eagle-single', name: 'Eagle Eye', description: 'Reveal rarity glows for ten seconds.', cost: { coins: 0, gems: 4 }, coinCost: { coins: 800, gems: 0 }, boosters: { eagle: 1 } },
  { id: 'focused-mind', name: 'Focused Mind', description: 'Three Hints, one Freeze and one Eagle Eye.', cost: { coins: 300, gems: 20 }, coinCost: { coins: 5200, gems: 0 }, boosters: { hint: 3, freeze: 1, eagle: 1 } },
  { id: 'duel-kit', name: 'Duel Kit', description: 'Three of every booster.', cost: { coins: 1200, gems: 40 }, coinCost: { coins: 12800, gems: 0 }, boosters: { shuffle: 3, hint: 3, freeze: 3, eagle: 3 } },
  { id: 'masters-kit', name: 'Master’s Kit', description: 'Six of every booster.', cost: { coins: 2400, gems: 70 }, coinCost: { coins: 23600, gems: 0 }, boosters: { shuffle: 6, hint: 6, freeze: 6, eagle: 6 } },
].map(pack => Object.freeze({ ...pack, kind: 'booster', cost: Object.freeze(pack.cost), coinCost: Object.freeze(pack.coinCost), boosters: Object.freeze(normalizeWallet(pack.boosters)) })));

/** Resolve only a catalogue price; an invalid payment never falls back to another route. */
export function boosterCost(productOrId, payment = 'primary') {
  const id = typeof productOrId === 'string' ? productOrId : productOrId?.id;
  const pack = SHOP_BOOSTER_PACKS.find(item => item.id === id);
  return pack && payment === 'primary' ? pack.cost : pack && payment === 'coins' ? pack.coinCost : null;
}

/** A single atomic exchange: callers persist the receipt with these balances. */
export function buyBoosterPack(currencies, wallet, productId, payment = 'primary') {
  const pack = SHOP_BOOSTER_PACKS.find(item => item.id === productId);
  const cost = boosterCost(pack, payment);
  if (!pack || !canAfford(currencies, cost)) return null;
  const balance = normalizeCurrencies(currencies), inventory = normalizeWallet(wallet);
  if (Object.keys(inventory).some(id => !Number.isSafeInteger(inventory[id] + pack.boosters[id]))) return null;
  return {
    currencies: { coins: balance.coins - cost.coins, gems: balance.gems - cost.gems },
    wallet: Object.fromEntries(Object.keys(inventory).map(id => [id, inventory[id] + pack.boosters[id]])),
  };
}
