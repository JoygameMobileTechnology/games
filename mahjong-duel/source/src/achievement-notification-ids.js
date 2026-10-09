import { activeAchievementIdFor } from './achievements.js';

/** Announce evaluator-awarded levels, never receipts synthesized by migration. */
export function newAchievementNotificationIds(previous, next) {
  const known = new Set([
    ...Object.keys(previous.unlocked),
    ...previous.newAchievementIds,
  ].map(activeAchievementIdFor).filter(Boolean));
  return [...new Set(next.newAchievementIds.map(activeAchievementIdFor).filter(id =>
    id && Object.hasOwn(next.unlocked, id) && !known.has(id)))];
}
