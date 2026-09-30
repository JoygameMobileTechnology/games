import { collectionCount } from './collection.js';
import { rarityForTile } from './rarity.js';
import { themeTileSets } from './tile-data.js';
import { launchThemeIds } from './themes.js';

const LOW_RARITIES = ['marble', 'sapphire'];
const HIGH_RARITIES = ['amethyst', 'gold'];

function requirementsFor(collection, ruleset, themeId, rarityIds, matchesPerType) {
  return rarityIds.map(rarityId => {
    const tiles = themeTileSets[themeId][ruleset]
      .filter(tile => rarityForTile(themeId, ruleset, tile.id)?.id === rarityId)
      .map(tile => {
        const count = collectionCount(collection, tile.matchKey);
        return {
          matchKey: tile.matchKey, name: tile.name, src: tile.src,
          count, required: matchesPerType, complete: count >= matchesPerType,
        };
      });
    return {
      themeId, rarityId, requiredTypes: tiles.length, matchesPerType,
      completedTypes: tiles.filter(tile => tile.complete).length, tiles,
    };
  });
}

/** Unlocks are derived from saved pair counts, separately for each edition. */
export function getThemeUnlocks(collection, ruleset = 'eastern') {
  const edition = ruleset === 'western' ? 'western' : 'eastern';
  let previousUnlocked = true;
  let nextAssigned = false;
  return launchThemeIds.map((themeId, index) => {
    const requirements = index === 0 ? [] : [
      ...requirementsFor(collection, edition, launchThemeIds[index - 1], LOW_RARITIES, 3),
      ...(index > 1 ? requirementsFor(collection, edition, launchThemeIds[index - 2], HIGH_RARITIES, 2) : []),
    ];
    const unlocked = previousUnlocked && requirements.every(requirement =>
      requirement.requiredTypes > 0 && requirement.completedTypes === requirement.requiredTypes);
    const nextToUnlock = !unlocked && !nextAssigned;
    if (nextToUnlock) nextAssigned = true;
    previousUnlocked = unlocked;
    return { themeId, unlocked, nextToUnlock, requirements };
  });
}

/** Guard every deal entry point; random selection cannot bypass collection gates. */
export function choosePlayableTheme(collection, ruleset, requestedId, random = Math.random) {
  const unlocked = getThemeUnlocks(collection, ruleset).filter(theme => theme.unlocked);
  if (requestedId !== 'random') return unlocked.find(theme => theme.themeId === requestedId)?.themeId ?? null;
  if (!unlocked.length) return null;
  const draw = typeof random === 'function' ? random() : 0;
  const bounded = Number.isFinite(draw) ? Math.min(1, Math.max(0, draw)) : 0;
  return unlocked[Math.min(unlocked.length - 1, Math.floor(bounded * unlocked.length))].themeId;
}
