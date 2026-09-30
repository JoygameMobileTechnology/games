import { collectionCount } from './collection.js';
import { rarityForTile } from './rarity.js';
import { themeTileSets } from './tile-data.js';
import { launchThemeIds } from './themes.js';

const LOW_RARITIES = ['marble', 'sapphire'];
const HIGH_RARITIES = ['amethyst', 'gold'];
const LOW_TYPE_TARGETS = [null, { marble: 14, sapphire: 7 }, { marble: 18, sapphire: 8 }, { marble: 22, sapphire: 10 }];

function requirementsFor(collection, ruleset, themeId, rarityIds, matchesPerType, typeTargets = {}) {
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
    const requiredTypes = typeTargets[rarityId] ?? tiles.length;
    // Only the best required number of artworks can advance this goal. Extra
    // copies and additional types remain collected without inflating its bar.
    const completedMatches = tiles.map(tile => Math.min(tile.count, matchesPerType))
      .sort((a, b) => b - a).slice(0, requiredTypes).reduce((sum, count) => sum + count, 0);
    return { themeId, rarityId, requiredTypes, availableTypes: tiles.length, matchesPerType,
      completedTypes: tiles.filter(tile => tile.complete).length,
      completedMatches, requiredMatches: requiredTypes * matchesPerType, tiles };
  });
}

/** A single source for copy-level bars and completed-artwork totals. */
export function getThemeProgress(state) {
  const totals = (state?.requirements ?? []).reduce((sum, goal) => ({
    completedTypes: sum.completedTypes + Math.min(goal.requiredTypes, goal.completedTypes),
    requiredTypes: sum.requiredTypes + goal.requiredTypes,
    completedMatches: sum.completedMatches + goal.completedMatches,
    requiredMatches: sum.requiredMatches + goal.requiredMatches,
  }), { completedTypes: 0, requiredTypes: 0, completedMatches: 0, requiredMatches: 0 });
  const complete = state?.unlocked === true;
  const percent = totals.requiredMatches ? Math.floor(100 * totals.completedMatches / totals.requiredMatches) : complete ? 100 : 0;
  // Saved later-theme collections cannot imply an unlock before its prerequisite.
  return { ...totals, percent: complete ? 100 : Math.min(99, percent), complete };
}

/** Unlocks are derived from saved pair counts, separately for each edition. */
export function getThemeUnlocks(collection, ruleset = 'eastern') {
  const edition = ruleset === 'western' ? 'western' : 'eastern';
  let previousUnlocked = true;
  let nextAssigned = false;
  return launchThemeIds.map((themeId, index) => {
    const requirements = index === 0 ? [] : [
      ...requirementsFor(collection, edition, launchThemeIds[index - 1], LOW_RARITIES, 3, LOW_TYPE_TARGETS[index]),
      ...(index > 1 ? requirementsFor(collection, edition, launchThemeIds[index - 2], HIGH_RARITIES, 2) : []),
    ];
    const unlocked = previousUnlocked && requirements.every(requirement =>
      requirement.requiredTypes > 0 && requirement.completedTypes >= requirement.requiredTypes);
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
