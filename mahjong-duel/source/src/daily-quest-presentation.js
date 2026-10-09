const english = (source, values = {}) => source.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);

/** Concise objective copy, separate from stable quest identities and reward rules. */
export function getDailyQuestPresentation(quest, translate = english) {
  const t = translate, count = quest.target, values = { count };
  if (quest.metric.startsWith('rarity:')) {
    const rarity = quest.metric.slice(7);
    return { title: t(count === 1 ? 'Match {count} {rarity} pair' : 'Match {count} {rarity} pairs', {
      count, rarity: t(rarity[0].toUpperCase() + rarity.slice(1)),
    }) };
  }
  switch (quest.metric) {
    case 'pairs': return { title: t(count === 1 ? 'Match {count} pair' : 'Match {count} pairs', values) };
    case 'wins': return { title: t(count === 1 ? 'Win a duel' : 'Win {count} duels', values) };
    case 'duels': return { title: t(count === 1 ? 'Finish a duel' : 'Finish {count} duels', values), detail: t('Win or lose.') };
    case 'chain': return { title: t(count === 1 ? 'Match {count} pair in a row' : 'Match {count} pairs in a row', values), detail: t('Without a mismatch.'), bestRun: true };
    case 'unique': return { title: t('Match {count} different tiles', values), detail: t('Each distinct artwork counts once.') };
    case 'attempts': return { title: t('Make {count} attempts', values), detail: t('Every two-tile attempt counts.') };
    case 'opening': return { title: t('Find your first pair'), detail: t('In any duel.') };
    case 'counter:rememberedPairs': return { title: t(count === 1 ? 'Match {count} pair from memory' : 'Match {count} pairs from memory', values), detail: t('Both tiles must have been seen before.') };
    case 'counter:matchesAfterOwnPreviousAttemptMissed': return { title: t(count === 1 ? 'Recover {count} match' : 'Recover {count} matches', values), detail: t('Find a pair immediately after your own miss.') };
    default: return { title: t(quest.description).replace(/\.$/, '') };
  }
}
