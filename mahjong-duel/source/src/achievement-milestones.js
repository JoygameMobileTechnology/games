import { ACHIEVEMENTS, achievementProgress, awardedAchievementPoints, getCounter, isAchievementId } from './achievements.js';
import { PAIRS_PER_DUEL } from './game-balance.js';

export const ACHIEVEMENT_SHELVES = Object.freeze([
  { id: 'duels', name: 'Duels', description: 'Time at the table, well played.', artKey: 'duelist' },
  { id: 'memory', name: 'Memory', description: 'A careful eye and a lasting impression.', artKey: 'heart' },
  { id: 'comebacks', name: 'Comebacks', description: 'Find your way back into the game.', artKey: 'steps' },
  { id: 'collection', name: 'Collection', description: 'Pictures, traditions and places to play.', artKey: 'cabinet' },
  { id: 'boosters', name: 'Boosters', description: 'Make a little help go a long way.', artKey: 'eagle' },
  { id: 'rituals', name: 'Rituals', description: 'Small returns become familiar rituals.', artKey: 'lantern' },
].map(Object.freeze));

// A family always shares one qualifying counter. Similar-looking conditions
// remain separate, so existing saves and the exact rules behind each unlock hold.
const familyDetails = [
  ['completedDuels', 'completed-duels', 'Duelist', 'duels', 'duelist', `Complete duels by clearing all ${PAIRS_PER_DUEL} pairs. Wins, losses and draws all count.`],
  ['completedWins', 'duel-wins', 'Winning Form', 'duels', 'banner', 'Win completed duels and build your record at the table.'],
  ['personalPairs', 'matched-pairs', 'Pair Collector', 'duels', 'bamboo', 'Match pairs across your duels. Every pair you find adds to your progress.'],
  ['bestPairChain', 'pair-chain', 'Find Your Flow', 'memory', 'ribbon', 'Build your longest run of pairs without a mismatch in one duel.'],
  ['conditionalWins.noBoosters', 'unassisted-win', 'On Your Own', 'duels', 'reed'],
  ['conditionalWins.noMismatch', 'perfect-win', 'Perfect Recall', 'memory', 'flower'],
  ['conditionalWins.recoverFive', 'recover-five', 'Against the Odds', 'comebacks', 'steps'],
  ['conditionalWins.recoverTen', 'recover-ten', 'Rising Again', 'comebacks', 'compass'],
  ['conditionalWins.closeFinish', 'close-finish', 'Close Finish', 'comebacks', 'scales'],
  ['conditionalWins.chainFinishFive', 'strong-finish', 'Strong Finish', 'duels', 'ribbon'],
  ['conditionalWins.frontRunner', 'front-runner', 'Front Runner', 'duels', 'banner'],
  ['conditionalWins.opponentFirst', 'late-bloomer', 'Late Bloomer', 'comebacks', 'flower'],
  ['conditionalWins.threeLeadChanges', 'changing-tides', 'Changing Tides', 'comebacks', 'scales'],
  ['conditionalWins.atMostTwoMisses', 'steady-hand', 'Steady Hand', 'memory', 'fan'],
  ['rememberedPairs', 'remembered-pairs', 'By Heart', 'memory', 'heart', 'Match pairs whose two faces you observed before the attempt began.'],
  ['maxRememberedPairsInDuel', 'duel-recall', 'Attentive Eye', 'memory', 'fan', 'Remember more pairs within a single duel.'],
  ['matchesImmediatelyAfterOpponentMiss', 'opportunity', 'Ready Observer', 'memory', 'screen', 'Match immediately after your opponent makes a mismatch.'],
  ['matchesAfterOwnPreviousAttemptMissed', 'renewed-focus', 'Second Look', 'comebacks', 'reed', 'Find a pair after your previous attempt was a mismatch.'],
  ['maxFullyCollectedFaceKeysInDuel', 'complete-pictures', 'Familiar Pictures', 'memory', 'cabinet', 'Collect both pairs of more different pictures in one duel.'],
  ['pairsWithNeitherFacePreviouslyObserved', 'fresh-discovery', 'A Fresh Discovery', 'memory', 'flower'],
  ['maxDistinctMatchedFaceKeysInDuel', 'broad-attention', 'Broad Attention', 'memory', 'fan'],
  ['delayedRecallPairs', 'lasting-recall', 'Lasting Recall', 'memory', 'heart', 'Remember pairs after at least three intervening attempts since each face was last seen.'],
  ['successfullyFollowedHints', 'followed-hints', 'Guided Hand', 'boosters', 'compass', 'Follow a Hint by matching its exact highlighted pair on your next valid attempt.'],
  ['freezeSavesFollowedByImmediateMatch', 'second-opportunity', 'Second Chance', 'boosters', 'steps'],
  ['freezeSavesFollowedByThreePairRun', 'extended-opportunity', 'Make It Count', 'boosters', 'ribbon'],
  ['paidShufflesFollowedByImmediateMatch', 'fresh-arrangement', 'Fresh Arrangement', 'boosters', 'screen'],
  ['paidShufflesFollowedByThreePairRun', 'fresh-perspective', 'Fresh Perspective', 'boosters', 'fan'],
  ['goldOrCelestialPairsDuringEagleEye', 'rare-find', 'A Rare Find', 'boosters', 'eagle'],
  ['matchedPairsDuringEagleEye', 'guided-attention', 'Guided Attention', 'boosters', 'eagle'],
  ['conditionalWins.exactlyOneBooster', 'measured-assistance', 'Measured Assistance', 'boosters', 'scales'],
  ['conditionalWins.allFourBoosters', 'complete-toolkit', 'A Complete Toolkit', 'boosters', 'cabinet'],
  ['distinctCollectedMatchKeys', 'picture-collection', 'Personal Gallery', 'collection', 'cabinet', 'Discover different tile pictures for your personal collection.'],
  ['distinctCollectedMatchKeysByTheme.ming-porcelain', 'ming-collection', 'Ming Porcelain', 'collection', 'cup'],
  ['distinctCollectedMatchKeysByTheme.dancheong', 'dancheong-collection', 'Dancheong', 'collection', 'flower'],
  ['distinctCollectedMatchKeysByTheme.stained-glass', 'glass-collection', 'Stained Glass', 'collection', 'screen'],
  ['distinctCollectedMatchKeysByTheme.dutch-golden-age', 'dutch-collection', 'Golden Age', 'collection', 'cabinet'],
  ['distinctCompletedFormationIds', 'formations', 'Table Traveller', 'collection', 'compass', 'Complete duels on different board formations.'],
  ['distinctCompletedRulesetIds', 'both-traditions', 'Both Traditions', 'collection', 'fan'],
  ['maxCollectionCountForOneMatchKey', 'familiar-picture', 'A Familiar Picture', 'collection', 'cup'],
  ['distinctCollectedRarityIds', 'every-rarity', 'Every Rarity', 'collection', 'flower'],
  ['distinctLoginDayIds', 'visits', 'Daily Ritual', 'rituals', 'lantern', 'Visit on different UTC days. Missed days never erase your progress.'],
  ['distinctDuelCompletionDayIds', 'playing-days', 'Returning Rival', 'rituals', 'duelist', 'Complete at least one duel on different UTC days.'],
  ['distinctCompletedThemeRulesetCombinations', 'settings', 'Every Setting', 'rituals', 'screen', 'Complete duels in different combinations of tile theme and ruleset.'],
];

