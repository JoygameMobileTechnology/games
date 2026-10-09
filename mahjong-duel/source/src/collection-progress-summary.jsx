import { t, formatNumber as format } from './i18n.js';
import React from 'react';
import { Books, CheckCircle } from '@phosphor-icons/react';
import { getThemeProgress, getThemeUnlocks } from './theme-unlocks.js';
import { themeById } from './themes.js';
import './collection-progress-summary.css';

/** Compares saved collections from the start and end of this duel, never estimates. */
export function CollectionProgressSummary({ beforeCollection, collection }) {
  const before = getThemeUnlocks(beforeCollection ?? collection);
  const after = getThemeUnlocks(collection);
  const newlyUnlocked = after.filter((state, index) => state.unlocked && !before[index].unlocked);
  const next = after.find(state => state.nextToUnlock);
  // On an unlock, finish the goal the player was advancing before introducing
  // the new target. This keeps a full bar from abruptly appearing empty.
  const target = newlyUnlocked[0] ?? next;
  const progress = getThemeProgress(target);
  const earlier = getThemeProgress(before.find(state => state.themeId === target?.themeId));
  const gain = Math.max(0, progress.completedMatches - earlier.completedMatches);
  return <section className={`collection-progress-summary ${newlyUnlocked.length ? 'has-unlock' : ''}`} aria-label={t('Collection progress')}>
    <div className="collection-progress-heading">
      {target?.unlocked || !target ? <CheckCircle size={25} weight="duotone" aria-hidden="true" /> : <Books size={25} weight="duotone" aria-hidden="true" />}
      <div><small>{t('Your collections')}</small><strong>{newlyUnlocked.length ? t('{names} unlocked!', { names: newlyUnlocked.map(state => t(themeById[state.themeId].name)).join(t(' & ')) }) : target ? t('Next: {name}', { name: t(themeById[target.themeId].name) }) : t('All themes unlocked')}</strong></div>
      {target && <b>{t('{count}%', { count: format(progress.percent) })}</b>}
    </div>
    {target ? <>
      <progress value={progress.percent} max={100} aria-label={t('{name} unlock progress', { name: t(themeById[target.themeId].name) })} />
      <div className="collection-progress-meta"><span>{t('{current} / {total} artworks ready', { current: format(progress.completedTypes), total: format(progress.requiredTypes) })}</span><strong>{gain > 0 ? t(gain === 1 ? '+{count} required match' : '+{count} required matches', { count: format(gain) }) : t('Collection saved')}</strong></div>
      {newlyUnlocked.length && next ? <small className="collection-progress-next">{t('Next: {name} · {percent}%', { name: t(themeById[next.themeId].name), percent: format(getThemeProgress(next).percent) })}</small> : <small className="collection-progress-next">{t(newlyUnlocked.length ? 'Every theme is ready to play.' : gain > 0 ? 'Progress earned in this duel.' : 'Every pair is kept; extra copies of ready artworks do not advance this goal.')}</small>}
    </> : <small className="collection-progress-next">{t('Your matched pairs keep adding to your Collection.')}</small>}
  </section>;
}
