import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CaretDown, CaretRight, Check, DiceFive, LockKey } from '@phosphor-icons/react';
import { ProgressionPage } from './progression-page.jsx';
import { themeById } from './themes.js';
import { themeTileSets } from './tile-data.js';
import { boardVariants } from './board-variants.js';
import { rarityById } from './rarity.js';
import { getThemeUnlocks } from './theme-unlocks.js';
import './theme-select-page.css';

const SIGNATURES = {
  'ming-porcelain': { eastern: 'K01', western: 'W01' },
  dancheong: { eastern: 'A01', western: 'W19' },
  'stained-glass': { eastern: 'A13', western: 'W40' },
  'dutch-golden-age': { eastern: 'A11', western: 'W06' },
};
const format = value => Number(value || 0).toLocaleString();
const goalTotals = requirements => requirements.reduce((sum, goal) => ({
  completed: sum.completed + Math.min(goal.requiredTypes, goal.completedTypes),
  required: sum.required + goal.requiredTypes,
}), { completed: 0, required: 0 });

export function ThemeArtwork({ theme, ruleset }) {
  const tile = themeTileSets[theme.id][ruleset].find(face => face.id === SIGNATURES[theme.id][ruleset]);
  return <span className="theme-choice-art" aria-hidden="true">
    <img className="theme-choice-surface" src={boardVariants[theme.id].portrait.src} alt="" draggable="false" />
    <span className="theme-choice-tile"><img src={tile.src} alt="" draggable="false" /></span>
  </span>;
}

function UnlockGoals({ state, ruleset, prerequisite }) {
  const id = useId(), totals = goalTotals(state.requirements);
  const dependencies = [...new Set(state.requirements.map(goal => goal.themeId))];
  return <div className="theme-unlock-body">
    <section className="theme-unlock-intro" aria-labelledby={`${id}-title`}>
      <span className="theme-unlock-seal" aria-hidden="true"><LockKey size={26} weight="duotone" /></span>
      <h3 id={`${id}-title`}>A new collection awaits</h3>
      <p>Collect in {dependencies.map(themeId => themeById[themeId].name).join(' and ')} to unlock {themeById[state.themeId].name}.</p>
      <span className="theme-unlock-edition">{ruleset === 'western' ? 'Western' : 'Eastern'} collection progress</span>
      {prerequisite && <p className="theme-unlock-prerequisite"><LockKey size={19} weight="fill" aria-hidden="true" /><span>Unlock <strong>{themeById[prerequisite.themeId].name}</strong> first, then complete these goals.</span></p>}
      <div className="theme-unlock-total"><strong>{format(totals.completed)} / {format(totals.required)} tile goals complete</strong><progress value={totals.completed} max={totals.required || 1} aria-label="Collection goals completed for this theme" /></div>
      <p className="theme-unlock-help">Each matching pair you collect adds one. Meet every goal below; your collection is never spent.</p>
    </section>
    <div className="theme-unlock-goals">{state.requirements.map((goal, index) => {
      const rarity = rarityById[goal.rarityId], complete = goal.completedTypes >= goal.requiredTypes;
      const tiles = [...goal.tiles].sort((a, b) => Number(a.complete) - Number(b.complete) || b.count - a.count || a.name.localeCompare(b.name));
      return <details className={`theme-unlock-goal ${complete ? 'is-complete' : ''}`} key={`${goal.themeId}:${goal.rarityId}`}>
        <summary tabIndex={0} aria-controls={`${id}-tiles-${index}`}>
          <span className="theme-goal-heading"><span>{themeById[goal.themeId].name}</span><strong><span className="theme-goal-rarity" style={{ '--goal-color': rarity.color, '--goal-ink': rarity.ink }} aria-hidden="true" />{rarity.label}<small>Match each tile {goal.matchesPerType} times</small></strong></span>
          <span className="theme-goal-fraction"><strong>{Math.min(goal.completedTypes, goal.requiredTypes)} / {goal.requiredTypes}</strong><span>{complete ? <><Check size={14} weight="bold" />Complete</> : <>View tiles<CaretDown size={14} weight="bold" /></>}</span></span>
        </summary>
        <div className="theme-goal-progress"><progress value={Math.min(goal.completedTypes, goal.requiredTypes)} max={goal.requiredTypes || 1} aria-label={`${themeById[goal.themeId].name} ${rarity.label} tile types completed`} /></div>
        <ul className="theme-goal-tiles" id={`${id}-tiles-${index}`}>{tiles.map(tile => <li className={tile.complete ? 'is-complete' : ''} key={tile.matchKey}>
          <img src={tile.src} alt="" loading="lazy" width="38" height="48" />
          <span><strong>{tile.name}</strong><small>{tile.complete ? 'Ready' : `Matched ${format(tile.count)} of ${tile.required} times`}</small></span>
          <span className="theme-goal-tile-count" aria-label={`${tile.name}, ${format(tile.count)} of ${tile.required} matches`}>{tile.complete ? <Check size={19} weight="bold" aria-hidden="true" /> : <>{Math.min(tile.count, tile.required)}<small>/{tile.required}</small></>}</span>
        </li>)}</ul>
      </details>;
    })}</div>
  </div>;
}

