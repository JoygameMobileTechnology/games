import React from 'react';
import { Books, CheckCircle } from '@phosphor-icons/react';
import { getThemeProgress, getThemeUnlocks } from './theme-unlocks.js';
import { themeById } from './themes.js';
import './collection-progress-summary.css';

/** Compares saved collections from the start and end of this duel, never estimates. */
export function CollectionProgressSummary({ beforeCollection, collection, ruleset = 'eastern' }) {
  const edition = ruleset === 'western' ? 'western' : 'eastern';
  const before = getThemeUnlocks(beforeCollection ?? collection, edition);
  const after = getThemeUnlocks(collection, edition);
  const newlyUnlocked = after.filter((state, index) => state.unlocked && !before[index].unlocked);
  const next = after.find(state => state.nextToUnlock);
  // On an unlock, finish the goal the player was advancing before introducing
  // the new target. This keeps a full bar from abruptly appearing empty.
  const target = newlyUnlocked[0] ?? next;
  const progress = getThemeProgress(target);
  const earlier = getThemeProgress(before.find(state => state.themeId === target?.themeId));
  const gain = Math.max(0, progress.completedMatches - earlier.completedMatches);
  const editionName = edition === 'western' ? 'Western' : 'Eastern';
  return <section className={`collection-progress-summary ${newlyUnlocked.length ? 'has-unlock' : ''}`} aria-label={`${editionName} collection progress`}>
    <div className="collection-progress-heading">
      {target?.unlocked || !target ? <CheckCircle size={25} weight="duotone" aria-hidden="true" /> : <Books size={25} weight="duotone" aria-hidden="true" />}
      <div><small>{editionName} collection</small><strong>{newlyUnlocked.length ? `${newlyUnlocked.map(state => themeById[state.themeId].name).join(' & ')} unlocked!` : target ? `Next: ${themeById[target.themeId].name}` : 'All themes unlocked'}</strong></div>
      {target && <b>{progress.percent}%</b>}
    </div>
    {target ? <>
      <progress value={progress.percent} max={100} aria-label={`${themeById[target.themeId].name} unlock progress`} />
      <div className="collection-progress-meta"><span>{progress.completedTypes} / {progress.requiredTypes} artworks ready</span><strong>{gain > 0 ? `+${gain} required match${gain === 1 ? '' : 'es'}` : 'Collection saved'}</strong></div>
      {newlyUnlocked.length && next ? <small className="collection-progress-next">Next: {themeById[next.themeId].name} · {getThemeProgress(next).percent}%</small> : <small className="collection-progress-next">{newlyUnlocked.length ? 'Every theme in this edition is ready to play.' : gain > 0 ? 'Progress earned in this duel.' : 'Every pair is kept; extra copies of ready artworks do not advance this goal.'}</small>}
    </> : <small className="collection-progress-next">Your matched pairs keep adding to your Collection.</small>}
  </section>;
}
