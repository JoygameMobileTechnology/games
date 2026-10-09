import { rarityForTile } from './rarity.js';
import { themeTileSets } from './tile-data.js';
import { launchThemeIds, rulesetForTheme } from './themes.js';

const LOW_TYPE_TARGETS = [null, { marble: 14, sapphire: 7 }, { marble: 18, sapphire: 8 }, { marble: 22, sapphire: 10 }];

function goalsFor(themeId, rarityIds, matchesPerType, typeTargets, editionForTheme) {
  const ruleset = editionForTheme(themeId);
  return rarityIds.map(rarityId => {
    const tiles = themeTileSets[themeId][ruleset]
      .filter(tile => rarityForTile(themeId, ruleset, tile.id)?.id === rarityId);
    return { themeId, ruleset, rarityId, matchesPerType,
      requiredTypes: typeTargets?.[rarityId] ?? tiles.length, tiles };
  });
}

/** Pure gate definitions shared by current progression and the old-save migration. */
export function themeUnlockRequirements(index, editionForTheme = rulesetForTheme) {
  return index === 0 ? [] : [
    ...goalsFor(launchThemeIds[index - 1], ['marble', 'sapphire'], 3, LOW_TYPE_TARGETS[index], editionForTheme),
    ...(index > 1 ? goalsFor(launchThemeIds[index - 2], ['amethyst', 'gold'], 2, null, editionForTheme) : []),
  ];
}

/** Before editions were attached to themes, either complete path earned its unlocks. */
export function legacyUnlockedThemeIds(counts) {
  let furthest = 0;
  for (const edition of ['eastern', 'western']) {
    for (let index = 1; index < launchThemeIds.length; index += 1) {
      const complete = themeUnlockRequirements(index, () => edition).every(goal =>
        goal.tiles.filter(tile => (counts[tile.matchKey] ?? 0) >= goal.matchesPerType).length >= goal.requiredTypes);
      if (!complete) break;
      furthest = Math.max(furthest, index);
    }
  }
  return furthest ? launchThemeIds.slice(0, furthest + 1) : [];
}
