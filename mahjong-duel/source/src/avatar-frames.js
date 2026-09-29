/** Frames are earned from lifetime Achievement Points; points are never spent. */
export const AVATAR_FRAMES = Object.freeze([
  { id: 'bronze', name: 'Bronze Laurel', pointsRequired: 100, tier: 1, description: 'A warm bronze ring with a pair of laurel leaves.' },
  { id: 'porcelain', name: 'Porcelain Crest', pointsRequired: 250, tier: 2, description: 'Blue porcelain, fine gold edging and a polished crest.' },
  { id: 'jade', name: 'Jade Guardian', pointsRequired: 500, tier: 3, description: 'Carved jade surrounded by a growing laurel wreath.' },
  { id: 'gold', name: 'Golden Triumph', pointsRequired: 1000, tier: 4, description: 'A golden crown and a full wreath of victory leaves.' },
  { id: 'celestial', name: 'Celestial Glory', pointsRequired: 1400, tier: 5, description: 'A radiant star crown and an ornate celestial wreath.' },
].map(frame => Object.freeze(frame)));

const framesById = new Map(AVATAR_FRAMES.map(frame => [frame.id, frame]));

export function getAvatarFrame(id) {
  return framesById.get(id) ?? null;
}

export function isFrameUnlocked(id, achievementPoints = 0) {
  if (id === '') return true;
  const frame = getAvatarFrame(id);
  return Boolean(frame && Number.isSafeInteger(achievementPoints) && achievementPoints >= frame.pointsRequired);
}

export function unlockedFrameIds(achievementPoints = 0) {
  return AVATAR_FRAMES.filter(frame => isFrameUnlocked(frame.id, achievementPoints)).map(frame => frame.id);
}

export function resolveFrameId(id, achievementPoints = 0) {
  return isFrameUnlocked(id, achievementPoints) ? id : '';
}
