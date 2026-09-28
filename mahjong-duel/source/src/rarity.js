import { themeTileSets } from './tile-data.js';

/** Cosmetic tiers only. These values never change draws, matching or points. */
export const RARITIES = Object.freeze([
  { id: 'marble', code: 'M', label: 'Marble', color: '#f3eddd', ink: '#635d53', tint: '#f7f3e9', order: 0 },
  { id: 'sapphire', code: 'S', label: 'Sapphire', color: '#4c8fdf', ink: '#225597', tint: '#e1edfc', order: 1 },
  { id: 'amethyst', code: 'A', label: 'Amethyst', color: '#a06bcc', ink: '#643989', tint: '#eee3f7', order: 2 },
  { id: 'gold', code: 'AU', label: 'Gold', color: '#d4a13c', ink: '#775218', tint: '#fff0c3', order: 3 },
].map(Object.freeze));
export const rarityById = Object.freeze(Object.fromEntries(RARITIES.map(value => [value.id, value])));

// Curated from the actual 720 sprites: mythical creatures, intricate inventions,
// architectural scenes and detailed showpieces lead each theme's collection.
// Every 40-face edition has 22 Marble, 10 Sapphire, 5 Amethyst and 3 Gold
// pictures. Gold includes the former Celestial signature showpieces.
const picks = {
  'ming-porcelain': {
    eastern: { gold: 'A11 K02 K01', amethyst: 'K03 A07 A10 A12 T05', sapphire: 'G02 G03 G05 G06 K04 K06 A01 A03 A09 A15' },
    western: { gold: 'W02 W34 W01', amethyst: 'W03 W17 W21 W24 W36', sapphire: 'W05 W06 W07 W12 W14 W15 W18 W23 W33 W37' },
  },
  'guo-xi': {
    eastern: { gold: 'A01 T06 G05', amethyst: 'G02 G04 K01 K04 A13', sapphire: 'T04 T05 G01 G06 K03 K06 A07 A09 A10 A15' },
    western: { gold: 'W07 W27 W01', amethyst: 'W02 W03 W05 W12 W37', sapphire: 'W08 W13 W14 W15 W17 W21 W26 W28 W31 W36' },
  },
  'xia-gui': {
    eastern: { gold: 'K01 K03 G01', amethyst: 'G02 G03 K02 A13 A15', sapphire: 'C01 C06 G04 G05 K04 K05 K06 A01 A10 A12' },
    western: { gold: 'W05 W26 W35', amethyst: 'W01 W07 W21 W22 W40', sapphire: 'W04 W06 W08 W12 W17 W18 W20 W23 W30 W37' },
  },
  dancheong: {
    eastern: { gold: 'A13 K05 A01', amethyst: 'G06 A02 A05 A09 A14', sapphire: 'G01 G02 G04 G05 K02 K06 A03 A04 A06 A16' },
    western: { gold: 'W12 W19 W33', amethyst: 'W10 W20 W23 W29 W36', sapphire: 'W02 W05 W06 W07 W08 W09 W21 W22 W24 W32' },
  },
  dunhuang: {
    eastern: { gold: 'K05 A06 A01', amethyst: 'K02 A02 A04 A08 A09', sapphire: 'G01 G02 G03 G04 G05 K01 K03 A03 A07 A11' },
    western: { gold: 'W02 W34 W01', amethyst: 'W03 W06 W18 W21 W22', sapphire: 'W05 W07 W08 W12 W16 W17 W19 W24 W29 W30' },
  },
  'stained-glass': {
    eastern: { gold: 'A12 A11 A13', amethyst: 'G06 A04 A05 A06 A09', sapphire: 'T06 G01 G02 G04 G05 K05 K06 A01 A03 A15' },
    western: { gold: 'W40 W30 W01', amethyst: 'W13 W16 W26 W29 W38', sapphire: 'W02 W04 W11 W12 W14 W15 W17 W18 W21 W32' },
  },
  'dutch-golden-age': {
    eastern: { gold: 'A11 K01 K06', amethyst: 'K02 K04 K05 A01 A12', sapphire: 'G01 G02 A02 A03 A05 A06 A09 A10 A13 A15' },
    western: { gold: 'W06 W10 W36', amethyst: 'W01 W02 W04 W05 W12', sapphire: 'W07 W11 W13 W16 W17 W20 W21 W22 W25 W35' },
  },
  'neon-shrine': {
    eastern: { gold: 'A01 A13 K01', amethyst: 'K02 K04 K05 A11 A12', sapphire: 'T06 G01 G02 K03 K06 A04 A05 A08 A09 A16' },
    western: { gold: 'W09 W40 W35', amethyst: 'W01 W05 W18 W19 W22', sapphire: 'W02 W07 W15 W16 W17 W20 W23 W25 W27 W36' },
  },
  'brass-meridian': {
    eastern: { gold: 'A12 A07 A04', amethyst: 'A02 A05 A11 A13 A14', sapphire: 'G01 G02 G05 K02 K03 K05 A01 A03 A09 A10' },
    western: { gold: 'W04 W16 W33', amethyst: 'W02 W05 W10 W36 W40', sapphire: 'W01 W03 W06 W13 W18 W19 W22 W23 W30 W39' },
  },
};

const assignments = new Map();
for (const [theme, sets] of Object.entries(themeTileSets)) {
  for (const [ruleset, tiles] of Object.entries(sets)) {
    for (const tile of tiles) assignments.set(`${theme}:${ruleset}:${tile.id}`, rarityById.marble);
    const used = new Set();
    for (const [rarity, ids] of Object.entries(picks[theme][ruleset])) {
      for (const id of ids.split(' ')) {
        const key = `${theme}:${ruleset}:${id}`;
        if (!assignments.has(key) || used.has(id)) throw new Error(`Invalid curated rarity: ${key}`);
        used.add(id); assignments.set(key, rarityById[rarity]);
      }
    }
  }
}

/** Unknown catalogue identities return null rather than inventing a collectible. */
export function rarityForTile(themeId, ruleset, faceId) {
  return assignments.get(`${themeId}:${ruleset}:${faceId}`) ?? null;
}
