import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CaretDown, CaretLeft, CaretRight, CheckCircle, LockKey } from '@phosphor-icons/react';
import { themes, themeById, defaultTheme } from './themes.js';
import { themeTileSets } from './tile-data.js';
import { RARITIES, rarityForTile } from './rarity.js';
import { collectionCount, collectionStats } from './collection.js';
import { getThemeUnlocks, getThemeProgress } from './theme-unlocks.js';
import { tileDescription } from './tile-descriptions.js';
import { TileRarity } from './tile-rarity.jsx';
import { ProgressionPage } from './progression-pages.jsx';
import './tile-binder.css';

const SPLIT_VIEW = '(min-width: 1000px) and (min-height: 600px) and (orientation: landscape)';
const rarityStyle = rarity => ({ '--rarity-color': rarity.color, '--rarity-ink': rarity.ink, '--rarity-tint': rarity.tint });
function RarityMark({ rarity }) {
  const id = useId();
  const marble = rarity.id === 'marble', gold = rarity.id === 'gold';
  const palette = rarity.id === 'sapphire'
    ? { light: '#a5edff', mid: '#2196ff', deep: '#004aad', edge: '#003a85', face: '#0875e1' }
    : { light: '#ecc9ff', mid: '#b966ed', deep: '#6620a3', edge: '#511176', face: '#943bc7' };
  return <span className={`rarity-mark rarity-${rarity.id}`} aria-hidden="true"><svg viewBox="0 0 32 32" focusable="false">
    <defs>
      {marble ? <radialGradient id={`${id}-surface`} cx="30%" cy="24%" r="78%"><stop stopColor="#fffef8" /><stop offset=".5" stopColor="#dddfda" /><stop offset="1" stopColor="#939a96" /></radialGradient>
        : <linearGradient id={`${id}-surface`} x1="0" y1="0" x2=".7" y2="1"><stop stopColor={gold ? '#fff4bc' : palette.light} /><stop offset=".45" stopColor={gold ? '#ffd265' : palette.mid} /><stop offset="1" stopColor={gold ? '#b86b13' : palette.deep} /></linearGradient>}
      {marble && <clipPath id={`${id}-clip`}><circle cx="16" cy="16" r="13.4" /></clipPath>}
    </defs>
    {marble ? <>
      <circle cx="16" cy="16" r="13.5" fill={`url(#${id}-surface)`} stroke="#92968c" strokeWidth="1.1" />
      <g clipPath={`url(#${id}-clip)`} fill="none" stroke="#858f89" strokeWidth=".7" opacity=".42"><path d="M8 1 12 7 9 13 15 19 13 26 17 32M19 0 18 7 23 12 20 18 25 25 23 33M0 19 9 13M15 19 20 18M18 7 12 7" /></g>
      <path d="M6 12A11 11 0 0 1 18 5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity=".65" />
    </> : gold ? <>
      <path d="M16 2C10 2 8 8 11 12C7 9 2 11 2 16C2 22 8 24 12 21C9 25 11 30 16 30C22 30 24 24 21 20C25 23 30 21 30 16C30 10 24 8 20 11C23 7 21 2 16 2Z" fill={`url(#${id}-surface)`} stroke="#84480f" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 9C11 5 16 3 18 6M5 16C5 12 8 12 10 14" fill="none" stroke="#fff7ce" strokeWidth="1.5" strokeLinecap="round" opacity=".9" />
    </> : <>
      <path d="M16 1.5 30.5 16 16 30.5 1.5 16Z" fill={`url(#${id}-surface)`} stroke={palette.edge} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M16 1.5 16 7 7 16 1.5 16ZM16 7 25 16 30.5 16 16 1.5Z" fill={palette.light} opacity=".58" />
      <path d="M1.5 16 7 16 16 25 16 30.5ZM25 16 30.5 16 16 30.5 16 25Z" fill={palette.deep} opacity=".82" />
      <path d="M16 7 25 16 16 25 7 16Z" fill={palette.face} stroke={palette.light} strokeWidth=".6" />
      <path d="M16 7 25 16 16 25Z" fill={palette.deep} opacity=".32" />
      <path d="M4 15 16 3 27 14" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity=".65" />
    </>}
  </svg></span>;
}
function TileDetails({ tile, theme, ruleset, previous, next, onMove }) {
  return <article className="collection-detail" style={rarityStyle(tile.rarity)} aria-label={`${tile.name} details`}>
    <p className="collection-detail-context">{theme.name} <span aria-hidden="true">·</span> {ruleset === 'eastern' ? 'Eastern' : 'Western'}</p>
    <div className="collection-detail-art"><span className="collection-detail-tile"><img src={tile.src} alt={tile.name} draggable="false" /><TileRarity rarity={tile.rarity} /></span></div>
    <div className="collection-detail-copy"><h3 aria-live="polite">{tile.name}</h3><span className="collection-detail-rarity"><RarityMark rarity={tile.rarity} />{tile.rarity.label}</span></div>
    <div className="collection-detail-status"><span><CheckCircle size={22} weight="duotone" aria-hidden="true" />Collected</span><span>Matched {tile.count.toLocaleString()} {tile.count === 1 ? 'time' : 'times'}</span></div>
    <p className="collection-detail-description">{tileDescription(theme.id, ruleset, tile.id)}</p>
    <nav className="collection-detail-nav" aria-label="Browse collected tiles"><button type="button" aria-label="Previous tile" disabled={!previous} onClick={() => onMove(previous)}><CaretLeft size={24} weight="bold" /><span>Previous</span></button><button type="button" aria-label="Next tile" disabled={!next} onClick={() => onMove(next)}><span>Next</span><CaretRight size={24} weight="bold" /></button></nav>
  </article>;
}