export const ACHIEVEMENT_FAMILIES = Object.freeze(familyDetails.map(([counterKey, id, name, shelfId, artKey, description]) => {
  const milestones = Object.freeze(ACHIEVEMENTS.filter(item => item.counterKey === counterKey)
    .sort((a, b) => a.target - b.target).map((item, index) => Object.freeze({ ...item, level: index + 1 })));
  const category = ACHIEVEMENT_SHELVES.find(shelf => shelf.id === shelfId).name;
  return Object.freeze({ id, name, counterKey, category, shelfId, artKey, description: description ?? milestones[0].description,
    milestones, totalLevels: milestones.length, totalPoints: milestones.reduce((sum, milestone) => sum + milestone.points, 0) });
}));

export const achievementFamilyById = Object.freeze(Object.assign(Object.create(null), Object.fromEntries(ACHIEVEMENT_FAMILIES.map(family => [family.id, family]))));
const familyByAchievementId = Object.freeze(Object.assign(Object.create(null), Object.fromEntries(ACHIEVEMENT_FAMILIES.flatMap(family => family.milestones.map(item => [item.id, family])))));

export function familyForAchievement(achievement) {
  const id = typeof achievement === 'string' ? achievement : achievement?.id;
  return isAchievementId(id) ? familyByAchievementId[id] : null;
}

export function achievementFamilyProgress(family, state) {
  const id = typeof family === 'string' ? family : family?.id;
  if (!Object.hasOwn(achievementFamilyById, id)) return null;
  const definition = achievementFamilyById[id];
  const milestones = definition.milestones.map(item => ({ ...item, ...achievementProgress(item, state), awardedPoints: awardedAchievementPoints(item.id, state) }));
  const earned = milestones.filter(item => item.unlocked);
  const nextMilestone = milestones.find(item => !item.unlocked) ?? null;
  const currentMilestone = earned.at(-1) ?? null;
  const current = getCounter(state, definition.counterKey);
  const complete = nextMilestone === null;
  const target = (nextMilestone ?? currentMilestone).target;
  return { ...definition, milestones, current, target, level: currentMilestone?.level ?? 0, unlockedCount: earned.length,
    currentMilestone, nextMilestone, complete, unlocked: earned.length > 0,
    progress: complete ? 1 : Math.min(1, current / target),
    earnedPoints: earned.reduce((sum, item) => sum + item.awardedPoints, 0),
    remainingPoints: milestones.filter(item => !item.unlocked).reduce((sum, item) => sum + item.points, 0),
    nextRewardPoints: nextMilestone?.points ?? 0 };
}
