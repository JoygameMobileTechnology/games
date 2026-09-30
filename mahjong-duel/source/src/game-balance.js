// Board-size experiment. Catalogue sizes and persistent collection goals stay independent.
export const PAIRS_PER_DUEL = 30;
export const TILES_PER_DUEL = PAIRS_PER_DUEL * 2;
export const PAIRS_TO_WIN = Math.floor(PAIRS_PER_DUEL / 2) + 1;
export const POINTS_PER_PAIR = 100;
export const DUEL_TOTAL_SCORE = PAIRS_PER_DUEL * POINTS_PER_PAIR;

// Each chosen artwork contributes four tiles (two pairs). Positions stay random.
export const RARITY_PAIRS_PER_DUEL = Object.freeze({ marble: 16, sapphire: 8, amethyst: 4, gold: 2 });
