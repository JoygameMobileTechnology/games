/** A completed one-time trophy has the same finish as a mastered milestone trophy. */
export function getTrophyGlory(level = 0, totalLevels = 1) {
  if (level <= 0) return 0;
  if (totalLevels <= 1) return 5;
  return Math.min(5, 1 + Math.floor((level - 1) * 4 / (totalLevels - 1)));
}
