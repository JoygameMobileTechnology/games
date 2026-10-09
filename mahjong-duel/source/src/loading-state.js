import { themes, rulesetForTheme } from './themes.js';
import { themeTileSets } from './tile-data.js';

const STORAGE_KEY = 'porcelain:loadingTheme';

function availableStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

/** Each launch previews one collection, excluding the previous loading screen. */
export function chooseLoadingTheme(previousId, random = Math.random) {
  const choices = themes.filter(theme => theme.id !== previousId);
  return choices[Math.floor(random() * choices.length)];
}

/** Preview distinct artwork from a single collection, without repeating a face. */
export function chooseLoadingTiles(themeId, count = 12, random = Math.random) {
  if (!themes.some(theme => theme.id === themeId)) return [];
  const ids = new Set(), sources = new Set();
  const choices = themeTileSets[themeId][rulesetForTheme(themeId)].filter(tile => {
    if (ids.has(tile.id) || sources.has(tile.src)) return false;
    ids.add(tile.id);
    sources.add(tile.src);
    return true;
  });
  for (let index = choices.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [choices[index], choices[other]] = [choices[other], choices[index]];
  }
  return choices.slice(0, Math.max(0, Math.min(choices.length, Math.floor(count))));
}

export function takeLoadingTheme(storage = availableStorage(), random = Math.random) {
  let previousId = null;
  try { previousId = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null'); } catch { /* Ignore unavailable or corrupt preferences. */ }
  const theme = chooseLoadingTheme(previousId, random);
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(theme.id)); } catch { /* Loading still works when storage is blocked or full. */ }
  return theme;
}
