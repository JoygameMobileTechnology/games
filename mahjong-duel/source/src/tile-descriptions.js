import { themeTileSets } from './tile-data.js';
import { inkLore } from './tile-lore-ink.js';
import { sacredLore } from './tile-lore-sacred.js';
import { workshopLore } from './tile-lore-workshop.js';
import { neonLore } from './tile-lore-neon.js';

// Sources and interpretation boundaries are recorded in docs/tile-lore-*-sources.md.
const lore = { ...inkLore, ...sacredLore, ...workshopLore, ...neonLore };

const aliases = {
  'ming-porcelain': {
    'Spread-wing bat': 'Bat', 'Leaping carp': 'Carp', 'Standing crane': 'Crane',
    'Open-wing butterfly': 'Butterfly', 'Walking tortoise': 'Tortoise',
    'Coiled dragon': 'Dragon', 'Flaming qilin': 'Qilin', 'Seated lion': 'Lion',
    'Rearing horse': 'Horse', 'Crouching rabbit': 'Rabbit', 'Antlered deer': 'Deer',
    'Conch shell': 'Conch', 'Coral branch': 'Coral', 'Grape cluster': 'Grapes',
  },
  'guo-xi': { 'Arched bridge': 'Bridge' },
  'xia-gui': { 'Bamboo branch': 'Bamboo sprig' },
  dancheong: {
    'Bamboo clump': 'Bamboo', 'Peony bloom': 'Peony crest', 'Long-neck vase': 'Vase',
    'Cloud scroll': 'Cloud swirl',
  },
  'neon-shrine': {
    'Fox spirit': 'Fox companion', 'Komainu guardian': 'Komainu', 'Koi spirit': 'Koi',
    'Tanuki companion': 'Tanuki', 'Tortoise familiar': 'Tortoise', 'Magatama charm': 'Magatama',
  },
};

/** Returns cultural context for a known collectible face, or null for an unknown ID. */
export function tileDescription(themeId, ruleset, tileId) {
  const tile = themeTileSets[themeId]?.[ruleset]?.find(candidate => candidate.id === tileId);
  if (!tile) return null;
  const notes = lore[themeId];
  if (tile.family === 'count') return notes?.counts[tile.rank - 1] ?? null;
  if (tile.family === 'tier') return notes?.tiers[tile.rank - 1] ?? null;
  const subject = aliases[themeId]?.[tile.name] || tile.name;
  return notes?.subjects[subject] ?? null;
}
