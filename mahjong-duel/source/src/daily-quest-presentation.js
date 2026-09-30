/** Concise objective copy, separate from the stable quest identity and reward rules. */
export function getDailyQuestPresentation(quest) {
  const count = quest.target;
  const pairs = `${count} ${count === 1 ? 'pair' : 'pairs'}`;
  if (quest.metric.startsWith('rarity:')) {
    const rarity = quest.metric.slice(7);
    return { title: `Match ${count} ${rarity[0].toUpperCase() + rarity.slice(1)} ${count === 1 ? 'pair' : 'pairs'}` };
  }
  switch (quest.metric) {
    case 'pairs': return { title: `Match ${pairs}` };
    case 'wins': return { title: `Win ${count === 1 ? 'a duel' : `${count} duels`}` };
    case 'duels': return { title: `Finish ${count === 1 ? 'a duel' : `${count} duels`}`, detail: 'Win or lose.' };
    case 'chain': return { title: `Match ${pairs} in a row`, detail: 'Without a mismatch.', bestRun: true };
    case 'unique': return { title: `Match ${count} different tiles`, detail: 'Each distinct artwork counts once.' };
    case 'attempts': return { title: `Make ${count} attempts`, detail: 'Every two-tile attempt counts.' };
    case 'opening': return { title: 'Find your first pair', detail: 'In any duel.' };
    case 'counter:rememberedPairs': return { title: `Match ${pairs} from memory`, detail: 'Both tiles must have been seen before.' };
    case 'counter:matchesAfterOwnPreviousAttemptMissed': return { title: `Recover ${count} ${count === 1 ? 'match' : 'matches'}`, detail: 'Find a pair immediately after your own miss.' };
    default: return { title: quest.description.replace(/\.$/, '') };
  }
}
