import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { BookOpen, CaretLeft, CaretRight, CheckCircle, LockKey, MagnifyingGlassPlus, Sparkle, X } from '@phosphor-icons/react';
import { themes, themeById, defaultTheme } from './themes.js';
import { themeTileSets } from './tile-data.js';
import { RARITIES, rarityForTile } from './rarity.js';
import { collectionCount, collectionStats } from './collection.js';
import { tileDescription } from './tile-descriptions.js';
import { TileRarity } from './tile-rarity.jsx';
import './tile-binder.css';

function TileInspector({ tile, theme, ruleset, opener, onClose }) {
  const dialog = useRef(null);
  const id = useId();
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => { node.close(); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} className="tile-inspector" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    style={{ '--rarity-color': tile.rarity.color, '--rarity-ink': tile.rarity.ink, '--rarity-tint': tile.rarity.tint }}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => { if (event.key === 'Escape' || event.key === 'Tab') event.stopPropagation(); }}
    onClick={event => {
      event.stopPropagation();
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <header className="tile-inspector-header"><span>{theme.name}<small>{ruleset === 'eastern' ? 'Eastern' : 'Western'} collection</small></span><button type="button" className="tile-inspector-close" aria-label="Close tile preview" onClick={onClose} autoFocus><X size={23} weight="bold" /></button></header>
    <div className="tile-inspector-art"><span className="tile-inspector-tile"><img src={tile.src} alt={tile.name} draggable="false" /><TileRarity rarity={tile.rarity} /></span></div>
    <h3 id={`${id}-title`}>{tile.name}</h3>
    <p id={`${id}-description`} className="tile-inspector-description">{tileDescription(theme.id, ruleset, tile.id)}</p>
    <footer className="tile-inspector-meta"><span><Sparkle size={15} weight={tile.rarity.order ? 'fill' : 'regular'} aria-hidden="true" />{tile.rarity.label}</span><span>Matched ×{tile.count.toLocaleString()}</span></footer>
  </dialog>;
}

/** Render inside Sheet; its parent owns dismissal, awards and persistence. */
export function TileBinder({ collection, initialTheme = defaultTheme.id, initialRuleset = 'eastern' }) {
  const [themeId, setThemeId] = useState(() => themeById[initialTheme] ? initialTheme : defaultTheme.id);
  const [ruleset, setRuleset] = useState(initialRuleset === 'western' ? 'western' : 'eastern');
  const [tier, setTier] = useState('all');
  const [inspectedTile, setInspectedTile] = useState(null);
  const grid = useRef(null);
  const id = useId();
  const theme = themeById[themeId];
  const allStats = useMemo(() => collectionStats(collection), [collection]);
  const pageStats = useMemo(() => collectionStats(collection, { themeId, ruleset }), [collection, themeId, ruleset]);
  const cards = useMemo(() => themeTileSets[themeId][ruleset].map(tile => ({
    ...tile, rarity: rarityForTile(themeId, ruleset, tile.id), count: collectionCount(collection, tile.matchKey),
  })).sort((first, second) => second.rarity.order - first.rarity.order || first.id.localeCompare(second.id)), [collection, themeId, ruleset]);
  const visible = cards.filter(tile => tier === 'all' || tile.rarity.id === tier);
  const resetScroll = () => { if (grid.current) grid.current.scrollTop = 0; };
  const changeTheme = value => { setThemeId(value); resetScroll(); };
  const moveTheme = direction => changeTheme(themes[(themes.findIndex(value => value.id === themeId) + direction + themes.length) % themes.length].id);
  return <section className="tile-binder" aria-label="Tile collection">
    <div className="binder-summary"><span className="binder-book" aria-hidden="true"><BookOpen size={29} weight="duotone" /></span><div><strong>{allStats.unique}<small> / {allStats.totalTiles}</small></strong><span>Faces discovered</span></div><div className="binder-match-total"><strong>{allStats.totalMatches.toLocaleString()}</strong><span>Pairs matched</span></div></div>
    <p className="binder-intro">Match to collect. Tap a found tile to inspect.</p>
    <div className="binder-theme-control">
      <button type="button" aria-label="Previous collection theme" onClick={() => moveTheme(-1)}><CaretLeft size={20} weight="bold" /></button>
      <label htmlFor={`${id}-theme`} className="binder-theme-label"><span>Collection</span><select id={`${id}-theme`} className="binder-theme-select" aria-label="Collection theme" value={themeId} onChange={event => changeTheme(event.target.value)}>{themes.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
      <label className="binder-theme-label binder-compact-edition"><span>Edition</span><select className="binder-theme-select" aria-label="Collection edition" value={ruleset} onChange={event => { setRuleset(event.target.value); resetScroll(); }}><option value="eastern">Eastern</option><option value="western">Western</option></select></label>
      <button type="button" aria-label="Next collection theme" onClick={() => moveTheme(1)}><CaretRight size={20} weight="bold" /></button>
    </div>
    <div className="binder-editions" role="group" aria-label="Collection ruleset">{['eastern', 'western'].map(value => <button type="button" key={value} aria-pressed={ruleset === value} onClick={() => { setRuleset(value); resetScroll(); }}>{value === 'eastern' ? 'Eastern' : 'Western'}<small>40 faces</small></button>)}</div>
    <div className="binder-tiers" role="group" aria-label="Rarity filter">
      <button type="button" aria-pressed={tier === 'all'} onClick={() => { setTier('all'); resetScroll(); }}>All</button>
      {RARITIES.map(value => <button type="button" key={value.id} aria-pressed={tier === value.id} style={{ '--rarity-color': value.color, '--rarity-ink': value.ink, '--rarity-tint': value.tint }} onClick={() => { setTier(value.id); resetScroll(); }}>{value.label}</button>)}
    </div>
    <label className="binder-theme-label binder-compact-rarity"><span>Rarity</span><select className="binder-theme-select" aria-label="Collection rarity" value={tier} onChange={event => { setTier(event.target.value); resetScroll(); }}><option value="all">All rarities</option>{RARITIES.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select></label>
    <div className="binder-page-progress"><span>{theme.name}<strong>{pageStats.unique} / {pageStats.totalTiles}</strong></span><progress aria-label={`${theme.name} ${ruleset} collection`} value={pageStats.unique} max={pageStats.totalTiles} /></div>
    <div className="binder-grid" ref={grid} role="region" aria-label={`${theme.name} ${ruleset} tiles`} tabIndex={0}>
      {visible.map(tile => <figure key={tile.matchKey} className={`binder-card ${tile.count ? 'is-collected' : 'is-locked'}`} data-match-key={tile.matchKey} data-rarity={tile.rarity.id} data-collected={Boolean(tile.count)} style={{ '--rarity-color': tile.rarity.color, '--rarity-ink': tile.rarity.ink, '--rarity-tint': tile.rarity.tint }}>
        <span className="binder-rarity"><Sparkle size={11} weight={tile.rarity.order ? 'fill' : 'regular'} aria-hidden="true" />{tile.rarity.label}</span>
        <div className="binder-art"><span className="binder-art-tile"><img src={tile.src} alt={tile.name} loading="lazy" decoding="async" /><TileRarity rarity={tile.rarity} /></span>{tile.count ? <CheckCircle className="binder-found" size={20} weight="fill" aria-label="Collected" /> : <span className="binder-lock" aria-hidden="true"><LockKey size={17} /></span>}</div>
        <figcaption><strong>{tile.name}</strong><span>{tile.count ? `Matched ×${tile.count.toLocaleString()}` : 'Not found yet'}</span></figcaption>
        {tile.count > 0 && <button type="button" className="binder-inspect-button" aria-label={`Inspect ${tile.name}`} aria-haspopup="dialog" onClick={event => setInspectedTile({ tile, opener: event.currentTarget })}><MagnifyingGlassPlus className="binder-inspect-hint" size={22} weight="bold" aria-hidden="true" /></button>}
      </figure>)}
    </div>
    <p className="binder-page-note" aria-live="polite">{visible.length} {tier === 'all' ? '' : `${tier} `}faces · Your matches only</p>
    {inspectedTile && <TileInspector tile={inspectedTile.tile} opener={inspectedTile.opener} theme={theme} ruleset={ruleset} onClose={() => setInspectedTile(null)} />}
  </section>;
}
