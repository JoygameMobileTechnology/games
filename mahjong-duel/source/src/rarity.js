import { themeTileSets } from './tile-data.js';

/** Art badges only. These values never change draws, matching or points. */
export const RARITIES = Object.freeze([
  { id: 'common', label: 'Common', color: '#a28c72', ink: '#65533e', tint: '#eee4d3', order: 0 },
  { id: 'rare', label: 'Rare', color: '#4a8dd5', ink: '#235487', tint: '#e1edf9', order: 1 },
  { id: 'epic', label: 'Epic', color: '#a06bcc', ink: '#643989', tint: '#eee3f7', order: 2 },
  { id: 'legendary', label: 'Legendary', color: '#d4a13c', ink: '#775218', tint: '#fff0c3', order: 3 },
].map(Object.freeze));
export const rarityById = Object.freeze(Object.fromEntries(RARITIES.map(value => [value.id, value])));

// Curated from the actual 720 sprites: mythical creatures, intricate inventions,
// architectural scenes and detailed showpieces lead each theme's collection.
// Every 40-face edition has 22 Common, 10 Rare, 6 Epic and 2 Legendary pictures.
const picks = {
  'ming-porcelain': {
    eastern: { legendary: 'K01 A11', epic: 'K02 K03 A07 A10 A12 T05', rare: 'G02 G03 G05 G06 K04 K06 A01 A03 A09 A15' },
    western: { legendary: 'W01 W02', epic: 'W03 W17 W21 W24 W34 W36', rare: 'W05 W06 W07 W12 W14 W15 W18 W23 W33 W37' },
  },
  'guo-xi': {
    eastern: { legendary: 'G05 A01', epic: 'T06 G02 G04 K01 K04 A13', rare: 'T04 T05 G01 G06 K03 K06 A07 A09 A10 A15' },
    western: { legendary: 'W01 W07', epic: 'W02 W03 W05 W12 W27 W37', rare: 'W08 W13 W14 W15 W17 W21 W26 W28 W31 W36' },
  },
  'xia-gui': {
    eastern: { legendary: 'G01 K01', epic: 'G02 G03 K02 K03 A13 A15', rare: 'C01 C06 G04 G05 K04 K05 K06 A01 A10 A12' },
    western: { legendary: 'W05 W35', epic: 'W01 W07 W21 W22 W26 W40', rare: 'W04 W06 W08 W12 W17 W18 W20 W23 W30 W37' },
  },
  dancheong: {
    eastern: { legendary: 'A01 A13', epic: 'G06 K05 A02 A05 A09 A14', rare: 'G01 G02 G04 G05 K02 K06 A03 A04 A06 A16' },
    western: { legendary: 'W12 W33', epic: 'W10 W19 W20 W23 W29 W36', rare: 'W02 W05 W06 W07 W08 W09 W21 W22 W24 W32' },
  },
  dunhuang: {
    eastern: { legendary: 'A01 K05', epic: 'K02 A02 A04 A06 A08 A09', rare: 'G01 G02 G03 G04 G05 K01 K03 A03 A07 A11' },
    western: { legendary: 'W01 W02', epic: 'W03 W06 W18 W21 W22 W34', rare: 'W05 W07 W08 W12 W16 W17 W19 W24 W29 W30' },
  },
  'stained-glass': {
    eastern: { legendary: 'A12 A13', epic: 'G06 A04 A05 A06 A09 A11', rare: 'T06 G01 G02 G04 G05 K05 K06 A01 A03 A15' },
    western: { legendary: 'W01 W40', epic: 'W13 W16 W26 W29 W30 W38', rare: 'W02 W04 W11 W12 W14 W15 W17 W18 W21 W32' },
  },
  'dutch-golden-age': {
    eastern: { legendary: 'K06 A11', epic: 'K01 K02 K04 K05 A01 A12', rare: 'G01 G02 A02 A03 A05 A06 A09 A10 A13 A15' },
    western: { legendary: 'W06 W36', epic: 'W01 W02 W04 W05 W10 W12', rare: 'W07 W11 W13 W16 W17 W20 W21 W22 W25 W35' },
  },
  'neon-shrine': {
    eastern: { legendary: 'K01 A01', epic: 'K02 K04 K05 A11 A12 A13', rare: 'T06 G01 G02 K03 K06 A04 A05 A08 A09 A16' },
    western: { legendary: 'W09 W35', epic: 'W01 W05 W18 W19 W22 W40', rare: 'W02 W07 W15 W16 W17 W20 W23 W25 W27 W36' },
  },
  'brass-meridian': {
    eastern: { legendary: 'A04 A12', epic: 'A02 A05 A07 A11 A13 A14', rare: 'G01 G02 G05 K02 K03 K05 A01 A03 A09 A10' },
    western: { legendary: 'W04 W33', epic: 'W02 W05 W10 W16 W36 W40', rare: 'W01 W03 W06 W13 W18 W19 W22 W23 W30 W39' },
  },
};

const assignments = new Map();
for (const [theme, sets] of Object.entries(themeTileSets)) {
  for (const [ruleset, tiles] of Object.entries(sets)) {
    for (const tile of tiles) assignments.set(`${theme}:${ruleset}:${tile.id}`, rarityById.common);
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
