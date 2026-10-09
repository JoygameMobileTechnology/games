import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CaretDown, CaretRight, Check, DiceFive, LockKey } from '@phosphor-icons/react';
import { ProgressionPage } from './progression-page.jsx';
import { themeById, rulesetForTheme } from './themes.js';
import { themeTileSets } from './tile-data.js';
import { boardVariants } from './board-variants.js';
import { rarityById } from './rarity.js';
import { getThemeProgress, getThemeUnlocks } from './theme-unlocks.js';
import { t, formatNumber, getLanguage } from './i18n.js';
import './theme-select-page.css';

const SIGNATURES = {
  'ming-porcelain': { eastern: 'K01', western: 'W01' },
  dancheong: { eastern: 'A01', western: 'W19' },
  'stained-glass': { eastern: 'A13', western: 'W40' },
  'dutch-golden-age': { eastern: 'A11', western: 'W06' },
};
const format = value => formatNumber(Number(value || 0));

export function ThemeArtwork({ theme, surfaceSrc }) {
  const ruleset = rulesetForTheme(theme.id);
  const tile = themeTileSets[theme.id][ruleset].find(face => face.id === SIGNATURES[theme.id][ruleset]);
  return <span className="theme-choice-art" aria-hidden="true">
    <img className="theme-choice-surface" src={surfaceSrc || boardVariants[theme.id].portrait.src} alt="" draggable="false" />
    <span className="theme-choice-tile"><img src={tile.src} alt="" draggable="false" /></span>
  </span>;
}

function UnlockGoals({ state, prerequisite }) {
  const id = useId(), totals = getThemeProgress(state);
  const dependencies = [...new Set(state.requirements.map(goal => goal.themeId))];
  return <div className="theme-unlock-body">
    <section className="theme-unlock-intro" aria-labelledby={`${id}-title`}>
      <span className="theme-unlock-seal" aria-hidden="true"><LockKey size={26} weight="duotone" /></span>
      <h3 id={`${id}-title`}>{t('A new collection awaits')}</h3>
      <p>{t('Collect in {themes} to unlock {theme}.', { themes: dependencies.map(themeId => t(themeById[themeId].name)).join(t(' and ')), theme: t(themeById[state.themeId].name) })}</p>
      <span className="theme-unlock-edition">{t('Collection progress')}</span>
      {prerequisite && <p className="theme-unlock-prerequisite"><LockKey size={19} weight="fill" aria-hidden="true" /><span>{t('Unlock {theme} first, then complete these goals.', { theme: t(themeById[prerequisite.themeId].name) })}</span></p>}
      <div className="theme-unlock-total"><strong>{t('{count} / {total} artworks ready', { count: format(totals.completedTypes), total: format(totals.requiredTypes) })} <span>{totals.percent}%</span></strong><progress value={totals.percent} max={100} aria-label={t('Collection progress toward this theme')} /><small>{t('{count} / {total} required matches collected', { count: format(totals.completedMatches), total: format(totals.requiredMatches) })}</small></div>
      <p className="theme-unlock-help">{t('Every matching pair adds one copy. Partial copies count toward the bar; extra copies of a ready artwork do not. Meet each goal below; your collection is never spent.')}</p>
    </section>
    <div className="theme-unlock-goals">{state.requirements.map((goal, index) => {
      const rarity = rarityById[goal.rarityId], complete = goal.completedTypes >= goal.requiredTypes;
      const tiles = [...goal.tiles].sort((a, b) => Number(a.complete) - Number(b.complete) || b.count - a.count || t(a.name).localeCompare(t(b.name), getLanguage()));
      return <details className={`theme-unlock-goal ${complete ? 'is-complete' : ''}`} key={`${goal.themeId}:${goal.rarityId}`}>
        <summary tabIndex={0} aria-controls={`${id}-tiles-${index}`}>
          <span className="theme-goal-heading"><span>{t(themeById[goal.themeId].name)}</span><strong><span className="theme-goal-rarity" style={{ '--goal-color': rarity.color, '--goal-ink': rarity.ink }} aria-hidden="true" />{t(rarity.label)}<small>{goal.requiredTypes === goal.availableTypes ? t('All {count} artworks', { count: goal.availableTypes }) : t('Any {count} of {total} artworks', { count: goal.requiredTypes, total: goal.availableTypes })} · {t('{count} matches each', { count: goal.matchesPerType })}</small></strong></span>
          <span className="theme-goal-fraction"><strong>{Math.min(goal.completedTypes, goal.requiredTypes)} / {goal.requiredTypes}</strong><small>{t('artworks ready')}</small><span>{complete ? <><Check size={14} weight="bold" />{t('Complete')}</> : <>{t('View tiles')}<CaretDown size={14} weight="bold" /></>}</span></span>
        </summary>
        <div className="theme-goal-progress"><progress value={goal.completedMatches} max={goal.requiredMatches || 1} aria-label={t('{theme} {rarity}: {count} of {total} required matches collected', { theme: t(themeById[goal.themeId].name), rarity: t(rarity.label), count: goal.completedMatches, total: goal.requiredMatches })} /></div>
        <ul className="theme-goal-tiles" id={`${id}-tiles-${index}`}>{tiles.map(tile => <li className={tile.complete ? 'is-complete' : ''} key={tile.matchKey}>
          <img src={tile.src} alt="" loading="lazy" width="38" height="48" />
          <span><strong>{t(tile.name)}</strong><small>{tile.complete ? t('Ready') : t('Matched {count} of {total} times', { count: format(tile.count), total: tile.required })}</small></span>
          <span className="theme-goal-tile-count" aria-label={t('{name}, {count} of {total} matches', { name: t(tile.name), count: format(tile.count), total: tile.required })}>{tile.complete ? <Check size={19} weight="bold" aria-hidden="true" /> : <>{Math.min(tile.count, tile.required)}<small>/{tile.required}</small></>}</span>
        </li>)}</ul>
      </details>;
    })}</div>
  </div>;
}

