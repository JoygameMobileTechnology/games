import { themeTileSets } from './tile-data.js';

/** Art badges only. These values never change draws, matching or points. */
export const RARITIES = Object.freeze([
  { id: 'bamboo', code: 'B', label: 'Bamboo', color: '#4b9c61', ink: '#286139', tint: '#e3f1df', order: 0 },
  { id: 'granite', code: 'G', label: 'Granite', color: '#84909c', ink: '#46515d', tint: '#e7ebef', order: 1 },
  { id: 'amethyst', code: 'A', label: 'Amethyst', color: '#a06bcc', ink: '#643989', tint: '#eee3f7', order: 2 },
  { id: 'gold', code: 'AU', label: 'Gold', color: '#d4a13c', ink: '#775218', tint: '#fff0c3', order: 3 },
  { id: 'celestial', code: 'GK', label: 'Celestial', color: '#37bcb3', ink: '#166f69', tint: '#daf7f1', order: 4 },
].map(Object.freeze));
export const rarityById = Object.freeze(Object.fromEntries(RARITIES.map(value => [value.id, value])));

// Curated from the actual 720 sprites: mythical creatures, intricate inventions,
// architectural scenes and detailed showpieces lead each theme's collection.
// Every 40-face edition has 22 Bamboo, 10 Granite, 5 Amethyst, 2 Gold and
// 1 Celestial picture; the final tier is reserved for its signature showpiece.
const picks = {
  'ming-porcelain': {
    eastern: { celestial: 'K01', gold: 'A11 K02', amethyst: 'K03 A07 A10 A12 T05', granite: 'G02 G03 G05 G06 K04 K06 A01 A03 A09 A15' },
    western: { celestial: 'W01', gold: 'W02 W34', amethyst: 'W03 W17 W21 W24 W36', granite: 'W05 W06 W07 W12 W14 W15 W18 W23 W33 W37' },
  },
  'guo-xi': {
    eastern: { celestial: 'G05', gold: 'A01 T06', amethyst: 'G02 G04 K01 K04 A13', granite: 'T04 T05 G01 G06 K03 K06 A07 A09 A10 A15' },
    western: { celestial: 'W01', gold: 'W07 W27', amethyst: 'W02 W03 W05 W12 W37', granite: 'W08 W13 W14 W15 W17 W21 W26 W28 W31 W36' },
  },
  'xia-gui': {
    eastern: { celestial: 'G01', gold: 'K01 K03', amethyst: 'G02 G03 K02 A13 A15', granite: 'C01 C06 G04 G05 K04 K05 K06 A01 A10 A12' },
    western: { celestial: 'W35', gold: 'W05 W26', amethyst: 'W01 W07 W21 W22 W40', granite: 'W04 W06 W08 W12 W17 W18 W20 W23 W30 W37' },
  },
  dancheong: {
    eastern: { celestial: 'A01', gold: 'A13 K05', amethyst: 'G06 A02 A05 A09 A14', granite: 'G01 G02 G04 G05 K02 K06 A03 A04 A06 A16' },
    western: { celestial: 'W33', gold: 'W12 W19', amethyst: 'W10 W20 W23 W29 W36', granite: 'W02 W05 W06 W07 W08 W09 W21 W22 W24 W32' },
  },
  dunhuang: {
    eastern: { celestial: 'A01', gold: 'K05 A06', amethyst: 'K02 A02 A04 A08 A09', granite: 'G01 G02 G03 G04 G05 K01 K03 A03 A07 A11' },
    western: { celestial: 'W01', gold: 'W02 W34', amethyst: 'W03 W06 W18 W21 W22', granite: 'W05 W07 W08 W12 W16 W17 W19 W24 W29 W30' },
  },
  'stained-glass': {
    eastern: { celestial: 'A13', gold: 'A12 A11', amethyst: 'G06 A04 A05 A06 A09', granite: 'T06 G01 G02 G04 G05 K05 K06 A01 A03 A15' },
    western: { celestial: 'W01', gold: 'W40 W30', amethyst: 'W13 W16 W26 W29 W38', granite: 'W02 W04 W11 W12 W14 W15 W17 W18 W21 W32' },
  },
  'dutch-golden-age': {
    eastern: { celestial: 'K06', gold: 'A11 K01', amethyst: 'K02 K04 K05 A01 A12', granite: 'G01 G02 A02 A03 A05 A06 A09 A10 A13 A15' },
    western: { celestial: 'W36', gold: 'W06 W10', amethyst: 'W01 W02 W04 W05 W12', granite: 'W07 W11 W13 W16 W17 W20 W21 W22 W25 W35' },
  },
  'neon-shrine': {
    eastern: { celestial: 'K01', gold: 'A01 A13', amethyst: 'K02 K04 K05 A11 A12', granite: 'T06 G01 G02 K03 K06 A04 A05 A08 A09 A16' },
    western: { celestial: 'W35', gold: 'W09 W40', amethyst: 'W01 W05 W18 W19 W22', granite: 'W02 W07 W15 W16 W17 W20 W23 W25 W27 W36' },
  },
  'brass-meridian': {
    eastern: { celestial: 'A04', gold: 'A12 A07', amethyst: 'A02 A05 A11 A13 A14', granite: 'G01 G02 G05 K02 K03 K05 A01 A03 A09 A10' },
    western: { celestial: 'W33', gold: 'W04 W16', amethyst: 'W02 W05 W10 W36 W40', granite: 'W01 W03 W06 W13 W18 W19 W22 W23 W30 W39' },
  },
};

const assignments = new Map();
for (const [theme, sets] of Object.entries(themeTileSets)) {
  for (const [ruleset, tiles] of Object.entries(sets)) {
    for (const tile of tiles) assignments.set(`${theme}:${ruleset}:${tile.id}`, rarityById.bamboo);
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
