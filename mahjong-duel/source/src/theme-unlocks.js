import { collectionCount } from './collection.js';
import { launchThemeIds } from './themes.js';
import { themeUnlockRequirements } from './theme-unlock-requirements.js';

function requirementsFor(collection, index) {
  return themeUnlockRequirements(index).map(({ themeId, ruleset, rarityId, matchesPerType, requiredTypes, tiles: faces }) => {
    const tiles = faces.map(tile => {
      const count = collectionCount(collection, tile.matchKey);
      return {
        matchKey: tile.matchKey, name: tile.name, src: tile.src,
        count, required: matchesPerType, complete: count >= matchesPerType,
      };
    });
    // Only the best required number of artworks can advance this goal. Extra
    // copies and additional types remain collected without inflating its bar.
    const completedMatches = tiles.map(tile => Math.min(tile.count, matchesPerType))
      .sort((a, b) => b - a).slice(0, requiredTypes).reduce((sum, count) => sum + count, 0);
    return { themeId, ruleset, rarityId, requiredTypes, availableTypes: tiles.length, matchesPerType,
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

/** One theme path, with each prerequisite using its own fixed tile edition. */
export function getThemeUnlocks(collection) {
  const retained = new Set(Array.isArray(collection?.retainedThemeIds) ? collection.retainedThemeIds : []);
  let previousUnlocked = true;
  let nextAssigned = false;
  return launchThemeIds.map((themeId, index) => {
    const requirements = requirementsFor(collection, index);
    const unlocked = previousUnlocked && (retained.has(themeId) || requirements.every(requirement =>
      requirement.requiredTypes > 0 && requirement.completedTypes >= requirement.requiredTypes));
    const nextToUnlock = !unlocked && !nextAssigned;
    if (nextToUnlock) nextAssigned = true;
    previousUnlocked = unlocked;
    return { themeId, unlocked, nextToUnlock, requirements };
  });
}

/** Guard every deal entry point; random selection cannot bypass collection gates. */
export function choosePlayableTheme(collection, requestedId, random = Math.random) {
  const unlocked = getThemeUnlocks(collection).filter(theme => theme.unlocked);
  if (requestedId !== 'random') return unlocked.find(theme => theme.themeId === requestedId)?.themeId ?? null;
  if (!unlocked.length) return null;
  const draw = typeof random === 'function' ? random() : 0;
  const bounded = Number.isFinite(draw) ? Math.min(1, Math.max(0, draw)) : 0;
  return unlocked[Math.min(unlocked.length - 1, Math.floor(bounded * unlocked.length))].themeId;
}