/** Full-screen collection; awards and persistence remain owned by the game. */
export function TileBinder({ collection, initialTheme = defaultTheme.id, initialRuleset = 'eastern', onClose }) {
  const [themeId, setThemeId] = useState(() => themeById[initialTheme] ? initialTheme : defaultTheme.id);
  const ruleset = initialRuleset === 'western' ? 'western' : 'eastern';
  const [tier, setTier] = useState('all');
  const [selectedKey, setSelectedKey] = useState(null);
  const [wide, setWide] = useState(() => window.matchMedia(SPLIT_VIEW).matches);
  const grid = useRef(null), browser = useRef(null), pageBody = useRef(null);
  const scrollPosition = useRef({ grid: 0, browser: 0, page: 0 }), opener = useRef(null), restoreFocus = useRef(false);
  const id = useId(), theme = themeById[themeId];
  const allStats = useMemo(() => collectionStats(collection), [collection]);
  const pageStats = useMemo(() => collectionStats(collection, { themeId, ruleset }), [collection, themeId, ruleset]);
  const cards = useMemo(() => themeTileSets[themeId][ruleset].map(tile => ({
    ...tile, rarity: rarityForTile(themeId, ruleset, tile.id), count: collectionCount(collection, tile.matchKey),
  })).sort((first, second) => second.rarity.order - first.rarity.order || first.id.localeCompare(second.id)), [collection, themeId, ruleset]);
  const nextTheme = getThemeUnlocks(collection, ruleset).find(state => state.nextToUnlock);
  const unlockProgress = getThemeProgress(nextTheme);
  const collectionGoals = nextTheme?.requirements.filter(goal => goal.themeId === themeId) ?? [];
  const visible = cards.filter(tile => tier === 'all' || tile.rarity.id === tier);
  const collected = visible.filter(tile => tile.count > 0);
  const selected = collected.find(tile => tile.matchKey === selectedKey);
  const selectedIndex = collected.findIndex(tile => tile.matchKey === selectedKey);
  const singleDetail = Boolean(selected && !wide);
  useEffect(() => {
    const media = window.matchMedia(SPLIT_VIEW);
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useLayoutEffect(() => {
    if (singleDetail) return;
    if (grid.current) grid.current.scrollTop = scrollPosition.current.grid;
    if (browser.current) browser.current.scrollTop = scrollPosition.current.browser;
    if (pageBody.current) pageBody.current.scrollTop = scrollPosition.current.page;
  }, [singleDetail]);
  useEffect(() => {
    if (restoreFocus.current) {
      opener.current?.isConnected && opener.current.focus({ preventScroll: true });
      restoreFocus.current = false;
    }
  }, [singleDetail]);
  const reset = () => {
    setSelectedKey(null); scrollPosition.current = { grid: 0, browser: 0, page: 0 };
    for (const target of [grid.current, browser.current, pageBody.current]) if (target) target.scrollTop = 0;
  };
  const closeDetails = () => { restoreFocus.current = true; setSelectedKey(null); };
  const inspect = (tile, target) => {
    if (!tile) return;
    if (target) {
      opener.current = target;
      scrollPosition.current = { grid: grid.current?.scrollTop || 0, browser: browser.current?.scrollTop || 0, page: pageBody.current?.scrollTop || 0 };
    }
    setSelectedKey(tile.matchKey);
  };
  return <ProgressionPage title={singleDetail ? 'Tile details' : 'Collection'} className={`collection-page ${singleDetail ? 'is-inspecting' : ''}`} bodyRef={pageBody}
    closeLabel={singleDetail ? 'Back to collection' : 'Back to main menu'} onClose={singleDetail ? closeDetails : onClose}>
    <div className="collection-layout" data-split={wide}>
      <section className="collection-browser" ref={browser} aria-label="Tile collection" hidden={singleDetail} onScroll={event => { if (!singleDetail) scrollPosition.current.browser = event.currentTarget.scrollTop; }}>
        <div className="collection-controls">
          <label className="collection-theme-control" htmlFor={`${id}-theme`}><img src={themeTileSets[themeId][ruleset][0].src} alt="" draggable="false" /><select id={`${id}-theme`} aria-label="Collection theme" value={themeId} onChange={event => { reset(); setThemeId(event.target.value); }}>{themes.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select><CaretDown size={20} weight="bold" aria-hidden="true" /></label>
        </div>
        <div className="collection-progress"><div className="collection-progress-copy"><strong>{pageStats.unique} / {pageStats.totalTiles} collected</strong><span>{ruleset === 'eastern' ? 'Eastern' : 'Western'} · {Math.round(pageStats.unique / pageStats.totalTiles * 100)}%</span></div><progress aria-label={`${theme.name} ${ruleset} collection`} value={pageStats.unique} max={pageStats.totalTiles} /></div>
        {collectionGoals.length > 0 && <section className="collection-unlock-goal" aria-label="Next theme progress">
          <strong>Next: {themeById[nextTheme.themeId].name} <span>{unlockProgress.percent}%</span></strong>
          <progress value={unlockProgress.percent} max={100} aria-label={`${themeById[nextTheme.themeId].name} unlock progress`} />
          <p>{collectionGoals.map(goal => `${Math.min(goal.completedTypes, goal.requiredTypes)} / ${goal.requiredTypes} ${RARITIES.find(rarity => rarity.id === goal.rarityId).label} artworks at ${goal.matchesPerType} matches`).join(' · ')}</p>
        </section>}
        <p className="collection-help">Match pairs to discover tiles. Tap a found tile to explore.</p>
        <div className="collection-tiers" role="group" aria-label="Rarity filter"><button type="button" aria-pressed={tier === 'all'} onClick={() => { reset(); setTier('all'); }}>All</button>{RARITIES.map(value => <button type="button" key={value.id} aria-pressed={tier === value.id} style={rarityStyle(value)} onClick={() => { reset(); setTier(value.id); }}><RarityMark rarity={value} /><span>{value.label}</span></button>)}</div>
        <div className="collection-grid" ref={grid} role="region" aria-label={`${theme.name} ${ruleset} tiles`} tabIndex={0} onScroll={event => { if (!singleDetail) scrollPosition.current.grid = event.currentTarget.scrollTop; }}>
          {visible.map(tile => <figure key={tile.matchKey} className={`collection-card ${tile.count ? 'is-collected' : 'is-locked'} ${selectedKey === tile.matchKey ? 'is-selected' : ''}`} data-match-key={tile.matchKey} data-rarity={tile.rarity.id} data-collected={Boolean(tile.count)} style={rarityStyle(tile.rarity)}>
            <div className="collection-art"><span className="collection-art-tile"><img src={tile.src} alt={tile.name} loading="lazy" decoding="async" draggable="false" />{tile.count > 0 && <TileRarity rarity={tile.rarity} />}</span>{!tile.count && <span className="collection-lock" aria-hidden="true"><LockKey size={24} weight="fill" /></span>}</div>
            <figcaption><strong>{tile.name}</strong><span className="collection-rarity"><RarityMark rarity={tile.rarity} />{tile.rarity.label}</span><span className="collection-card-count">{tile.count ? `Matched ×${tile.count.toLocaleString()}` : 'Not found'}</span>{collectionGoals.filter(goal => goal.rarityId === tile.rarity.id).map(goal => <span className="collection-copy-goal" key={goal.rarityId}>{tile.count >= goal.matchesPerType ? 'Ready for unlock' : `${tile.count} / ${goal.matchesPerType} for unlock`}</span>)}</figcaption>
            {tile.count > 0 && <button type="button" className="collection-inspect-button" aria-label={`Inspect ${tile.name}`} aria-pressed={wide ? selectedKey === tile.matchKey : undefined} onClick={event => inspect(tile, event.currentTarget)} />}
          </figure>)}
        </div>
        <footer className="collection-summary"><span>{allStats.unique} / {allStats.totalTiles} total collected</span><span>{allStats.totalMatches.toLocaleString()} {allStats.totalMatches === 1 ? 'pair' : 'pairs'} matched</span><span className="sr-only" aria-live="polite">{visible.length} {tier === 'all' ? '' : `${tier} `}tiles shown</span></footer>
      </section>
      <aside className="collection-detail-pane" hidden={!wide && !selected} aria-label="Tile details">
        {wide && <h2 className="collection-detail-heading">Tile details</h2>}
        {selected ? <TileDetails tile={selected} theme={theme} ruleset={ruleset} previous={collected[selectedIndex - 1]} next={collected[selectedIndex + 1]} onMove={tile => inspect(tile)} /> : <div className="collection-detail-empty"><BookOpen size={55} weight="duotone" aria-hidden="true" /><h3>Your collection has a story</h3><p>Select a collected tile to discover its meaning.</p></div>}
      </aside>
    </div>
  </ProgressionPage>;
}
