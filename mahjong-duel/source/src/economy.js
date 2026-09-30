import { normalizeWallet } from './daily-rewards.js';

export const DUEL_COIN_REWARDS = Object.freeze({ win: 100, lose: 20, tie: 50 });
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
  { id: 'coins-pouch', name: 'Coin Pouch', description: 'A little extra for your next supplies.', grants: { coins: 500, gems: 0 }, priceUsd: 0.99 },
  { id: 'gems-pouch', name: 'Gem Pouch', description: 'A handful of gems for a useful boost.', grants: { coins: 0, gems: 15 }, priceUsd: 0.99 },
  { id: 'travelers-purse', name: 'Traveler’s Purse', description: 'Gems and coins for the journey ahead.', grants: { coins: 500, gems: 50 }, priceUsd: 2.99 },
  { id: 'jade-chest', name: 'Jade Chest', description: 'A generous reserve for your favorite boosters.', grants: { coins: 1000, gems: 100 }, priceUsd: 4.99 },
  { id: 'imperial-chest', name: 'Imperial Chest', description: 'Our largest collection of coins and gems.', grants: { coins: 2500, gems: 230 }, priceUsd: 9.99 },
].map(pack => Object.freeze({ ...pack, kind: 'currency', grants: Object.freeze(pack.grants), priceLabel: `$${pack.priceUsd.toFixed(2)}` })));

export const SHOP_BOOSTER_PACKS = Object.freeze([
  { id: 'hint-single', name: 'Hint', description: 'Highlight an available pair.', cost: { coins: 0, gems: 3 }, boosters: { hint: 1 } },
  { id: 'shuffle-single', name: 'Shuffle', description: 'Give the board a fresh arrangement.', cost: { coins: 0, gems: 4 }, boosters: { shuffle: 1 } },
  { id: 'freeze-single', name: 'Freeze', description: 'Skip your opponent’s next turn.', cost: { coins: 0, gems: 5 }, boosters: { freeze: 1 } },
  { id: 'eagle-single', name: 'Eagle Eye', description: 'Reveal rarity glows for ten seconds.', cost: { coins: 0, gems: 6 }, boosters: { eagle: 1 } },
  { id: 'focused-mind', name: 'Focused Mind', description: 'Three Hints and one Freeze.', cost: { coins: 100, gems: 10 }, boosters: { hint: 3, freeze: 1 } },
  { id: 'duel-kit', name: 'Duel Kit', description: 'One of every booster.', cost: { coins: 150, gems: 12 }, boosters: { shuffle: 1, hint: 1, freeze: 1, eagle: 1 } },
  { id: 'masters-kit', name: 'Master’s Kit', description: 'Two of every booster.', cost: { coins: 400, gems: 20 }, boosters: { shuffle: 2, hint: 2, freeze: 2, eagle: 2 } },
].map(pack => Object.freeze({ ...pack, kind: 'booster', cost: Object.freeze(pack.cost), boosters: Object.freeze(normalizeWallet(pack.boosters)) })));

/** A single atomic exchange: callers persist the receipt with these balances. */
export function buyBoosterPack(currencies, wallet, productId) {
  const pack = SHOP_BOOSTER_PACKS.find(item => item.id === productId);
  if (!pack || !canAfford(currencies, pack.cost)) return null;
  const balance = normalizeCurrencies(currencies), inventory = normalizeWallet(wallet);
  if (Object.keys(inventory).some(id => !Number.isSafeInteger(inventory[id] + pack.boosters[id]))) return null;
  return {
    currencies: { coins: balance.coins - pack.cost.coins, gems: balance.gems - pack.cost.gems },
    wallet: Object.fromEntries(Object.keys(inventory).map(id => [id, inventory[id] + pack.boosters[id]])),
  };
}
