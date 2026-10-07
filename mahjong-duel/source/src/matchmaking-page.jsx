import React from 'react';
import { Check } from '@phosphor-icons/react';
import { ProgressionPage } from './progression-page.jsx';
import { PlayerAvatar } from './player-profile.jsx';
import { ThemeArtwork } from './theme-select-page.jsx';
import { defaultTheme, themeById } from './themes.js';
import './matchmaking-page.css';

function SearchOrbit() {
  return <svg className="matchmaking-search-orbit" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
    <circle className="matchmaking-orbit-track" cx="60" cy="60" r="56" />
    <g className="matchmaking-orbit-arcs">
      <path d="M60 4a56 56 0 0 1 49.6 82M60 116a56 56 0 0 1-49.6-82" />
      <circle cx="109.6" cy="86" r="2.5" />
      <circle cx="10.4" cy="34" r="2.5" />
    </g>
  </svg>;
}

function AnonymousPortrait() {
  return <span className="matchmaking-anonymous" aria-hidden="true"><svg viewBox="0 0 100 100" focusable="false"><path d="M50 19c-13 0-21 10-21 24 0 5 1 9 3 13-1 0-3 1-2 5 1 4 3 6 6 7l1 9C24 81 14 88 11 100h78c-3-12-13-19-26-23l1-9c3-1 5-3 6-7 1-4-1-5-2-5 2-4 3-8 3-13 0-14-8-24-21-24Z" /></svg></span>;
}

function PlayerSeat({ profile, isPlayer = false, searching = false }) {
  return <div className={`matchmaking-seat ${isPlayer ? 'is-player' : 'is-opponent'}`}>
    <div className="matchmaking-portrait-wrap">
      {searching && <SearchOrbit />}
      <div className="matchmaking-portrait-ring" data-matchmaking-portrait={isPlayer ? 'you' : 'ai'}>
        {searching ? <AnonymousPortrait /> : <PlayerAvatar profile={profile} size={180} showFlag={false} shape="circle" className="matchmaking-avatar" />}
      </div>
    </div>
    <strong className="matchmaking-player-name" title={isPlayer ? profile?.name : searching ? undefined : profile?.name}>{isPlayer ? 'You' : searching ? 'Opponent' : profile?.name || 'Opponent'}</strong>
    <span className={`matchmaking-player-state ${searching ? '' : 'is-ready'}`}>{searching ? 'Searching…' : <><Check size={16} weight="bold" aria-hidden="true" />Ready</>}</span>
  </div>;
}

/** The caller owns search, pause, and transition timing; this page only presents it. */
export function MatchmakingPage({ profile, opponent, theme, ruleset = 'eastern', status = 'searching', elapsedMs = 0, onCancel, paused = false, gentle = false }) {
  const searching = status === 'searching';
  const starting = status === 'starting';
  const faceoff = status === 'faceoff';
  const selectedTheme = (typeof theme === 'string' ? themeById[theme] : theme) || defaultTheme;
  const edition = ruleset === 'western' ? 'western' : 'eastern';
  const seconds = Math.floor(Math.max(0, Number(elapsedMs) || 0) / 1000);
  const elapsed = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const heading = searching ? 'Finding an opponent…' : starting ? 'Starting your duel…' : 'Opponent found!';
  const announcement = searching ? 'Finding an opponent. You are ready.' : starting ? 'Starting your duel.' : `${opponent?.name || 'Your opponent'} is ready. Match found.`;
  return <ProgressionPage title="Matchmaking" className={`matchmaking-page ${searching ? 'is-searching' : 'is-found'} ${faceoff ? 'is-faceoff' : ''} ${starting ? 'is-starting' : ''} ${paused ? 'is-paused' : ''} ${gentle ? 'is-gentle' : ''}`} onClose={searching ? onCancel : undefined} hideBack>
    <div className="matchmaking-live-status" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    <section className="matchmaking-search" aria-label="Duel players">
      <h3 className="matchmaking-heading">{heading}</h3>
      <div className="matchmaking-players">
        <PlayerSeat profile={profile} isPlayer />
        <span className="matchmaking-versus" aria-label="versus"><span>VS</span><i aria-hidden="true" /></span>
        <PlayerSeat profile={opponent} searching={searching} />
      </div>
      <div className="matchmaking-progress">
        {searching && <span className="matchmaking-progress-dots" aria-hidden="true"><span /><span /><span /></span>}
        <p className="matchmaking-elapsed" aria-live="off">{searching ? <>{paused ? 'Search paused' : 'Searching'}<span aria-hidden="true"> · </span><time>{elapsed}</time></> : starting ? 'Your table is ready' : 'Both players are ready'}</p>
      </div>
    </section>
    <section className="matchmaking-theme" data-theme={selectedTheme.id} aria-label={`Selected theme: ${selectedTheme.name}, ${edition === 'western' ? 'Western' : 'Eastern'} collection`}>
      <ThemeArtwork theme={selectedTheme} ruleset={edition} />
      <div className="matchmaking-theme-copy"><span>Selected theme</span><strong>{selectedTheme.name}</strong><small>{edition === 'western' ? 'Western' : 'Eastern'} collection</small></div>
    </section>
    <footer className="matchmaking-footer">{searching ? <button className="progression-secondary matchmaking-cancel" type="button" onClick={onCancel}>Cancel</button> : <p className="matchmaking-preparing">Preparing your table…</p>}</footer>
  </ProgressionPage>;
}
