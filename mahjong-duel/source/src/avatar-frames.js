/** Frames are earned from lifetime Achievement Points; points are never spent. */
export const AVATAR_FRAMES = Object.freeze([
  { id: 'bronze', name: 'Bronze Laurel', pointsRequired: 500, tier: 1, description: 'A warm bronze ring with a pair of laurel leaves.' },
  { id: 'porcelain', name: 'Porcelain Crest', pointsRequired: 1500, tier: 2, description: 'Blue porcelain, fine gold edging and a polished crest.' },
  { id: 'jade', name: 'Jade Guardian', pointsRequired: 3000, tier: 3, description: 'Carved jade surrounded by a growing laurel wreath.' },
  { id: 'gold', name: 'Golden Triumph', pointsRequired: 5000, tier: 4, description: 'A golden crown and a full wreath of victory leaves.' },
  { id: 'celestial', name: 'Celestial Glory', pointsRequired: 6500, tier: 5, description: 'A radiant star crown and an ornate celestial wreath.' },
].map(frame => Object.freeze(frame)));

const framesById = new Map(AVATAR_FRAMES.map(frame => [frame.id, frame]));

export function getAvatarFrame(id) {
  return framesById.get(id) ?? null;
}

export function isFrameUnlocked(id, achievementPoints = 0, retainedIds = []) {
  if (id === '') return true;
  const frame = getAvatarFrame(id);
  return Boolean(frame && (Array.isArray(retainedIds) && retainedIds.includes(id) ||
    Number.isSafeInteger(achievementPoints) && achievementPoints >= frame.pointsRequired));
}

export function unlockedFrameIds(achievementPoints = 0, retainedIds = []) {
  return AVATAR_FRAMES.filter(frame => isFrameUnlocked(frame.id, achievementPoints, retainedIds)).map(frame => frame.id);
}

export function resolveFrameId(id, achievementPoints = 0, retainedIds = []) {
  return isFrameUnlocked(id, achievementPoints, retainedIds) ? id : '';
}

/** Used only when importing a pre-v5 AP ledger; new profiles use the current gates. */
export function legacyUnlockedFrameIds(achievementPoints = 0) {
  const previousThresholds = [100, 250, 500, 1000, 1400];
  return Number.isSafeInteger(achievementPoints) && achievementPoints >= 0
    ? AVATAR_FRAMES.filter((_, index) => achievementPoints >= previousThresholds[index]).map(frame => frame.id)
    : [];
}