/** Theme availability is derived from collected pairs; a locked card only opens its goals. */
export function ThemeSelectPage({ collection, ruleset = 'eastern', initialTheme, initialScrollTop = 0, populationCounts = {}, onClose, onPlay }) {
  const edition = ruleset === 'western' ? 'western' : 'eastern';
  const unlocks = useMemo(() => getThemeUnlocks(collection, edition), [collection, edition]);
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
  return <ProgressionPage title={inspected ? `Unlock ${themeById[inspected.themeId].name}` : 'Choose a theme'} className={`theme-select-page ${inspected ? 'is-viewing-goals' : ''}`} onClose={inspected ? closeDetails : onClose} closeLabel={inspected ? 'Back to theme selection' : 'Back to main menu'}>
    {inspected ? <div className="theme-unlock-scroll"><UnlockGoals state={inspected} ruleset={edition} prerequisite={previousInspected && !previousInspected.unlocked ? previousInspected : null} /></div> : <>
      <div className="theme-choice-scroll" ref={scroller}>
        <p className="theme-choice-edition">{edition === 'western' ? 'Western' : 'Eastern'} collection<span>Changed in Settings</span></p>
        <button type="button" className={`theme-random-choice ${chosen === 'random' ? 'is-selected' : ''}`} aria-pressed={chosen === 'random'} onClick={() => setSelection('random')}>
          <span><strong>Random Match</strong><small>Unlocked themes only</small></span><span className="theme-random-dice" aria-hidden="true"><DiceFive size={41} weight="duotone" /><DiceFive size={33} weight="duotone" /></span>{chosen === 'random' ? <Check size={24} weight="bold" aria-hidden="true" /> : <CaretRight size={24} weight="bold" aria-hidden="true" />}
        </button>
        <div className="theme-choice-list" role="group" aria-label="Choose your duel theme">{unlocks.map((state, index) => {
          const theme = themeById[state.themeId], totals = goalTotals(state.requirements), selected = chosen === theme.id;
          const prerequisite = index > 0 && !unlocks[index - 1].unlocked ? unlocks[index - 1] : null;
          return <button type="button" className={`theme-choice-card ${state.unlocked ? 'is-unlocked' : 'is-locked'} ${selected ? 'is-selected' : ''}`} data-theme={theme.id} key={theme.id} aria-pressed={state.unlocked ? selected : undefined} aria-label={state.unlocked ? theme.name : `${theme.name}, locked. View unlock requirements`} onClick={event => choose(state, event)}>
            <ThemeArtwork theme={theme} ruleset={edition} />
            <span className="theme-choice-copy"><strong className="theme-choice-name">{theme.name}</strong><span className="theme-choice-population"><span aria-hidden="true" />Players online · {format(populationCounts[theme.id])}</span>
              {!state.unlocked && <span className="theme-choice-lock"><LockKey size={23} weight="fill" aria-hidden="true" /><span><strong>{prerequisite ? `Unlock ${themeById[prerequisite.themeId].name} first` : state.nextToUnlock ? 'Next to unlock' : 'Locked'}</strong><small>{totals.completed} / {totals.required} tile goals · View goals</small></span></span>}
            </span>
            {selected && <span className="theme-choice-check" aria-hidden="true"><Check size={24} weight="bold" /></span>}
          </button>;
        })}</div>
      </div>
      <footer className="theme-choice-footer"><button type="button" className="progression-primary theme-choice-play" disabled={!chosen} onClick={() => onPlay(chosen, scroller.current?.scrollTop || 0)}>Play Duel<CaretRight size={26} weight="bold" /></button><span className="theme-choice-selection-note">{chosen === 'random' ? 'A surprise from your unlocked collections' : themeById[chosen]?.name}</span></footer>
    </>}
  </ProgressionPage>;
}