/** Theme availability is derived from collected pairs; a locked card only opens its goals. */
export function ThemeSelectPage({ collection, initialTheme, initialScrollTop = 0, populationCounts = {}, onClose, onPlay }) {
  const unlocks = useMemo(() => getThemeUnlocks(collection), [collection]);
  const [selection, setSelection] = useState(() => initialTheme === 'random' ? 'random' : unlocks.find(state => state.themeId === initialTheme && state.unlocked)?.themeId || unlocks.find(state => state.unlocked)?.themeId);
  const [inspectedId, setInspectedId] = useState(null);
  const scroller = useRef(null), scrollPosition = useRef(0), opener = useRef(null), restoreFocus = useRef(false);
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = initialScrollTop; }, []);
  const inspected = unlocks.find(state => state.themeId === inspectedId);
  const previousInspected = inspected ? unlocks[unlocks.indexOf(inspected) - 1] : null;
  const selected = unlocks.find(state => state.themeId === selection && state.unlocked);
  const chosen = selection === 'random' ? 'random' : selected?.themeId || unlocks.find(state => state.unlocked)?.themeId;
  useEffect(() => {
    if (!inspected && restoreFocus.current) {
      if (scroller.current) scroller.current.scrollTop = scrollPosition.current;
      scroller.current?.querySelector(`[data-theme="${opener.current}"]`)?.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
  }, [inspected]);
  const closeDetails = () => { restoreFocus.current = true; setInspectedId(null); };
  const choose = (state, event) => {
    if (state.unlocked) { setSelection(state.themeId); return; }
    scrollPosition.current = scroller.current?.scrollTop || 0;
    opener.current = state.themeId;
    setInspectedId(state.themeId);
  };
  return <ProgressionPage title={inspected ? t('Unlock {theme}', { theme: t(themeById[inspected.themeId].name) }) : t('Choose a theme')} className={`theme-select-page ${inspected ? 'is-viewing-goals' : ''}`} onClose={inspected ? closeDetails : onClose} closeLabel={t(inspected ? 'Back to theme selection' : 'Back to main menu')}>
    {inspected ? <div className="theme-unlock-scroll"><UnlockGoals state={inspected} prerequisite={previousInspected && !previousInspected.unlocked ? previousInspected : null} /></div> : <>
      <div className="theme-choice-scroll" ref={scroller}>
        <p className="theme-choice-edition">{t('Your collections')}<span>{t('Collect tiles to unlock new themes')}</span></p>
        <button type="button" className={`theme-random-choice ${chosen === 'random' ? 'is-selected' : ''}`} aria-pressed={chosen === 'random'} onClick={() => setSelection('random')}>
          <span><strong>{t('Random Match')}</strong><small>{t('Unlocked themes only')}</small></span><span className="theme-random-dice" aria-hidden="true"><DiceFive size={41} weight="duotone" /><DiceFive size={33} weight="duotone" /></span>{chosen === 'random' ? <Check size={24} weight="bold" aria-hidden="true" /> : <CaretRight size={24} weight="bold" aria-hidden="true" />}
        </button>
        <div className="theme-choice-list" role="group" aria-label={t('Choose your duel theme')}>{unlocks.map((state, index) => {
          const theme = themeById[state.themeId], totals = getThemeProgress(state), selected = chosen === theme.id;
          const prerequisite = index > 0 && !unlocks[index - 1].unlocked ? unlocks[index - 1] : null;
          return <button type="button" className={`theme-choice-card ${state.unlocked ? 'is-unlocked' : 'is-locked'} ${selected ? 'is-selected' : ''}`} data-theme={theme.id} key={theme.id} aria-pressed={state.unlocked ? selected : undefined} aria-label={state.unlocked ? t(theme.name) : t('{theme}, locked. View unlock requirements', { theme: t(theme.name) })} onClick={event => choose(state, event)}>
            <ThemeArtwork theme={theme} />
            <span className="theme-choice-copy"><strong className="theme-choice-name">{t(theme.name)}</strong><span className="theme-choice-population"><span aria-hidden="true" />{t('Players online · {count}', { count: format(populationCounts[theme.id]) })}</span>
              {!state.unlocked && <span className="theme-choice-lock"><LockKey size={23} weight="fill" aria-hidden="true" /><span><strong>{prerequisite ? t('Unlock {theme} first', { theme: t(themeById[prerequisite.themeId].name) }) : t(state.nextToUnlock ? 'Next to unlock' : 'Locked')}</strong><small>{t('{count} / {total} artworks ready', { count: totals.completedTypes, total: totals.requiredTypes })} · {totals.percent}%</small><progress value={totals.percent} max={100} aria-label={t('{theme} unlock progress', { theme: t(theme.name) })} /></span></span>}
            </span>
            {selected && <span className="theme-choice-check" aria-hidden="true"><Check size={24} weight="bold" /></span>}
          </button>;
        })}</div>
      </div>
      <footer className="theme-choice-footer"><button type="button" className="progression-primary theme-choice-play" disabled={!chosen} onClick={() => onPlay(chosen, scroller.current?.scrollTop || 0)}>{t('Play')}<CaretRight size={26} weight="bold" /></button><span className="theme-choice-selection-note">{chosen === 'random' ? t('A surprise from your unlocked collections') : t(themeById[chosen]?.name)}</span></footer>
    </>}
  </ProgressionPage>;
}
